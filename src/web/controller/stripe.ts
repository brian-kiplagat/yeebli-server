import crypto from "crypto";
import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { SubscriptionRepository } from "../../repository/subscription.js";
import type { StripeService } from "../../service/stripe.js";
import type { UserService } from "../../service/user.js";
import { sendTransactionalEmail } from "../../task/sendWelcomeEmail.ts";
import { ERRORS, MAIL_CONTENT } from "./resp/error.ts";
import { serveBadRequest } from "./resp/error.ts";
import type { LeadService } from "../../service/lead.js";
export class StripeController {
  private stripeService: StripeService;
  private userService: UserService;
  private subscriptionRepo: SubscriptionRepository;
  private leadService: LeadService;

  constructor(
    stripeService: StripeService,
    userService: UserService,
    subscriptionRepo: SubscriptionRepository,
    leadService: LeadService
  ) {
    this.stripeService = stripeService;
    this.userService = userService;
    this.subscriptionRepo = subscriptionRepo;
    this.leadService = leadService;
  }

  public createConnectAccount = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Check if user already has a Stripe account
      if (user.stripe_account_id) {
        const account = await this.stripeService.getAccountStatus(
          user.stripe_account_id
        );

        if (account.charges_enabled) {
          return c.json(
            { error: "Stripe account already setup and verified" },
            400
          );
        }
      }

      // Create new Stripe account if none exists
      const account = await this.stripeService.createConnectAccount(
        user.id,
        user.email
      );

      // Update user with Stripe account ID
      await this.userService.update(user.id, {
        stripe_account_id: account.id,
        stripe_account_status: "pending",
      });

      // Generate onboarding link
      const accountLink = await this.stripeService.createAccountLink(
        account.id,
        `${c.req.url.split("/v1")[0]}/v1`
      );

