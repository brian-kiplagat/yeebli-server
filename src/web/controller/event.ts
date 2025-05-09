import type { Context } from 'hono';

import env from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import { BusinessService } from '../../service/business.ts';
import type { EventService } from '../../service/event.js';
import { LeadService } from '../../service/lead.js';
import { MembershipService } from '../../service/membership.ts';
import type { UserService } from '../../service/user.js';
import type { CreateEventBody, EventStreamBody, UpdateEventBody } from '../validator/event.ts';
import { ERRORS, serveBadRequest, serveInternalServerError, serveNotFound } from './resp/error.js';

export class EventController {
  private service: EventService;
  private userService: UserService;
  private leadService: LeadService;
  private membershipService: MembershipService;
  private businessService: BusinessService;

  constructor(
    service: EventService,
    userService: UserService,
    leadService: LeadService,
    membershipService: MembershipService,
    businessService: BusinessService,
  ) {
    this.service = service;
    this.userService = userService;
    this.leadService = leadService;
    this.membershipService = membershipService;
    this.businessService = businessService;
  }

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  }

  /**
   * Retrieves all events based on user role and permissions
   * @param {Context} c - The Hono context containing pagination and search parameters
   * @returns {Promise<Response>} Response containing list of events
   * @throws {Error} When fetching events fails
   */
  public getEvents = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const { page, limit, search } = c.req.query();
      const query = {
        page: page ? Number.parseInt(page) : undefined,
        limit: limit ? Number.parseInt(limit) : undefined,
        search,
      };

      if (user.role === 'master' || user.role === 'owner') {
        const events = await this.service.getAllEvents(query);
        return c.json(events);
      }
      // Get hostId from context and if hostId exists (team access), get resources for that host
      const hostId = c.get('hostId');
      if (hostId) {
        const events = await this.service.getEventsByUser(hostId, query);
        return c.json(events);
      }
      const events = await this.service.getEventsByUser(user.id, query);
      //from the memberships, get the dates for each membership
      return c.json(events);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves detailed information about a specific event
   * @param {Context} c - The Hono context containing event ID
   * @returns {Promise<Response>} Response containing event details and business information
   * @throws {Error} When fetching event details fails
   */
  public getEvent = async (c: Context) => {
    try {
      const eventId = Number(c.req.param('id'));
      const event = await this.service.getEvent(eventId);
      //get the business_id from the event host
      const host_id = event?.host?.id;
      if (!host_id) {
        return serveBadRequest(c, ERRORS.EVENT_HOST_ID_NOT_FOUND);
      }
      const business = await this.businessService.getBusinessDetailsByUserId(host_id);
      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }
      if (!event.asset) {
        return serveBadRequest(c, ERRORS.ASSET_NOT_FOUND);
      }

      return c.json({ ...event, business });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Creates a new event with associated membership plans
   * @param {Context} c - The Hono context containing event and membership details
   * @returns {Promise<Response>} Response containing created event information
   * @throws {Error} When event creation fails
   */
  public createEvent = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body: CreateEventBody = await c.req.json();

      const { membership_plans } = body;
      if (membership_plans.length < 1) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_REQUIRED);
      }

      //create event first
      const eventId = await this.service.createEvent({
        ...body,
        host_id: user.id,
      });

      // Transform membership plans to match NewMembership type
      const transformedPlans = membership_plans.map((plan) => ({
        name: plan.name,
        user_id: user.id,
        price: plan.isFree ? 0 : plan.cost,
        description: 'Sample description',
        payment_type: 'one_off' as const,
        price_point: 'standalone' as const,
        billing: 'per-day' as const,
        date: String(plan.date),
      }));

      //batch insert the membership plans
      const createdMemberships = await this.membershipService.batchCreateMembership(
        eventId,
        transformedPlans,
      );

      // Create event-membership connections
      await this.membershipService.createMembershipPlans(eventId, createdMemberships);

      return c.json(
        {
          message: 'Event created successfully',
          link: `${env.FRONTEND_URL}/events/event?code=${eventId}`,
          eventId: eventId,
        },
        201,
      );
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Updates an existing event and its membership plans
   * @param {Context} c - The Hono context containing updated event details
   * @returns {Promise<Response>} Response indicating update status
   * @throws {Error} When event update fails
   */
  public updateEvent = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const eventId = Number(c.req.param('id'));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      //only and master role or admin or the owner of the event can update the event
      if (user.role !== 'master' && user.role !== 'owner' && event.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body: UpdateEventBody = await c.req.json();
      const { membership_plans, ...rest } = body;
      //validate the membership_plans
      if (!membership_plans || membership_plans.length < 1) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_REQUIRED);
      }

      // Separate new and existing memberships
      const existingMemberships = membership_plans
        .filter((plan) => plan.id && plan.id > 0)
        .map((plan) => ({
          id: plan.id as number,
          name: plan.name,
          price: plan.isFree ? 0 : plan.cost,
          description: 'Sample description',
          date: String(plan.date),
        }));

      const newMemberships = membership_plans
        .filter((plan) => !plan.id || plan.id === 0)
        .map((plan) => ({
          name: plan.name,
          user_id: user.id,
          price: plan.isFree ? 0 : plan.cost,
          description: 'Sample description',
          payment_type: 'one_off' as const,
          price_point: 'standalone' as const,
          billing: 'per-day' as const,
          date: String(plan.date),
        }));

      // Update existing memberships and their dates
      if (existingMemberships.length > 0) {
        await Promise.all(
          existingMemberships.map(async (membership) => {
            // Update membership details
            await this.membershipService.updateMembership(membership.id, {
              name: membership.name,
              price: membership.price,
              description: membership.description,
            });

            // Get the date ID for this membership
            const dates = await this.membershipService.getMembershipDates(membership.id);
            if (dates.length > 0) {
              // Update the existing date
              await this.membershipService.updateMembershipDate(dates[0].id, {
                date: membership.date,
              });
            }
          }),
        );
      }

      // Create new memberships if any
      let newMembershipIds: number[] = [];
      if (newMemberships.length > 0) {
        const createdMemberships = await this.membershipService.batchCreateMembership(
          eventId,
          newMemberships,
        );
        newMembershipIds = createdMemberships.map((m) => m.id);
      }

      // Combine existing and new membership IDs
      const allMembershipIds = [...existingMemberships.map((m) => m.id), ...newMembershipIds];

      // Update the event with all membership IDs
      await this.service.updateEvent(eventId, { ...rest, memberships: allMembershipIds });

      return c.json({ message: 'Event updated successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Cancels an existing event
   * @param {Context} c - The Hono context containing event ID
   * @returns {Promise<Response>} Response indicating cancellation status
   * @throws {Error} When event cancellation fails
   */
  public cancelEvent = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body = await c.req.json();
      const eventId = body.id;
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }
      //only and master role or admin or the owner of the event can update the event
      if (user.role !== 'master' && user.role !== 'owner' && event.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      if (event.status === 'cancelled') {
        return serveBadRequest(c, ERRORS.EVENT_ALREADY_CANCELLED);
      }

      const host = await this.userService.find(event.host_id);
      if (!host) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      await this.service.cancelEvent(eventId, body.status);
      //inform all attendees that the event has been cancelled
      await this.service.informAttendees(event, {
        subject: 'Event Cancelled',
        title: 'Event Cancelled',
        subtitle: `The event "${event.event_name}" has been cancelled.`,
        body: `We're sorry to inform you that the event "${event.event_name}" has been cancelled by the host. If you'd like a refund, please contact the host directly at ${host.email} or ${host.phone} and provide your booking details.`,
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });
      return c.json({ message: 'Event cancelled successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Deletes an event from the system
   * @param {Context} c - The Hono context containing event ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When event deletion fails
   */
  public deleteEvent = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const eventId = Number(c.req.param('id'));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }

      //only and master role or admin or the owner of the lead
      if (user.role !== 'master' && user.role !== 'owner' && event.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }
      const leads = await this.leadService.findByEventId(eventId);
      if (leads.length > 0) {
        return serveBadRequest(c, ERRORS.EVENT_HAS_LEADS_CONNECTED);
      }

      await this.service.deleteEvent(eventId);
      return c.json({ message: 'Event deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves all membership plans associated with an event
   * @param {Context} c - The Hono context containing event ID
   * @returns {Promise<Response>} Response containing list of memberships
   * @throws {Error} When fetching memberships fails
   */
  public getEventMemberships = async (c: Context) => {
    try {
      const eventId = Number(c.req.param('id'));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }

      const memberships = await this.service.getMembershipsByEventId(eventId);
      return c.json(memberships);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Streams a pre-recorded event to users
   * @param {Context} c - The Hono context containing streaming details
   * @returns {Promise<Response>} Response containing streaming information
   * @throws {Error} When streaming setup fails
   */
  public streamPrerecordedEvent = async (c: Context) => {
    try {
      const body: EventStreamBody = await c.req.json();
      const { event_id, token, email } = body;
      const event = await this.service.getEvent(event_id);
      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }
      if (event.event_type !== 'prerecorded') {
        return serveBadRequest(c, ERRORS.EVENT_NOT_PRERECORDED);
      }
      if (body.isHost) {
        // For host, return all dates from all memberships as selected
        const allDates = (event.memberships as unknown as { dates: { id: number }[] }[]).flatMap(
          (m) => m.dates || [],
        );
        return c.json({ event, isHost: true, selectedDates: allDates });
      }
      if (!token) {
        return serveBadRequest(c, ERRORS.TOKEN_REQUIRED);
      }
      const lead = await this.leadService.findByEventIdAndToken(event_id, token);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_WITH_TOKEN_NOT_FOUND);
      }
      if (lead.email !== email) {
        return serveBadRequest(c, ERRORS.LEAD_EMAIL_MISMATCH);
      }
      if (!lead.membership_active) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_ACTIVE);
      }
      if (!lead.membership_level) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }
      const membership = await this.membershipService.getMembership(lead.membership_level);
      if (!membership) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }

      // Find the matching membership in event.memberships
      const matchingMembership = event.memberships.find((m) => m.id === lead.membership_level) as
        | { dates: { id: number }[] }
        | undefined;

      // Map lead's selected dates to full date objects from the matching membership
      const selectedDates = (lead.dates || [])
        .map((dateId) =>
          (matchingMembership?.dates || []).find((date: { id: number }) => date.id === dateId),
        )
        .filter(Boolean);

      return c.json({ lead, membership, event, selectedDates, isHost: false });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
