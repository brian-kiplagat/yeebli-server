import { db } from "../lib/database.js";
import { paymentSchema } from "../schema/schema.js";
import { eq } from "drizzle-orm";
import type { NewPayment } from "../schema/schema.js";

export class PaymentRepository {
  public async createPayment(data: NewPayment) {
    return db.insert(paymentSchema).values(data).$returningId();
  }

  public async findPaymentsByContactId(contactId: number) {
    return db.query.paymentSchema.findMany({
      where: eq(paymentSchema.contact_id, contactId),
    });
  }

  public async updatePayment(
    id: number,
    data: Partial<typeof paymentSchema.$inferInsert>
  ) {
    return db.update(paymentSchema).set(data).where(eq(paymentSchema.id, id));
  }
}
