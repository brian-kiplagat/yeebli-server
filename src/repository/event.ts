import { eq } from "drizzle-orm";
import { db } from "../lib/database.js";
import { eventSchema, assetsSchema } from "../schema/schema.js";
import type { Event, NewEvent } from "../schema/schema.js";

export class EventRepository {
  public async create(event: NewEvent) {
    return db.insert(eventSchema).values(event).$returningId();
  }

  public async find(id: number) {
    const result = await db
      .select({
        event: eventSchema,
        asset: assetsSchema,
      })
      .from(eventSchema)
      .leftJoin(assetsSchema, eq(eventSchema.asset_id, assetsSchema.id))
      .where(eq(eventSchema.id, id))
      .limit(1);

    return result[0];
  }

  public async findAll() {
    return db.query.eventSchema.findMany();
  }

  public async findByUserId(userId: number) {
    return db.query.eventSchema.findMany({
      where: eq(eventSchema.host_id, userId),
    });
  }

  public async update(id: number, event: Partial<Event>) {
    return db.update(eventSchema).set(event).where(eq(eventSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(eventSchema).where(eq(eventSchema.id, id));
  }
}
