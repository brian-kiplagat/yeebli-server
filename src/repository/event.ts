import { and, desc, eq, inArray, like, or } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { Event, NewEvent } from '../schema/schema.js';
import {
  assetsSchema,
  bookings,
  eventMembershipSchema,
  eventSchema,
  membershipDates,
  memberships,
  userSchema,
} from '../schema/schema.js';

export interface EventQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export class EventRepository {
  public async create(event: NewEvent, membership_ids: number[]) {
    const [eventId] = await db.insert(eventSchema).values(event).$returningId();
    await db.insert(eventMembershipSchema).values(
      membership_ids.map((id) => ({
        event_id: eventId.id,
        membership_id: id,
      })),
    );
    return eventId.id;
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
      .where(eq(eventSchema.id, id))
      .limit(1);

    // Get all memberships for this event
    const eventMemberships = await db
      .select({
        id: eventMembershipSchema.id,
        created_at: eventMembershipSchema.created_at,
        updated_at: eventMembershipSchema.updated_at,
        event_id: eventMembershipSchema.event_id,
        membership_id: eventMembershipSchema.membership_id,
        membership: memberships,
        dates: membershipDates,
      })
      .from(eventMembershipSchema)
      .innerJoin(memberships, eq(eventMembershipSchema.membership_id, memberships.id))
      .leftJoin(membershipDates, eq(memberships.id, membershipDates.membership_id))
      .where(eq(eventMembershipSchema.event_id, id));

    // Group dates by membership
    const membershipsWithDates = eventMemberships.reduce(
      (acc, em) => {
        if (!acc[em.membership_id]) {
          acc[em.membership_id] = {
            ...em,
            dates: [],
          };
        }
        if (em.dates) {
          acc[em.membership_id].dates.push(em.dates);
        }
        return acc;
      },
      {} as Record<number, any>,
    );

    return {
      ...result[0],
      memberships: Object.values(membershipsWithDates).map((m) => ({
        ...m.membership,
        dates: m.dates,
      })),
    };
  }

  public async findAll(query?: EventQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? and(
          eq(eventSchema.status, 'active'),
          or(
            like(eventSchema.event_name, `%${search}%`),
            like(eventSchema.event_description, `%${search}%`),
          ),
        )
      : eq(eventSchema.status, 'active');

    // First get the events with their basic info
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

    // Get memberships for these events
    const eventIds = events.map((e) => e.event.id);
    const eventMemberships = await db
      .select({
        event_id: eventMembershipSchema.event_id,
        membership: memberships,
      })
      .from(eventMembershipSchema)
      .innerJoin(memberships, eq(eventMembershipSchema.membership_id, memberships.id))
      .where(inArray(eventMembershipSchema.event_id, eventIds));

    // Map dates and memberships to events
    const eventsWithRelations = events.map((event) => ({
      ...event,
      memberships: eventMemberships
        .filter((em) => em.event_id === event.event.id)
        .map((em) => em.membership),
    }));

    const total = await db
      .select({ count: eventSchema.id })
      .from(eventSchema)
      .where(whereConditions);

    return { events: eventsWithRelations, total: total.length };
  }

  public async findByUserId(userId: number, query?: EventQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? and(
          eq(eventSchema.host_id, userId),
          eq(eventSchema.status, 'active'),
          or(
            like(eventSchema.event_name, `%${search}%`),
            like(eventSchema.event_description, `%${search}%`),
          ),
        )
      : and(eq(eventSchema.host_id, userId), eq(eventSchema.status, 'active'));

    // First get the events with their basic info
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

    // Get memberships for these events
    const eventIds = events.map((e) => e.event.id);
    const eventMemberships = await db
      .select({
        event_id: eventMembershipSchema.event_id,
        membership: memberships,
      })
      .from(eventMembershipSchema)
      .innerJoin(memberships, eq(eventMembershipSchema.membership_id, memberships.id))
      .where(inArray(eventMembershipSchema.event_id, eventIds));

    // Map dates and memberships to events
    const eventsWithRelations = events.map((event) => ({
      ...event,
      memberships: eventMemberships
        .filter((em) => em.event_id === event.event.id)
        .map((em) => em.membership),
    }));

    const total = await db
      .select({ count: eventSchema.id })
      .from(eventSchema)
      .where(whereConditions);

    return { events: eventsWithRelations, total: total.length };
  }

  public async update(id: number, event: Partial<Event>) {
    return db.update(eventSchema).set(event).where(eq(eventSchema.id, id));
  }

  public async cancel(id: number, status: 'cancelled' | 'active' | 'suspended') {
    return db.update(eventSchema).set({ status }).where(eq(eventSchema.id, id));
  }

  public async delete(id: number) {
    await db.delete(eventMembershipSchema).where(eq(eventMembershipSchema.event_id, id));
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

  public async findBookingsByEventId(eventId: number) {
    return db.select().from(bookings).where(eq(bookings.event_id, eventId));
  }

  public async findEventDate(dateId: number) {
    const result = await db
      .select()
      .from(membershipDates)
      .where(eq(membershipDates.id, dateId))
      .limit(1);
    return result[0];
  }

  public async findMembershipsByEventId(eventId: number) {
    return db
      .select({
        id: eventMembershipSchema.id,
        created_at: eventMembershipSchema.created_at,
        updated_at: eventMembershipSchema.updated_at,
        event_id: eventMembershipSchema.event_id,
        membership_id: eventMembershipSchema.membership_id,
        membership: memberships,
      })
      .from(eventMembershipSchema)
      .innerJoin(memberships, eq(eventMembershipSchema.membership_id, memberships.id))
      .where(eq(eventMembershipSchema.event_id, eventId));
  }

  public async deleteEventMemberships(eventId: number, membershipIds?: number[]) {
    if (membershipIds) {
      return db
        .delete(eventMembershipSchema)
        .where(
          and(
            eq(eventMembershipSchema.event_id, eventId),
            inArray(eventMembershipSchema.membership_id, membershipIds),
          ),
        );
    }
    return db.delete(eventMembershipSchema).where(eq(eventMembershipSchema.event_id, eventId));
  }

  public async addMemberships(eventId: number, membershipIds: number[]) {
    return db.insert(eventMembershipSchema).values(
      membershipIds.map((id) => ({
        event_id: eventId,
        membership_id: id,
      })),
    );
  }
}
