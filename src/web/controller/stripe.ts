import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { StripeService } from "../../service/stripe.js";
import type { UserService } from "../../service/user.js";
import crypto from "crypto";
import { ERRORS } from "./resp/error.ts";
import { serveBadRequest } from "./resp/error.ts";

export class StripeController {
  private stripeService: StripeService;
  private userService: UserService;

  constructor(stripeService: StripeService, userService: UserService) {
    this.stripeService = stripeService;
    this.userService = userService;
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

      if (!user || state !== user.stripe_oauth_state) {
        return c.json({ error: "Invalid state parameter" }, 400);
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
      const payload = await c.req.json();
      const signature = c.req.header("stripe-signature");

      if (!signature) {
        return c.json({ error: "No signature provided" }, 400);
      }

      const event = this.stripeService.constructWebhookEvent(
        payload,
        signature
      );

      switch (event.type) {
        case "account.updated":
          await this.handleAccountUpdate(event.data.object);
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await this.handleSubscriptionUpdate(event.data.object);
          break;
      }

      return c.json({ received: true });
    } catch (error) {
      logger.error("Error handling webhook:", error);
      return c.json({ error: "Webhook handler failed" }, 500);
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

      await this.userService.update(parseInt(userId), {
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

      await this.userService.update(parseInt(userId), {
        subscription_status: subscription.status,
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      });
    } catch (error) {
      logger.error("Error handling subscription update:", error);
      throw error;
    }
  }
}
