import { db } from "../lib/database.ts";
import { callbackSchema } from "../schema/schema.ts";
import { eq, and } from "drizzle-orm";
import type { NewCallback } from "../schema/schema.ts";

export class CallbackRepository {
  public async createCallback(data: NewCallback) {
    return db.insert(callbackSchema).values(data).$returningId();
  }

  public async findCallbackById(id: number) {
    return db.query.callbackSchema.findFirst({
      where: eq(callbackSchema.id, id),
    });
  }

  public async findCallbacksByLeadId(leadId: number) {
    return db.query.callbackSchema.findMany({
      where: eq(callbackSchema.lead_id, leadId),
    });
  }

  public async findUncalledCallbacks(hostId: number) {
    return db.query.callbackSchema.findMany({
      where: and(
        eq(callbackSchema.status, "uncalled"),
        eq(callbackSchema.host_id, hostId)
      ),
    });
  }

  public async findScheduledCallbacks() {
    return db.query.callbackSchema.findMany({
      where: eq(callbackSchema.callback_type, "scheduled"),
    });
  }

  public async findCallbackByLeadIdAndEventIdAndCallbackType(
    leadId: number,
    eventId: number,
    callbackType: "instant" | "scheduled"
  ) {
    return db.query.callbackSchema.findFirst({
      where: and(
        eq(callbackSchema.lead_id, leadId),
        eq(callbackSchema.event_id, eventId),
        eq(callbackSchema.callback_type, callbackType)
      ),
    });
  }

  public async updateCallback(
    id: number,
    data: Partial<typeof callbackSchema.$inferInsert>
  ) {
    return db.update(callbackSchema).set(data).where(eq(callbackSchema.id, id));
  }

  public async deleteCallback(id: number) {
    return db.delete(callbackSchema).where(eq(callbackSchema.id, id));
  }

  public async markCallbackAsCalled(id: number) {
    return this.updateCallback(id, { status: "called" });
  }
}
