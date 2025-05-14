import type { Context } from 'hono';

import env from '../../lib/env.ts';
import { logger } from '../../lib/logger.ts';
import type { NewLead } from '../../schema/schema.js';
import type { BookingService } from '../../service/booking.ts';
import { ContactService } from '../../service/contact.ts';
import type { EventService } from '../../service/event.ts';
import type { LeadService } from '../../service/lead.js';
import type { MembershipService } from '../../service/membership.ts';
import type { PaymentService } from '../../service/payment.ts';
import type { StripeService } from '../../service/stripe.ts';
import type { TurnstileService } from '../../service/turnstile.ts';
import type { UserService } from '../../service/user.ts';
import { sendTransactionalEmail } from '../../task/sendWelcomeEmail.ts';
import { formatDateToLocale } from '../../util/string.ts';
import {
  type EventLinkBody,
  externalFormSchema,
  type LeadBody,
  PurchaseMembershipBody,
  TagAssignmentBody,
  TagBody,
} from '../validator/lead.ts';
import { ERRORS, serveBadRequest, serveInternalServerError } from './resp/error.js';

export class LeadController {
  private service: LeadService;
  private userService: UserService;
  private eventService: EventService;
  private turnstileService: TurnstileService;
  private membershipService: MembershipService;
  private stripeService: StripeService;
  private bookingService: BookingService;
  private contactService: ContactService;
  private paymentService: PaymentService;

