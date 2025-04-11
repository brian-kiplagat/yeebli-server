import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { number } from "zod";
import { db } from "../lib/database.js";
import {
  assetsSchema,
  bookings,
  eventDates,
  eventSchema,
  memberships,
  userSchema,
} from "../schema/schema.js";
import type { Event, NewEvent, NewEventDate } from "../schema/schema.js";

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

  public async updateEventDate(dateId: number, data: { date: string }) {
    return db.update(eventDates).set(data).where(eq(eventDates.id, dateId));
  }

  public async find(id: number) {
    const result = await db
      .select({
        event: eventSchema,
        asset: assetsSchema,
        membership: memberships,
        host: {
          name: userSchema.name,
          email: userSchema.email,
          profile_image: userSchema.profile_picture,
        },
      })
      .from(eventSchema)
      .leftJoin(assetsSchema, eq(eventSchema.asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(eventSchema.host_id, userSchema.id))
      .leftJoin(bookings, eq(eventSchema.id, bookings.event_id))
      .leftJoin(eventDates, eq(eventSchema.id, eventDates.event_id))
      .where(eq(eventSchema.id, id))
      .limit(1);
    //Then, get all dates for these events in a single query
    const dates = await db
      .select()
      .from(eventDates)
      .where(eq(eventDates.event_id, id));

    // Get membership information for lead levels
    const event = result[0].event;

    return { ...result[0], dates: dates };
  }

  public async findAll(query?: EventQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? or(
          like(eventSchema.event_name, `%${search}%`),
          like(eventSchema.event_description, `%${search}%`)
        )
      : undefined;

    // First get the events with their basic info
    const events = await db
      .select({
        event: eventSchema,
        asset: assetsSchema,
        membership: memberships,
        host: {
          name: userSchema.name,
          email: userSchema.email,
          profile_image: userSchema.profile_picture,
        },
      })
      .from(eventSchema)
      .leftJoin(assetsSchema, eq(eventSchema.asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(eventSchema.host_id, userSchema.id))
      .leftJoin(memberships, eq(eventSchema.membership_id, memberships.id))
      .where(whereConditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(eventSchema.created_at));

    // Then get all dates for these events
    const eventIds = events.map((e) => e.event.id);
    const dates = await db
      .select()
      .from(eventDates)
      .where(inArray(eventDates.event_id, eventIds));

    // Map dates to events
    const eventsWithDates = events.map((event) => ({
      ...event,
      dates: dates.filter((d) => d.event_id === event.event.id),
    }));

    const total = await db
      .select({ count: eventSchema.id })
      .from(eventSchema)
      .where(whereConditions);

    return { events: eventsWithDates, total: total.length };
  }

  public async findByUserId(userId: number, query?: EventQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? and(
          eq(eventSchema.host_id, userId),
          or(
            like(eventSchema.event_name, `%${search}%`),
            like(eventSchema.event_description, `%${search}%`)
          )
        )
      : eq(eventSchema.host_id, userId);

    // First get the events with their basic info
    const events = await db
      .select({
        event: eventSchema,
        asset: assetsSchema,
        membership: memberships,
        host: {
          name: userSchema.name,
          email: userSchema.email,
          profile_image: userSchema.profile_picture,
        },
      })
      .from(eventSchema)
      .leftJoin(assetsSchema, eq(eventSchema.asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(eventSchema.host_id, userSchema.id))
      .leftJoin(memberships, eq(eventSchema.membership_id, memberships.id))
      .where(whereConditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(eventSchema.created_at));

    // Then get all dates for these events
    const eventIds = events.map((e) => e.event.id);
    const dates = await db
      .select()
      .from(eventDates)
      .where(inArray(eventDates.event_id, eventIds));

    // Map dates to events
    const eventsWithDates = events.map((event) => ({
      ...event,
      dates: dates.filter((d) => d.event_id === event.event.id),
    }));

    const total = await db
      .select({ count: eventSchema.id })
      .from(eventSchema)
      .where(whereConditions);

    return { events: eventsWithDates, total: total.length };
  }

  public async update(id: number, event: Partial<Event>) {
    return db.update(eventSchema).set(event).where(eq(eventSchema.id, id));
  }

  public async cancel(
    id: number,
    status: "cancelled" | "active" | "suspended"
  ) {
    return db.update(eventSchema).set({ status }).where(eq(eventSchema.id, id));
  }

  public async delete(id: number) {
    await db.delete(eventDates).where(eq(eventDates.event_id, id));
    await db.delete(bookings).where(eq(bookings.event_id, id));
    return db.delete(eventSchema).where(eq(eventSchema.id, id));
  }

  public async findByAssetId(assetId: number) {
    const result = await db
      .select()
      .from(eventSchema)
      .where(eq(eventSchema.asset_id, assetId))
      .limit(1);
    return result[0];
  }

  public async findEventDate(dateId: number) {
    const result = await db
      .select()
      .from(eventDates)
      .where(eq(eventDates.id, dateId))
      .limit(1);
    return result[0];
  }

  public async findBookingsByDateId(dateId: number) {
    return db.select().from(bookings).where(eq(bookings.date_id, dateId));
  }

  public async deleteEventDate(dateId: number) {
    return db.delete(eventDates).where(eq(eventDates.id, dateId));
  }
}
