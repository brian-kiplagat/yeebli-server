import { eq } from 'drizzle-orm';
import { db } from '../lib/database.js';
import { eventSchema } from '../schema/schema.js';
import type { Event, NewEvent } from '../schema/schema.js';

export class EventRepository {
  public async create(event: NewEvent) {
    return db.insert(eventSchema).values(event).$returningId();
  }

  public async find(id: number) {
    return db.query.eventSchema.findFirst({
      where: eq(eventSchema.id, id),
    });
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
