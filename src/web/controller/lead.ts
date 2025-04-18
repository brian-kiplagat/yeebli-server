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
import {
  type EventLinkBody,
  externalFormSchema,
  type LeadBody,
  PurchaseMembershipBody,
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

  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  }

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

      // Get all events booked by this lead
      const bookedEvents = await this.bookingService.findByUserIdandLeadId(user.id, lead.id);

      // Get the membership if it exists
      if (lead.membership_level) {
        const membership = await this.membershipService.getMembership(lead.membership_level);
        return c.json({
          ...lead,
          events: bookedEvents,
          membership: membership,
        });
      }

      return c.json({
        ...lead,
        events: bookedEvents,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public createLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: LeadBody = await c.req.json();
      if (!body.event_id) {
        return serveBadRequest(c, 'Please select an event');
      }
      //token is a random 6 digit number
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const lead = await this.service.create({
        ...body,
        userId: user.id,
        token,
        membership_level: null,
      });
      if (!lead) {
        return serveBadRequest(c, 'Ops we cant find that lead');
      }

      //also create a booking for this event
      const event = await this.eventService.getEvent(body.event_id);
      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }
      await this.bookingService.create({
        event_id: body.event_id,

        lead_id: lead[0].id,
        passcode: token,
        host_id: event.host_id,
      });
      //send confirmation email to the lead
      const eventLink = `${env.FRONTEND_URL}/events/membership-gateway?code=${event.id}&token=${token}&email=${body.email}`;

      const bodyText =
        event.event_type === 'live_venue'
          ? `You're invited to a live, in-person event! The venue is located at ${event.live_venue_address}. Check our website here: ${eventLink} for more information.`
          : event.event_type === 'live_video_call'
            ? `Get ready for a live video call event! You can join from anywhere using this link: ${event.live_video_url}. Check our website here: ${eventLink} for more information.`
            : `You're invited to a virtual event! Enjoy the experience from the comfort of your own space. Check our website here: ${eventLink} to join the event.`;

      sendTransactionalEmail(body.email, body.name, 1, {
        subject: `${event.event_name}`,
        title: `${event.event_name} - You've been invited`,
        subtitle: `You've been invited to join us`,
        body: bodyText,
      });

      return c.json(lead, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

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
      if (user.role !== 'master' && user.role !== 'owner' && lead.userId !== user.id) {
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
      if (user.role !== 'master' && user.role !== 'owner' && lead.userId !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.service.delete(leadId);
      return c.json({ message: 'Lead deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public handleExternalForm = async (c: Context) => {
    try {
      const formData = await c.req.parseBody();
      const body = externalFormSchema.parse(formData);

      // Verify Turnstile token
      const ip = c.req.header('CF-Connecting-IP');
      const isValid = await this.turnstileService.verify(body['cf-turnstile-response'], ip);

      if (!isValid) {
        return serveBadRequest(c, 'Invalid Turnstile token');
      }
      if (!body.event_id) {
        return serveBadRequest(c, 'Please select an event');
      }

      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const event = await this.eventService.getEvent(body.event_id);
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
        userId: body.host_id,
        token: token,
        source_url: c.req.header('Referer') || 'direct',
      };

      const createdLead = await this.service.create(lead);
      //also create a booking for this event
      if (!lead) {
        return serveBadRequest(c, 'Ops we cant find that lead');
      }

      await this.bookingService.create({
        event_id: body.event_id,
        lead_id: createdLead[0].id,
        passcode: token,
        host_id: event.host_id,
      });
      const eventLink = `${env.FRONTEND_URL}/events/membership-gateway?code=${event.id}&token=${token}&email=${body.email}`;

      const bodyText =
        event.event_type === 'live_venue'
          ? `You're invited to a live, in-person event! The venue is located at ${event.live_venue_address}. Check our website here: ${eventLink} for more information.`
          : event.event_type === 'live_video_call'
            ? `Get ready for a live video call event! You can join from anywhere using this link: ${event.live_video_url}. Check our website here: ${eventLink} for more information.`
            : `You're invited to a virtual event! Enjoy the experience from the comfort of your own space. Check our website here: ${eventLink} to join the event.`;

      sendTransactionalEmail(body.email, body.name, 1, {
        subject: 'Welcome to the event',
        title: 'Welcome to the event',
        subtitle: `You have been registered for the event`,
        body: bodyText,
      });
      return c.json(
        {
          success: true,
          message: 'Registration successful',
          leadId: createdLead[0].id,
        },
        201,
      );
    } catch (error) {
      logger.error('Error handling external form:', error);
      return serveInternalServerError(c, error);
    }
  };

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

      const extension =
        membership.billing === 'per-day'
          ? `${body.dates.length} days of access – ${membership.price} GBP per day`
          : membership.billing === 'package'
            ? `Multi-Day Access – One Easy Payment`
            : '';

      if (!contact.stripe_customer_id) {
        const stripeCustomer = await this.stripeService.createCustomer(contact.email);
        await this.contactService.update(contact.id, {
          stripe_customer_id: stripeCustomer.id,
        });
        contact.stripe_customer_id = stripeCustomer.id;
      }
      let successUrl = '';
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (event.event_type === 'live_venue') {
        successUrl = `${env.FRONTEND_URL}/events/thank-you?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success&timestamp=${currentTimestamp}`;
      } else if (event.event_type === 'live_video_call') {
        successUrl = `${env.FRONTEND_URL}/events/thank-you?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success&timestamp=${currentTimestamp}`;
      } else if (event.event_type === 'prerecorded') {
        successUrl = `${env.FRONTEND_URL}/events/event?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success`;
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
          membershipName: membership.name + ' ' + extension,
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
}
