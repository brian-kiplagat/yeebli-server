import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import { SubscriptionService } from "../../service/subscription.js";
import { StripeService } from "../../service/stripe.js";

export class SubscriptionController {
  private subscriptionService: SubscriptionService;
  private stripeService: StripeService;

  constructor(
    subscriptionService: SubscriptionService,
    stripeService: StripeService
  ) {
    this.subscriptionService = subscriptionService;
    this.stripeService = stripeService;
  }

  public setupPlans = async (c: Context) => {
    try {
      const plans = [
        {
          name: "Platform Trial",
          price: 0,
          interval: "year",
          features: {
            lead_capacity: 100,
            prerecorded_events: 3,
            live_venue_events: true,
            live_video_events: true,
            email_alerts: true,
            video_asset_limit: 5,
          },
        },
        {
          name: "Platform Basic",
          price: 199,
          interval: "month",
          features: {
            lead_capacity: 10000,
            prerecorded_events: 10,
            live_venue_events: true,
            live_video_events: true,
            membership_access: true,
            email_alerts: true,
            support_level: "email",
            video_asset_limit: 15,
          },
        },
        {
          name: "Platform Full",
          price: 399,
          interval: "month",
          features: {
            lead_capacity: 30000,
            prerecorded_events: 20,
            live_venue_events: true,
            live_video_events: true,
            membership_access: true,
            email_alerts: true,
            sms_alerts: 1000,
            support_level: "phone",
            email_campaign: true,
            video_asset_limit: 30,
          },
        },
      ];

      const createdPlans = [];
      for (const plan of plans) {
        const product = await this.stripeService.createProduct({
          name: plan.name,
          metadata: {
            features: JSON.stringify(plan.features),
          },
        });

        if (plan.price > 0) {
          const price = await this.stripeService.createPrice({
            product: product.id,
            unit_amount: plan.price * 100, // Convert to cents
            currency: "gbp",
            recurring: {
              interval: plan.interval as "month" | "year" | "day" | "week",
            },
          });

          createdPlans.push({
            name: plan.name,
            productId: product.id,
            priceId: price.id,
            features: plan.features,
          });
        }
      }

      return c.json({ success: true, plans: createdPlans });
    } catch (error) {
      logger.error("Error setting up plans:", error);
      return c.json({ error: "Failed to set up subscription plans" }, 500);
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
