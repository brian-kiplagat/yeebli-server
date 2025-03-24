import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import { SubscriptionService } from "../../service/subscription.js";
import { StripeService } from "../../service/stripe.js";
import { UserService } from "../../service/user.js";
import { ERRORS } from "./resp/error.js";
import { serveBadRequest } from "./resp/error.js";
import { SubscriptionRequestBody } from "../validator/subscription.ts";
import env from "../../lib/env.ts";

export class SubscriptionController {
  private subscriptionService: SubscriptionService;
  private stripeService: StripeService;
  private userService: UserService;

  constructor(
    subscriptionService: SubscriptionService,
    stripeService: StripeService,
    userService: UserService
  ) {
    this.subscriptionService = subscriptionService;
    this.stripeService = stripeService;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public subscribe = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: SubscriptionRequestBody = await c.req.json();
      const { priceId, productId, successUrl, cancelUrl } = body;

      const session = await this.subscriptionService.createSubscription(
        user,
        priceId,
        productId,
        successUrl,
        cancelUrl
      );

      return c.json({
        success: true,
        url: session.url,
      });
    } catch (error) {
      logger.error("Error creating subscription:", error);
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: "Failed to create subscription" }, 500);
    }
  };

  public cancelSubscription = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const result = await this.subscriptionService.cancelSubscription(user.id);
      return c.json({ success: true, subscription: result });
    } catch (error) {
      logger.error("Error canceling subscription:", error);
      return c.json({ error: "Failed to cancel subscription" }, 500);
    }
  };

  public updateSubscription = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const newPlanId = parseInt(c.req.param("planId"));
      if (isNaN(newPlanId)) {
        return serveBadRequest(c, "Invalid plan ID");
      }

      const subscription = await this.subscriptionService.updateSubscription(
        user.id,
        newPlanId
      );
      return c.json({ success: true, subscription });
    } catch (error) {
      logger.error("Error updating subscription:", error);
      return c.json({ error: "Failed to update subscription" }, 500);
    }
  };

  public getPlans = async (c: Context) => {
    try {
      const plans = await this.subscriptionService.getAllPlans();
      return c.json({ plans });
    } catch (error) {
      logger.error("Error getting plans:", error);
      return c.json({ error: "Failed to get subscription plans" }, 500);
    }
  };
}