  constructor(
    service: LeadService,
    userService: UserService,
    eventService: EventService,
    turnstileService: TurnstileService,
    membershipService: MembershipService,
    stripeService: StripeService,
    bookingService: BookingService,
    contactService: ContactService,
    paymentService: PaymentService,
  ) {
    this.service = service;
    this.userService = userService;
    this.eventService = eventService;
    this.turnstileService = turnstileService;
    this.membershipService = membershipService;
    this.stripeService = stripeService;
    this.bookingService = bookingService;
    this.contactService = contactService;
    this.paymentService = paymentService;
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
   * Retrieves all leads for the authenticated user or team
   * @param {Context} c - The Hono context containing pagination and search parameters
   * @returns {Promise<Response>} Response containing list of leads
   * @throws {Error} When fetching leads fails
   */
  public getLeads = async (c: Context) => {
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
        const data = await this.service.findAll(query);
        return c.json(data.leads);
      }

      // Get hostId from context and if hostId exists (team access), get leads for that host
      const hostId = c.get('hostId');
      if (hostId) {
        //const leads = await this.service.findByUserId(hostId, query);
        const leads = await this.service.findByUserIdWithEvents(user.id, query);
        return c.json(leads);
      }

      //const leads = await this.service.findByUserId(user.id, query);
      const leads = await this.service.findByUserIdWithEvents(user.id, query);
      return c.json(leads);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves detailed information about a specific lead
   * @param {Context} c - The Hono context containing lead ID
   * @returns {Promise<Response>} Response containing lead details, events, memberships, and payments
   * @throws {Error} When fetching lead details fails
   */
  public getLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const leadId = Number(c.req.param('id'));
      const lead = await this.service.find(leadId);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      //get in parallel all payments, all events, all tags booking by lead id
      const [payments, bookedEvents, tags] = await Promise.all([
        this.paymentService.findByLeadId(lead.id),
        this.bookingService.findByUserIdandLeadId(user.id, lead.id),
        this.service.findTagsByLeadId(lead.id),
      ]);

      let dates: {
        date: string;
        id: number;
        created_at: Date | null;
        updated_at: Date | null;
        user_id: number;
        membership_id: number;
        event_id: number;
        event_name: string;
      }[] = [];

      if (lead.dates) {
        dates = await this.membershipService.getMultipleMembershipDates(lead.dates);
      }

      // Get the membership if it exists
      if (lead.membership_level) {
        const membership = await this.membershipService.getMembership(lead.membership_level);
        return c.json({
          ...lead,
          bookings: bookedEvents,
          membership: membership,
          dates: dates,
          payments: payments,
          tags: tags,
        });
      }

      return c.json({
        ...lead,
        membership: null,
        dates: dates,
        payments: payments,
        bookings: bookedEvents,
        tags: tags,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Creates a new lead in the system
   * @param {Context} c - The Hono context containing lead information
   * @returns {Promise<Response>} Response containing created lead details
   * @throws {Error} When lead creation fails
   */
  public createLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: LeadBody = await c.req.json();
      let lead;

      //token is a random 6 digit number
      const token = Math.floor(100000 + Math.random() * 900000).toString();

      //if there was a event id, create a booking for this event
      if (body.event_id) {
        //check if the lead already exists for this event
        const existingLead = await this.service.findByEmailAndEventId(body.email, body.event_id);
        if (existingLead) {
          return serveBadRequest(
            c,
            'This email is already registered for this event. You cannot register duplicate email for the same event.',
          );
        }
        const event = await this.eventService.getEvent(body.event_id);
        if (!event) {
          return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
        }
        lead = await this.service.create({
          ...body,
          host_id: user.id,
          token,
          membership_level: null,
        });
        if (!lead) {
          return serveBadRequest(c, 'Ops we cant find that lead');
        }

        //send confirmation email to the lead
        const eventLink = `${env.FRONTEND_URL}/events/membership-gateway?code=${event.id}&token=${token}&email=${body.email}`;

        const bodyText = `Thank you for your interest in ${event.event_name}! To secure your place at this exciting event, please click the link below:
        ${eventLink}`;

        sendTransactionalEmail(body.email, body.name, 1, {
          subject: `${event.event_name}`,
          title: `${event.event_name}`,
          subtitle: `Here are the details or this event`,
          body: bodyText,
          buttonText: 'Secure your place',
          buttonLink: eventLink,
        });
      }
      lead = await this.service.create({
        ...body,
        host_id: user.id,
        token,
        membership_level: null,
      });

      return c.json(lead, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Validates an event link token for lead access
   * @param {Context} c - The Hono context containing event ID and token
   * @returns {Promise<Response>} Response containing validation result
   * @throws {Error} When validation fails
   */
  public validateEventLink = async (c: Context) => {
    try {
      const body: EventLinkBody = await c.req.json();
      const event = await this.eventService.getEvent(body.event_id);
      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      const lead = await this.service.findByEventIdAndToken(body.event_id, body.token);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_WITH_TOKEN_NOT_FOUND);
      }

      const setupPayments = false;

      // If event has membership requirement and lead hasn't paid
      if (
        event.memberships.some(
          (membership) =>
            membership.membership &&
            !lead.membership_active &&
            membership.membership.name.trim() !== 'Free',
        )
      ) {
        const host = await this.userService.find(lead.host_id);
        if (!host) {
          return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
        }

        const contact = await this.contactService.findByEmail(lead.email || '');
        if (!contact) {
          return serveBadRequest(c, ERRORS.CONTACT_NOT_FOUND);
        }
        if (host.stripe_account_id) {
          // Ensure contact has a Stripe customer ID

          if (!contact.stripe_customer_id) {
            const stripeCustomer = await this.stripeService.createCustomer(contact.email);
            await this.contactService.update(contact.id, {
              stripe_customer_id: stripeCustomer.id,
            });
            contact.stripe_customer_id = stripeCustomer.id;
          }

          return c.json({
            isAllowed: false,
            message: 'Payment required to access this event',
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            id: lead.id,
            setupPayments: true,
          });
        }
      }

      // If no payment required or payment already made
      return c.json({
        isAllowed: true,
        message: 'Access granted',
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        id: lead.id,
        setupPayments: setupPayments,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        membership_level: lead.membership_level,
        membership_active: lead.membership_active,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Validates ticket payment for an event
   * @param {Context} c - The Hono context containing payment details
   * @returns {Promise<Response>} Response containing payment validation result
   * @throws {Error} When payment validation fails
   */
  public validateTicketPayment = async (c: Context) => {
    try {
      const body: EventLinkBody = await c.req.json();
      const event = await this.eventService.getEvent(body.event_id);
      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      const lead = await this.service.findByEventIdAndToken(body.event_id, body.token);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_WITH_TOKEN_NOT_FOUND);
      }

      //get the event memberships
      const eventMemberships = await this.membershipService.getEventMemberships(body.event_id);
      if (!eventMemberships) {
        return serveBadRequest(c, 'Could not find membership for this event');
      }

      // If event has membership requirement and lead hasn't paid
      if (
        eventMemberships.some(
          (membership) =>
            membership.membership &&
            !lead.membership_active &&
            membership.membership.name.trim() !== 'Free',
        )
      ) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_ACTIVE);
      }

      return c.json({
        isAllowed: true,
        message: 'Access granted',
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Updates lead information
   * @param {Context} c - The Hono context containing updated lead details
   * @returns {Promise<Response>} Response containing updated lead information
   * @throws {Error} When lead update fails
   */
  public updateLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const leadId = Number(c.req.param('id'));
      const lead = await this.service.find(leadId);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      //only and master role or admin or the owner of the lead can update the lead
      if (user.role !== 'master' && user.role !== 'owner' && lead.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body = await c.req.json();
      await this.service.update(leadId, body);
      return c.json({ message: 'Lead updated successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Deletes a lead from the system
   * @param {Context} c - The Hono context containing lead ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When lead deletion fails
   */
  public deleteLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const leadId = Number(c.req.param('id'));
      const lead = await this.service.find(leadId);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      //only and master role or admin or the owner of the lead
      if (user.role !== 'master' && user.role !== 'owner' && lead.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.service.delete(leadId);
      return c.json({ message: 'Lead deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Handles external form submissions for lead generation
   * @param {Context} c - The Hono context containing form data
   * @returns {Promise<Response>} Response containing created lead details
   * @throws {Error} When form processing fails
   */
  public handleExternalForm = async (c: Context) => {
    try {
      const formData = await c.req.parseBody();
      const body = externalFormSchema.parse(formData);

      if (!body.event_id) {
        return serveBadRequest(c, 'Please select an event');
      }

      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const event = await this.eventService.getEventOnly(body.event_id);
      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      const lead: NewLead = {
        name: body.name,
        email: body.email,
        phone: body.phone,
        event_id: body.event_id,
        host_id: body.host_id,
        membership_level: null,
        membership_active: false,
        form_identifier: 'external_form',
        status_identifier: 'Form',
        token: token,
        source_url: c.req.header('Referer') || 'direct',
      };

      const createdLead = await this.service.create(lead);
      //also create a booking for this event
      if (!lead) {
        return serveBadRequest(c, 'Ops we cant find that lead');
      }

      const eventLink = `${env.FRONTEND_URL}/events/membership-gateway?code=${event.id}&token=${token}&email=${body.email}`;

      const bodyText = `Thank you for your interest in ${event.event_name}! To secure your place at this exciting event, please click the link below:
        ${eventLink}`;

      sendTransactionalEmail(body.email, body.name, 1, {
        subject: `${event.event_name}`,
        title: `${event.event_name}`,
        subtitle: `Here are the details or this event`,
        body: bodyText,
        buttonText: 'Secure your place',
        buttonLink: eventLink,
      });

      //if the event has paid membership, redirect url is the membership gateway, else if it has a free membership, redirect url event.success_url

      const memberships = await this.membershipService.getEventMemberships(event.id);
      let redirectUrl = '';
      if (
        memberships.some((membership) => membership.membership && membership.membership.price > 0)
      ) {
        redirectUrl = `${env.FRONTEND_URL}/events/membership-gateway?code=${event.id}&token=${token}&email=${body.email}`;
      } else {
        redirectUrl = event.success_url || '';
      }

      return c.json(
        {
          success: true,
          message: 'Registration successful',
          redirectUrl: redirectUrl,
          leadId: createdLead[0].id,
        },
        201,
      );
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves unique leads based on specified criteria
   * @param {Context} c - The Hono context containing filter parameters
   * @returns {Promise<Response>} Response containing unique leads
   * @throws {Error} When fetching unique leads fails
   */
  public getUniqueLeads = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      if (!user.id) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const { page, limit, search } = c.req.query();
      const query = {
        page: page ? Number.parseInt(page) : undefined,
        limit: limit ? Number.parseInt(limit) : undefined,
        search,
      };

      const leads = await this.service.findByUserIdWithEvents(user.id, query);

      return c.json({
        leads,
        total: leads.length,
        page: Number(page) || 1,
        limit: Number(limit) || 50,
      });
    } catch (error) {
      //logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Processes membership purchase for a lead
   * @param {Context} c - The Hono context containing purchase details
   * @returns {Promise<Response>} Response containing purchase confirmation
   * @throws {Error} When membership purchase fails
   */
  public purchaseMembership = async (c: Context) => {
    try {
      const body: PurchaseMembershipBody = await c.req.json();
      const { event_id, membership_id, token } = body;

      const event = await this.eventService.getEvent(event_id);
      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      if (!body.dates || body.dates.length < 1) {
        return serveBadRequest(c, 'At least one date is required');
      }

      const membership = await this.membershipService.getMembership(membership_id);
      if (!membership) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }

      const lead = await this.service.findByEventIdAndToken(event_id, token);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_WITH_TOKEN_NOT_FOUND);
      }

      if (lead.membership_active) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_ALREADY_PURCHASED);
      }

      //define success urls
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const successUrl = `${env.FRONTEND_URL}/events/thank-you?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success&timestamp=${currentTimestamp}`;

      //If membership price is 0, book the free event ticket immediately
      if (membership.price === 0) {
        await this.service.update(lead.id, {
          membership_active: true,
          membership_level: membership_id,
          dates: body.dates,
        });

        //get membership dates
        const membershipDates =
          (await this.membershipService.getMultipleMembershipDates(body.dates)) || [];
        //if not dates error
        if (!membershipDates || membershipDates.length === 0) {
          return serveBadRequest(c, 'Could not find dates from membership');
        }

        //create a free booking
        this.bookingService.create({
          event_id: body.event_id,
          lead_id: lead.id,
          passcode: token,
          host_id: event.host_id,
          dates: body.dates,
        });

        //update the lead as membership paid
        await this.service.update(lead.id, {
          membership_active: true,
          dates: body.dates,
        });
        //get the event dates
        const formatter = new Intl.ListFormat('en', {
          style: 'long',
          type: 'conjunction',
        });
        const formattedDates = membershipDates.map((date) =>
          formatDateToLocale(new Date(Number(date.date) * 1000), 'Europe/London'),
        );
        const eventDate = formatter.format(formattedDates);
        if (lead.email && lead.name) {
          //send welcome email
          const body =
            event?.event_type === 'live_venue'
              ? `We're thrilled to let you know that your ticket has been successfully confirmed! You're now officially part of ${event?.event_name}. The venue is located at ${event?.live_venue_address}. We can't wait to see you there! Your ticket is valid for ${eventDate}. If you have any questions, need assistance, or just want to say hi, feel free to reach out to our support team at any time — we're always here to help.`
              : event?.event_type === 'live_video_call'
                ? `We're thrilled to let you know that your ticket has been successfully confirmed! You're now officially part of ${event?.event_name}. You can join the event using this link: ${event?.live_video_url}. Your ticket is valid for ${eventDate}. We can't wait to see you there! If you have any questions, need assistance, or just want to say hi, feel free to reach out to our support team at any time — we're always here to help.`
                : `We're thrilled to let you know that your ticket has been successfully confirmed! You're now officially part of ${event?.event_name}. You can access the event content at any time. Your ticket is valid for ${eventDate}. If you have any questions, need assistance, or just want to say hi, feel free to reach out to our support team at any time — we're always here to help.`;
          const buttonText =
            event?.event_type === 'live_venue'
              ? 'View Event Details'
              : event?.event_type === 'live_video_call'
                ? 'Join Event'
                : 'Go to Event';
          const buttonLink =
            event?.event_type === 'live_venue'
              ? `${env.FRONTEND_URL}/events/thank-you?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success`
              : event?.event_type === 'live_video_call'
                ? `${event?.live_video_url}`
                : `${env.FRONTEND_URL}/events/event?token=${lead.token}&email=${lead.email}&code=${lead.event_id}`;

          sendTransactionalEmail(String(lead.email), String(lead.name), 1, {
            subject: 'Your Ticket is Confirmed 🎉',
            title: "You're All Set for the Event!",
            subtitle: String(lead.token),
            body: body,
            buttonText: buttonText,
            buttonLink: buttonLink,
          });
          //create free payment
          await this.paymentService.createPayment({
            contact_id: 0,
            lead_id: lead.id,
            event_id: Number(lead.event_id),
            membership_id: membership.id,
            checkout_session_id: null,
            stripe_customer_id: '',
            amount: String(membership.price),
            currency: 'gbp',
            status: 'pending',
            payment_type: 'one_off',
            metadata: {
              eventName: event.event_name,
              membershipName: membership.name,
              dates: '',
            },
          });
        }
        return c.json({
          success: true,
          successUrl: successUrl,
          message: 'Membership purchased successfully',
        });
      }

      //check if host has setup payments
      const host = await this.userService.find(event.host_id);
      if (!host) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      if (!host.stripe_account_id) {
        return serveBadRequest(c, ERRORS.STRIPE_ACCOUNT_ID_NOT_FOUND);
      }

      const contact = await this.contactService.findByEmail(lead.email || '');
      if (!contact) {
        return serveBadRequest(c, ERRORS.CONTACT_NOT_FOUND);
      }
      let price = 0;
      //CALCULATE PRICE BASED ON BILLING TYPE
      if (membership.billing === 'per-day') {
        price = membership.price * body.dates.length;
      } else if (membership.billing === 'package') {
        price = membership.price;
      }

      if (!contact.stripe_customer_id) {
        const stripeCustomer = await this.stripeService.createCustomer(contact.email);
        await this.contactService.update(contact.id, {
          stripe_customer_id: stripeCustomer.id,
        });
        contact.stripe_customer_id = stripeCustomer.id;
      }

      const checkoutSession = await this.stripeService.createLeadUpgradeCheckoutSession(
        lead,
        contact.stripe_customer_id,
        {
          mode: 'payment',
          success_url: successUrl,
          cancel_url: `${env.FRONTEND_URL}/events/event?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=cancel`,
          hostStripeAccountId: host.stripe_account_id,
          price: price,
          eventName: event.event_name,
          membershipName: membership.name,
          membershipId: String(membership.id),
          eventId: String(event.id),
          dates: body.dates,
        },
      );
      await this.paymentService.createPayment({
        contact_id: contact.id,
        lead_id: lead.id,
        event_id: Number(lead.event_id),
        membership_id: membership.id,
        checkout_session_id: checkoutSession.session.id,
        stripe_customer_id: contact.stripe_customer_id,
        amount: String(membership.price),
        currency: 'gbp',
        status: 'pending',
        payment_type: 'one_off',
        metadata: {
          eventName: event.event_name,
          membershipName: membership.name,
          sessionId: checkoutSession.session.id,
          dates: body.dates,
        },
      });

      return c.json(checkoutSession.session);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Creates a new tag for leads
   * @param {Context} c - The Hono context containing tag details
   * @returns {Promise<Response>} Response containing created tag
   * @throws {Error} When tag creation fails
   */
  public createTag = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body: TagBody = await c.req.json();
      const { lead_id } = body;
      //get lead
      const lead = await this.service.find(lead_id);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      //create tag
      const tag = await this.service.createTag({ tag: body.tag, host_id: user.id });

      //immediately assign tag to lead
      await this.service.createTagAssignment({ tag_id: tag[0].id, lead_id: lead.id });
      return c.json(tag);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Deletes a tag from the system
   * @param {Context} c - The Hono context containing tag ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When tag deletion fails
   */
  public deleteTag = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const tagId = Number(c.req.param('id'));
      const tag = await this.service.findTag(tagId);
      if (!tag) {
        return serveBadRequest(c, ERRORS.TAG_NOT_FOUND);
      }
      //only and master role or admin or the owner of the lead
      if (user.role !== 'master' && user.role !== 'owner' && tag.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.service.deleteTag(tagId);
      return c.json({ message: 'Tag deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Removes a tag assignment from a lead
   * @param {Context} c - The Hono context containing tag and lead IDs
   * @returns {Promise<Response>} Response indicating unassignment status
   * @throws {Error} When tag unassignment fails
   */
  public unassignTag = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const tagId = Number(c.req.param('id'));
      const leadId = Number(c.req.param('lead_id'));

      await this.service.deleteTagAssignment(tagId, leadId);
      return c.json({ message: 'Tag unassigned successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Assigns a tag to a lead
   * @param {Context} c - The Hono context containing tag and lead IDs
   * @returns {Promise<Response>} Response indicating assignment status
   * @throws {Error} When tag assignment fails
   */
  public assignTag = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body: TagAssignmentBody = await c.req.json();
      const { lead_id, tag_id } = body;
      const lead = await this.service.find(lead_id);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      const tag = await this.service.findTag(tag_id);
      if (!tag) {
        return serveBadRequest(c, ERRORS.TAG_NOT_FOUND);
      }
      await this.service.createTagAssignment({ tag_id: tag_id, lead_id: lead_id });
      return c.json({ message: 'Tag assigned successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves all available tags
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing list of tags
   * @throws {Error} When fetching tags fails
   */
  public getTags = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const tags = await this.service.getTags();
      return c.json(tags);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
