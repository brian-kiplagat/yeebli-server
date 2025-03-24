import { eq } from "drizzle-orm";
import { db } from "../lib/database.js";
import { subscriptionPlanSchema } from "../schema/schema.js";

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
}
