import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { StripeService } from "../../service/stripe.js";
import type { SubscriptionService } from "../../service/subscription.js";
import type { UserService } from "../../service/user.js";
import {
  type SubscriptionRequestBody,
  subscriptionRequestValidator,
} from "../validator/subscription.js";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
} from "./resp/error.js";
import { serveData } from "./resp/resp.js";

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
      const session = await this.subscriptionService.createSubscription(
        user,
        body.priceId,
        body.productId,
        body.successUrl,
        body.cancelUrl
      );

      return serveData(c, { url: session.url });
    } catch (error) {
      logger.error("Error creating subscription:", error);
      return serveInternalServerError(c, error);
    }
  };

  public cancelSubscription = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (!user.subscription_id) {
        return serveBadRequest(c, ERRORS.SUBSCRIPTION_NOT_FOUND);
      }

      await this.subscriptionService.cancelSubscription(
        user.id,
        user.subscription_id
      );
      return serveData(c, { message: "Subscription cancelled successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getSubscriptions = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const subscriptions = await this.subscriptionService.getSubscriptions(
        user.id
      );
      return serveData(c, { subscriptions });
    } catch (error) {
      logger.error("Error getting subscriptions:", error);
      return serveInternalServerError(c, error);
    }
  };
}
