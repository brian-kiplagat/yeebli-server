import { and, desc, eq, like, or } from 'drizzle-orm';
import { db } from '../lib/database.js';
import { assetsSchema, eventDates, eventSchema, userSchema } from '../schema/schema.js';
import type { Event, NewEvent, NewEventDate } from '../schema/schema.js';

export interface EventQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export class EventRepository {
  public async create(event: NewEvent) {
    return db.insert(eventSchema).values(event).$returningId();
  }

  public async createEventDate(eventDate: NewEventDate) {
    return db.insert(eventDates).values(eventDate).$returningId();
  }

  public async find(id: number) {
    const result = await db
      .select({
        event: eventSchema,
        asset: assetsSchema,
        host: {
          name: userSchema.name,
          email: userSchema.email,
          profile_image: userSchema.profile_picture,
        },
        dates: eventDates,
      })
      .from(eventSchema)
      .leftJoin(assetsSchema, eq(eventSchema.asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(eventSchema.host_id, userSchema.id))
      .leftJoin(eventDates, eq(eventSchema.id, eventDates.event_id))
      .where(eq(eventSchema.id, id))
      .limit(1);

    return result[0];
  }

  public async findAll(query?: EventQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? or(like(eventSchema.event_name, `%${search}%`), like(eventSchema.event_description, `%${search}%`))
      : undefined;

    const events = await db
      .select()
      .from(eventSchema)
      .where(whereConditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(eventSchema.created_at));

    const total = await db.select({ count: eventSchema.id }).from(eventSchema).where(whereConditions);

    return { events, total: total.length };
  }

  public async findByUserId(userId: number, query?: EventQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? and(
          eq(eventSchema.host_id, userId),
          or(like(eventSchema.event_name, `%${search}%`), like(eventSchema.event_description, `%${search}%`)),
        )
      : eq(eventSchema.host_id, userId);

    const events = await db
      .select()
      .from(eventSchema)
      .where(whereConditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(eventSchema.created_at));

    const total = await db.select({ count: eventSchema.id }).from(eventSchema).where(whereConditions);

    return { events, total: total.length };
  }

  public async update(id: number, event: Partial<Event>) {
    return db.update(eventSchema).set(event).where(eq(eventSchema.id, id));
  }

  public async cancel(id: number, status: 'cancelled' | 'active' | 'suspended') {
    return db.update(eventSchema).set({ status }).where(eq(eventSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(eventSchema).where(eq(eventSchema.id, id));
  }

  public async findByAssetId(assetId: number) {
    const result = await db.select().from(eventSchema).where(eq(eventSchema.asset_id, assetId)).limit(1);
    return result[0];
  }
}
