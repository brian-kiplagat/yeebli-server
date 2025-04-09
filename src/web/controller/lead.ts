import type { Context } from "hono";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../lib/logger.ts";
import type { NewLead } from "../../schema/schema.js";
import type { EventService } from "../../service/event.ts";
import type { LeadService } from "../../service/lead.js";
import type { TurnstileService } from "../../service/turnstile.js";
import type { UserService } from "../../service/user.ts";
import { sendTransactionalEmail } from "../../task/sendWelcomeEmail.ts";
import {
  EventLinkBody,
  externalFormSchema,
  LeadBody,
  LeadUpgradeBody,
} from "../validator/lead.ts";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
} from "./resp/error.js";
import { MembershipService } from "../../service/membership.ts";

import { StripeService } from "../../service/stripe.ts";
import env from "../../lib/env.ts";
import { BookingService } from "../../service/booking.ts";

export class LeadController {
  private service: LeadService;
  private userService: UserService;
  private eventService: EventService;
  private turnstileService: TurnstileService;
  private membershipService: MembershipService;
  private stripeService: StripeService;
  private bookingService: BookingService;
  constructor(
    service: LeadService,
    userService: UserService,
    eventService: EventService,
    turnstileService: TurnstileService,
    membershipService: MembershipService,
    stripeService: StripeService,
    bookingService: BookingService
  ) {
    this.service = service;
    this.userService = userService;
    this.eventService = eventService;
    this.turnstileService = turnstileService;
    this.membershipService = membershipService;
    this.stripeService = stripeService;
    this.bookingService = bookingService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
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

      if (user.role === "master" || user.role === "owner") {
        const leads = await this.service.findAll(query);
        return c.json(leads);
      }

      const leads = await this.service.findByUserId(user.id, query);
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

      const leadId = Number(c.req.param("id"));
      const lead = await this.service.find(leadId);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      //get the membership if there  and spread it into the lead
      if (lead.membership_level) {
        const membership = await this.membershipService.getMembership(
          lead.membership_level
        );
        return c.json({
          ...lead,
          membership: membership,
        });
      }
      //get bookings by lead id
      const bookings = await this.bookingService.findByLeadId(lead.id);
      return c.json({
        ...lead,
        bookings: bookings,
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

      if (body.event_id) {
        if (!body.event_date_id) {
          return serveBadRequest(c, ERRORS.EVENT_DATE_ID_REQUIRED);
        }
      }
      //token is a random 6 digit number
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const lead = await this.service.create({
        ...body,
        userId: user.id,
        token,
        membership_level: null,
      });
      if (lead && body.event_id && body.event_date_id) {
        //also create a booking for this event
        const booking = await this.bookingService.create({
          event_id: body.event_id,
          date_id: body.event_date_id,
          lead_id: lead[0].id,
          passcode: token,
        });
        //send confirmation email to the lead
        const event = await this.eventService.getEvent(body.event_id);
        if (event) {
          const eventLink = `${env.FRONTEND_URL}/eventpage?code=${event.id}&token=${token}&email=${body.email}`;
          const bodyText =
            event.event_type == "live_venue"
              ? `You're invited to a live, in-person event! The venue is located at ${event.live_venue_address}. Make sure to arrive on time and enjoy the experience in person. If you have any questions or need more details, feel free to visit our website: ${eventLink}. To access the event, please use this passcode: ${token}. We look forward to seeing you there!`
              : event.event_type == "live_video_call"
                ? `Get ready for a live video call event! You can join from anywhere using this link: ${event.live_video_url}. To ensure a smooth experience, we recommend joining a few minutes early. If you need more information, you can check our website here: ${eventLink}. Your access passcode is: ${token}. We can't wait to connect with you online!`
                : `You're invited to a virtual event! Enjoy the experience from the comfort of your own space. Simply click the link below to join: ${eventLink}. If you have any questions or need assistance, you can always visit our website. Your access passcode is: ${token}. See you there!`;

          sendTransactionalEmail(body.email, body.name, 1, {
            subject: `${event.event_name}`,
            title: `${event.event_name} - You've been invited`,
            subtitle: `You've been invited to join us`,
            body: bodyText,
          });
        }
      }
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
      const lead = await this.service.findByEventIdAndToken(
        body.event_id,
        body.token
      );
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_WITH_TOKEN_NOT_FOUND);
      }
      return c.json({
        isAllowed: true,
        message: "Event link is valid",
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        id: lead.id,
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

  public updateLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const leadId = Number(c.req.param("id"));
      const lead = await this.service.find(leadId);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      //only and master role or admin or the owner of the lead can update the lead
      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        lead.userId !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body = await c.req.json();
      await this.service.update(leadId, body);
      return c.json({ message: "Lead updated successfully" });
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

      const leadId = Number(c.req.param("id"));
      const lead = await this.service.find(leadId);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      //only and master role or admin or the owner of the lead
      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        lead.userId !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.service.delete(leadId);
      return c.json({ message: "Lead deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public handleExternalForm = async (c: Context) => {
    try {
      const formData = await c.req.parseBody();
      const validatedData = externalFormSchema.parse(formData);

      // Verify Turnstile token
      const ip = c.req.header("CF-Connecting-IP");
      const isValid = await this.turnstileService.verify(
        validatedData["cf-turnstile-response"],
        ip
      );

      if (!isValid) {
        return serveBadRequest(c, "Invalid Turnstile token");
      }

      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const event = await this.eventService.getEvent(validatedData.event_id);
      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      const lead: NewLead = {
        name: validatedData.lead_form_name,
        email: validatedData.lead_form_email,
        phone: validatedData.lead_form_phone,
        event_id: validatedData.event_id,
        registered_date: validatedData.registered_date,
        host_id: validatedData.host_id,
        membership_level: null,
        membership_active: false,
        form_identifier: "external_form",
        status_identifier: "Form",
        userId: validatedData.host_id,
        token: token,
        source_url: c.req.header("Referer") || "direct",
      };

      const createdLead = await this.service.create(lead);
      //also create a booking for this event
      if (validatedData.registered_date && validatedData.event_id) {
        const booking = await this.bookingService.create({
          event_id: validatedData.event_id,
          date_id: Number(validatedData.registered_date),
          lead_id: createdLead[0].id,
          passcode: token,
        });
      }
      //send confirmation email to the lead
      const eventLink = `${env.FRONTEND_URL}/eventpage?code=${event.id}&token=${token}&email=${validatedData.lead_form_email}`;
      const bodyText =
        event.event_type == "live_venue"
          ? `You're invited to a live, in-person event! The venue is located at ${event.live_venue_address}. Make sure to arrive on time and enjoy the experience in person. If you have any questions or need more details, feel free to visit our website: ${eventLink}. We look forward to seeing you there!`
          : event.event_type == "live_video_call"
            ? `Get ready for a live video call event! You can join from anywhere using this link: ${event.live_video_url}. To ensure a smooth experience, we recommend joining a few minutes early. If you need more information, you can check our website here: ${eventLink}.`
            : `You've booked a ticket for a virtual event! Enjoy the experience from the comfort of your own space. Simply click the link below to join: ${eventLink}. If you have any questions or need assistance, you can always visit our website. Your access passcode is: ${token}. See you there!`;

      sendTransactionalEmail(
        validatedData.lead_form_email,
        validatedData.lead_form_name,
        1,
        {
          subject: "Welcome to the event",
          title: "Welcome to the event",
          subtitle: `You have been registered for the event`,
          body: bodyText,
        }
      );
      return c.json(
        {
          success: true,
          message: "Registration successful",
          leadId: createdLead[0].id,
        },
        201
      );
    } catch (error) {
      logger.error("Error handling external form:", error);
      return serveInternalServerError(c, error);
    }
  };

  public upgradeLead = async (c: Context) => {
    try {
      const body: LeadUpgradeBody = await c.req.json();
      const lead = await this.service.find(body.lead_id);
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      if (!lead.event_id) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }
      //get membership
      const membership = await this.membershipService.getMembership(
        body.membership_id
      );
      if (!membership) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }
      //get host user
      const host = await this.userService.find(lead.host_id);
      if (!host) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      //get event
      const event = await this.eventService.getEvent(lead.event_id);
      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }
      if (!host.stripe_account_id) {
        return serveBadRequest(c, ERRORS.STRIPE_ACCOUNT_ID_NOT_FOUND);
      }
      //create checkout session with stripe service, amount is membership price
      const checkoutSession =
        await this.stripeService.createLeadUpgradeCheckoutSession(lead, {
          mode: "payment",
          success_url: `${env.FRONTEND_URL}/eventpage?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success`,
          cancel_url: `${env.FRONTEND_URL}/eventpage?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=cancel`,
          hostStripeAccountId: host.stripe_account_id,
          price: membership.price,
          eventName: event.event_name,
          membershipName: membership.name,
          membershipId: String(membership.id),
        });
      return c.json(checkoutSession);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
