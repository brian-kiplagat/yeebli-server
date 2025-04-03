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
      })
      .from(eventSchema)
      .leftJoin(assetsSchema, eq(eventSchema.asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(eventSchema.host_id, userSchema.id))
      .leftJoin(bookings, eq(eventSchema.id, bookings.event_id))
      .where(eq(eventSchema.id, id))
      .limit(1);
    //Then, get all dates for these events in a single query
    const dates = await db
      .select()
      .from(eventDates)
      .where(eq(eventDates.event_id, id));

    // Get membership information for lead levels
    const event = result[0].event;
    const leadLevels = event.lead_level as string[];
    const membershipDetails = await db
      .select()
      .from(memberships)
      .where(
        inArray(
          memberships.id,
          leadLevels.map((id) => Number(id))
        )
      );

    return { ...result[0], dates: dates, memberships: membershipDetails };
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

    // First, get all events with their basic info
    const events = await db
      .select({
        event: eventSchema,
        asset: assetsSchema,
        host: {
          name: userSchema.name,
          email: userSchema.email,
          profile_image: userSchema.profile_picture,
        },
      })
      .from(eventSchema)
      .leftJoin(assetsSchema, eq(eventSchema.asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(eventSchema.host_id, userSchema.id))
      .where(whereConditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(eventSchema.created_at));

    // Then, get all dates for these events in a single query
    const eventIds = events.map((e) => e.event.id);
    const dates = await db
      .select()
      .from(eventDates)
      .where(inArray(eventDates.event_id, eventIds));

    // Get all unique lead level IDs across all events
    const allLeadLevels = events.flatMap((e) => e.event.lead_level as string[]);
    const uniqueLeadLevels = [...new Set(allLeadLevels)].map((id) =>
      Number(id)
    );

    // Get membership information for all lead levels
    const membershipDetails = await db
      .select()
      .from(memberships)
      .where(inArray(memberships.id, uniqueLeadLevels));

    // Create a map of membership ID to membership details
    const membershipMap = new Map(
      membershipDetails.map((m) => [m.id.toString(), m])
    );

    // Combine events with their dates and memberships
    const eventsWithDates = events.map((event) => {
      const eventLeadLevels = event.event.lead_level as string[];
      const eventMemberships = eventLeadLevels
        .map((id) => membershipMap.get(id))
        .filter(Boolean);

      return {
        ...event,
        dates: dates.filter((d) => d.event_id === event.event.id),
        memberships: eventMemberships,
      };
    });

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

    // First, get all events with their basic info
    const events = await db
      .select({
        event: eventSchema,
        asset: assetsSchema,
        host: {
          name: userSchema.name,
          email: userSchema.email,
          profile_image: userSchema.profile_picture,
        },
      })
      .from(eventSchema)
      .leftJoin(assetsSchema, eq(eventSchema.asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(eventSchema.host_id, userSchema.id))
      .where(whereConditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(eventSchema.created_at));

    // Then, get all dates for these events in a single query
    const eventIds = events.map((e) => e.event.id);
    const dates = await db
      .select()
      .from(eventDates)
      .where(inArray(eventDates.event_id, eventIds));

    // Get all unique lead level IDs across all events
    const allLeadLevels = events.flatMap((e) => e.event.lead_level as string[]);
    const uniqueLeadLevels = [...new Set(allLeadLevels)].map((id) =>
      Number(id)
    );

    // Get membership information for all lead levels
    const membershipDetails = await db
      .select()
      .from(memberships)
      .where(inArray(memberships.id, uniqueLeadLevels));

    // Create a map of membership ID to membership details
    const membershipMap = new Map(
      membershipDetails.map((m) => [m.id.toString(), m])
    );

    // Combine events with their dates and memberships
    const eventsWithDates = events.map((event) => {
      const eventLeadLevels = event.event.lead_level as string[];
      const eventMemberships = eventLeadLevels
        .map((id) => membershipMap.get(id))
        .filter(Boolean);

      return {
        ...event,
        dates: dates.filter((d) => d.event_id === event.event.id),
        memberships: eventMemberships,
      };
    });

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
