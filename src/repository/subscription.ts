import { eq } from "drizzle-orm";
import { db } from "../lib/database.js";
import {
  subscriptionPlanSchema,
  subscriptionSchema,
} from "../schema/schema.js";

export class SubscriptionRepository {
  public async findPlan(id: number) {
    return db.query.subscriptionPlanSchema.findFirst({
      where: eq(subscriptionPlanSchema.id, id),
    });
  }

  public async findPlanByPriceId(priceId: string) {
    return db.query.subscriptionPlanSchema.findFirst({
      where: eq(subscriptionPlanSchema.stripe_price_id, priceId),
    });
  }

  public async getAllPlans() {
    return db.select().from(subscriptionPlanSchema);
  }

  public async createSubscription(data: {
    user_id: number;
    object: string;
    amount_subtotal: number;
    amount_total: number;
    session_id: string;
    cancel_url: string;
    success_url: string;
    created: number;
    currency: string;
    mode: string;
    payment_status: string;
    status: string;
    subscription_id: string | null;
  }) {
    return db.insert(subscriptionSchema).values(data).$returningId();
  }

  public async findSubscriptionBySessionId(sessionId: string) {
    return db.query.subscriptionSchema.findFirst({
      where: eq(subscriptionSchema.session_id, sessionId),
    });
  }
}
