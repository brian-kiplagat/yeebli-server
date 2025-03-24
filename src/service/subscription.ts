import { SubscriptionRepository } from "../repository/subscription.js";
import { StripeService } from "./stripe.js";
import { UserService } from "./user.js";
import { logger } from "../lib/logger.js";

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

  public async createSubscription(userId: number, planId: number) {
    try {
      const user = await this.userService.find(userId);
      if (!user?.stripe_account_id) {
        throw new Error("User has no connected Stripe account");
      }

      const plan = await this.subscriptionRepo.findPlan(planId);
      if (!plan) {
        throw new Error("Subscription plan not found");
      }

      const subscription = await this.stripeService.createSubscription({
        customer: user.stripe_account_id,
        items: [{ price: plan.stripe_price_id }],
        trial_period_days: 14,
        metadata: {
          userId: userId.toString(),
          planId: planId.toString(),
        },
      });

      await this.userService.update(userId, {
        subscription_id: subscription.id,
        subscription_status: subscription.status,
        subscription_plan_id: planId,
        trial_ends_at: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      });

      return subscription;
    } catch (error) {
      logger.error("Error creating subscription:", error);
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