      return c.json({
        url: accountLink.url,
        accountId: account.id,
      });
    } catch (error) {
      logger.error("Error in createConnectAccount:", error);
      return c.json({ error: "Failed to create Stripe Connect account" }, 500);
    }
  };

  public getAccountStatus = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      if (!user.stripe_account_id) {
        return c.json({ error: "No Stripe account found" }, 404);
      }

      const account = await this.stripeService.getAccountStatus(
        user.stripe_account_id
      );

      return c.json({
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        status: user.stripe_account_status,
      });
    } catch (error) {
      logger.error("Error in getAccountStatus:", error);
      return c.json({ error: "Failed to get account status" }, 500);
    }
  };

  public getCardDetails = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (!user.stripe_customer_id) {
        return serveBadRequest(c, ERRORS.STRIPE_CUSTOMER_ID_NOT_FOUND);
      }
      const cardDetails = await this.stripeService.getCustomerPaymentMethods(
        user.stripe_customer_id
      );
      return c.json(cardDetails);
    } catch (error) {
      logger.error("Error in getAccountStatus:", error);
      return c.json({ error: "Failed to get account status" }, 500);
    }
  };
  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public initiateOAuth = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const userId = user.id;
      const state = crypto.randomBytes(16).toString("hex");

      // Store state temporarily
      await this.userService.update(userId, {
        stripe_oauth_state: state,
      });

      const oauthUrl = this.stripeService.generateOAuthUrl(state);

      return c.json({ url: oauthUrl });
    } catch (error) {
      logger.error("Error initiating OAuth:", error);
      return c.json({ error: "Failed to initiate OAuth" }, 500);
    }
  };

  public handleOAuthCallback = async (c: Context) => {
    try {
      const { code, state } = c.req.query();
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const userId = user.id;

      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (state !== user.stripe_oauth_state) {
        return serveBadRequest(c, ERRORS.INVALID_STATE);
      }

      const response = await this.stripeService.handleOAuthCallback(code);

      await this.userService.update(userId, {
        stripe_account_id: response.stripe_user_id,
        stripe_oauth_state: null,
      });

      return c.json({
        success: true,
        accountId: response.stripe_user_id,
      });
    } catch (error) {
      logger.error("Error handling OAuth callback:", error);
      return c.json({ error: "Failed to complete OAuth connection" }, 500);
    }
  };

  public handleWebhook = async (c: Context) => {
    try {
      const signature = c.req.header("stripe-signature");
      if (!signature) {
        return c.json({ error: "No signature provided" }, 400);
      }

      const rawBody = await c.req.raw.text();
      const event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature
      );

      switch (event.type) {
        case "account.updated":
          await this.handleAccountUpdate(event.data.object);
          break;
        case "checkout.session.completed":
          await this.handleCheckoutCompleted(event.data.object);
          break;
        case "customer.subscription.created":
          await this.handleSubscriptionUpdate(event.data.object);
          break;
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await this.handleSubscriptionUpdate(event.data.object);
          break;
        case "customer.subscription.trial_will_end":
          await this.handleTrialEnding(event.data.object);
          break;
      }

      return c.json({ received: true });
    } catch (error) {
      console.error(error);
      return c.json(
        {
          error: "Webhook handler failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  };

  private async handleAccountUpdate(account: any) {
    try {
      const userId = account.metadata.userId;
      if (!userId) return;

      let status: "pending" | "active" | "rejected" | "restricted" = "pending";

      if (account.charges_enabled && account.payouts_enabled) {
        status = "active";
      } else if (account.requirements?.disabled_reason) {
        status = "restricted";
      } else if (account.requirements?.errors?.length > 0) {
        status = "rejected";
      }

      await this.userService.update(Number.parseInt(userId), {
        stripe_account_status: status,
      });
    } catch (error) {
      logger.error("Error handling account update:", error);
      throw error;
    }
  }

  private async handleSubscriptionUpdate(subscription: any) {
    try {
      const userId = subscription.metadata.userId;
      if (!userId) return;

      // Log the subscription event
      logger.info(
        `Processing subscription event: ${subscription.status} for user ${userId}`
      );

      // Update user's subscription status
      await this.userService.update(Number.parseInt(userId), {
        subscription_status: subscription.status,
        subscription_id: subscription.id,
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      });

      // Log subscription details for tracking
      logger.info({
        event: "subscription_update",
        userId,
        subscriptionId: subscription.id,
        status: subscription.status,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });

      // Handle specific subscription statuses
      switch (subscription.status) {
        case "trialing":
          logger.info(`User ${userId} started trial period`);
          break;
        case "active":
          logger.info(`User ${userId} subscription is now active`);
          break;
        case "past_due":
          logger.warn(`User ${userId} subscription payment is past due`);
          break;
        case "canceled":
          logger.info(`User ${userId} subscription was canceled`);
          break;
        case "incomplete":
          logger.warn(`User ${userId} subscription is incomplete`);
          break;
        case "incomplete_expired":
          logger.warn(
            `User ${userId} subscription expired due to incomplete payment`
          );
          break;
        case "paused":
          logger.info(`User ${userId} subscription is paused`);
          break;
        case "unpaid":
          logger.warn(`User ${userId} subscription is unpaid`);
          break;
      }
    } catch (error) {
      logger.error("Error handling subscription update:", error);
      throw error;
    }
  }

  private async handleTrialEnding(subscription: any) {
    try {
      const userId = subscription.metadata.userId;
      if (!userId) return;

      const user = await this.userService.find(Number.parseInt(userId));
      if (!user) {
        logger.error(`User ${userId} not found during checkout completion`);
        return;
      }
      // Send welcome email
      sendTransactionalEmail(
        user.email,
        user.name,
        1,
        MAIL_CONTENT.SUBSCRIPTION_TRIAL_ENDED
      );
    } catch (error) {
      logger.error("Error handling trial ending:", error);
      throw error;
    }
  }

  private async handleCheckoutCompleted(session: any) {
    try {
      //check for metadata type lead_upgrade
      const type = session.metadata.type;
      if (type === "lead_upgrade") {
        if (session.status === "complete") {
          const leadId = session.metadata.leadId;
          const lead = await this.leadService.find(Number.parseInt(leadId));
          if (lead) {
            await this.leadService.update(lead.id, {
              membership_active: true,
              membership_level: Number.parseInt(session.metadata.membershipId),
            });
            if (lead.email && lead.name) {
              //send welcome email
              sendTransactionalEmail(String(lead.email), String(lead.name), 1, {
                subject: "Your Ticket is Confirmed 🎉",
                title: "You're All Set for the Event!",
                subtitle: String(lead.token),
                body: "We're thrilled to let you know that your ticket has been successfully confirmed! You’re now officially part of the experience, and we can’t wait to see you at the event. If you have any questions, need assistance, or just want to say hi, feel free to reach out to our support team at any time — we're always here to help.",
              });
            }
          }
        }
      } else if (type === "subscription") {
        const userId = session.metadata.userId;
        if (!userId) return;

        const user = await this.userService.find(Number.parseInt(userId));
        if (!user) {
          logger.error(`User ${userId} not found during checkout completion`);
          return;
        }

        // Run user update and email sending concurrently
        await Promise.all([
          // Update user's subscription status to active
          this.userService.update(Number.parseInt(userId), {
            subscription_status: "active",
            subscription_id: session.subscription,
          }),
          // Send welcome email
          sendTransactionalEmail(
            user.email,
            user.name,
            1,
            MAIL_CONTENT.SUBSCRIPTION_TRIAL_STARTED
          ),
        ]);

        logger.info(
          `User ${userId} completed checkout and subscription is now active`
        );
      }
    } catch (error) {
      logger.error("Error handling checkout completion:", error);
      throw error;
    }
  }
}
