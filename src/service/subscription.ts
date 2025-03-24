import { SubscriptionRepository } from "../repository/subscription.js";
import { StripeService } from "./stripe.js";
import { UserService } from "./user.js";
import { logger } from "../lib/logger.js";
import { User } from "../lib/database.ts";

export class SubscriptionService {
  private subscriptionRepo: SubscriptionRepository;
  private stripeService: StripeService;
  private userService: UserService;

  constructor(
    subscriptionRepo: SubscriptionRepository,
    stripeService: StripeService,
    userService: UserService
  ) {
    this.subscriptionRepo = subscriptionRepo;
    this.stripeService = stripeService;
    this.userService = userService;
  }

  public async createSubscription(
    user: User,
    priceId: string,
    productId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    try {
      if (!user.stripe_customer_id) {
        throw new Error("User has no Stripe customer ID");
      }

      const session = await this.stripeService.createCheckoutSession({
        customer: user.stripe_customer_id,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: String(user.id),
        },
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            userId: String(user.id),
            productId: productId,
          },
        },
      });

      // Store the checkout session in our database
      await this.subscriptionRepo.createSubscription({
        user_id: user.id,
        object: "checkout.session",
        amount_subtotal: session.amount_subtotal || 0,
        amount_total: session.amount_total || 0,
        session_id: session.id,
        cancel_url: session.cancel_url || "",
        success_url: session.success_url || "",
        created: Number(session.created),
        currency: session.currency || "",
        mode: session.mode || "",
        payment_status: session.payment_status || "",
        status: session.status || "",
        subscription_id: session.subscription?.toString() || null,
      });

      return session;
    } catch (error) {
      console.log(error);
      logger.error("Error creating subscription checkout session:", error);
      throw error;
    }
  }

  public async cancelSubscription(userId: number) {
    try {
      const user = await this.userService.find(userId);
      if (!user?.subscription_id) {
        throw new Error("No active subscription found");
      }

      const subscription = await this.stripeService.cancelSubscription(
        user.subscription_id
      );

      await this.userService.update(userId, {
        subscription_status: "canceled",
      });

      return subscription;
    } catch (error) {
      logger.error("Error canceling subscription:", error);
      throw error;
    }
  }

  public async getSubscriptions(userId: number) {
    try {
      return await this.subscriptionRepo.findSubscriptionsByUserId(userId);
    } catch (error) {
      logger.error("Error getting subscriptions:", error);
      throw error;
    }
  }
}
