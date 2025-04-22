import { eq } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { NewPayment } from '../schema/schema.js';
import { paymentSchema } from '../schema/schema.js';

export class PaymentRepository {
  public async createPayment(data: NewPayment) {
    return db.insert(paymentSchema).values(data).$returningId();
  }

  public async findPaymentsByContactId(contactId: number) {
    return db.query.paymentSchema.findMany({
      where: eq(paymentSchema.contact_id, contactId),
    });
  }

  public async findPaymentsByLeadId(leadId: number) {
    return db.query.paymentSchema.findMany({
      where: eq(paymentSchema.lead_id, leadId),
    });
  }

  public async updatePayment(id: number, data: Partial<typeof paymentSchema.$inferInsert>) {
    return db.update(paymentSchema).set(data).where(eq(paymentSchema.id, id));
  }

  public async updatePaymentBySessionId(
    sessionId: string,
    data: Partial<typeof paymentSchema.$inferInsert>,
  ) {
    return db
      .update(paymentSchema)
      .set(data)
      .where(eq(paymentSchema.checkout_session_id, sessionId));
  }
}
