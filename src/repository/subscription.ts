import { eq } from 'drizzle-orm';

import { db } from '../lib/database.js';
import { subscriptionSchema } from '../schema/schema.js';

export class SubscriptionRepository {
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

  public async findSubscriptionsByUserId(userId: number) {
    return db.query.subscriptionSchema.findMany({
      where: eq(subscriptionSchema.user_id, userId),
      orderBy: (subscription, { desc }) => [desc(subscription.created)],
    });
  }
}
