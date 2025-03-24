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
      if (!user.stripe_account_id) {
        throw new Error("User has no connected Stripe account");
      }
      const session = await this.stripeService.createCheckoutSession({
        customer: user.stripe_account_id,
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
          userId: user.id.toString(),
          productId: productId,
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
        created: BigInt(session.created),
        currency: session.currency || "",
        mode: session.mode || "",
        payment_status: session.payment_status || "",
        status: session.status || "",
        subscription_id: session.subscription?.toString() || null,
      });

      return session;
    } catch (error) {
      logger.error("Error creating subscription checkout session:", error);
      throw error;
    }
  }

  public async getAllPlans() {
    return this.subscriptionRepo.getAllPlans();
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

  public async updateSubscription(userId: number, newPlanId: number) {
    try {
      const user = await this.userService.find(userId);
      if (!user?.subscription_id) {
        throw new Error("No active subscription found");
      }

      const plan = await this.subscriptionRepo.findPlan(newPlanId);
      if (!plan) {
        throw new Error("Subscription plan not found");
      }

      const subscription = await this.stripeService.updateSubscription(
        user.subscription_id,
        plan.stripe_price_id
      );

      await this.userService.update(userId, {
        subscription_status: subscription.status,
        subscription_plan_id: newPlanId,
      });

      return subscription;
    } catch (error) {
      logger.error("Error updating subscription:", error);
      throw error;
    }
  }
}
