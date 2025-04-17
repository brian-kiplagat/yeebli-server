import { and, desc, eq, like, or } from "drizzle-orm";
import { db } from "../lib/database.ts";
import { type Lead, type NewLead, leadSchema } from "../schema/schema.js";
import { eventSchema, memberships } from "../schema/schema.js";

export interface LeadQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export class LeadRepository {
  public async create(lead: NewLead) {
    return db.insert(leadSchema).values(lead).$returningId();
  }

  public async find(id: number) {
    return db.query.leadSchema.findFirst({
      where: eq(leadSchema.id, id),
      with: {
        event: true,
      },
    });
  }

  public async findByEventId(eventId: number) {
    return db.query.leadSchema.findMany({
      where: eq(leadSchema.event_id, eventId),
    });
  }

  public async findByEventIdAndToken(eventId: number, token: string) {
    return db.query.leadSchema.findFirst({
      where: and(eq(leadSchema.event_id, eventId), eq(leadSchema.token, token)),
    });
  }

  public async findAll(query?: LeadQuery) {
    const { page = 1, limit = 100, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? or(
          like(leadSchema.name, `%${search}%`),
          like(leadSchema.email, `%${search}%`),
          like(leadSchema.phone, `%${search}%`)
        )
      : undefined;

    const leads = await db.query.leadSchema.findMany({
      where: whereConditions,
      limit: limit,
      offset: offset,
      with: {
        event: true,
        membership: true,
      },
      orderBy: desc(leadSchema.created_at),
    });

    const total = await db
      .select({ count: leadSchema.id })
      .from(leadSchema)
      .where(whereConditions);

    return { leads, total: total.length };
  }

  public async findByUserId(userId: number, query?: LeadQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? and(
          eq(leadSchema.userId, userId),
          or(
            like(leadSchema.name, `%${search}%`),
            like(leadSchema.email, `%${search}%`),
            like(leadSchema.phone, `%${search}%`)
          )
        )
      : eq(leadSchema.userId, userId);

    const leads = await db.query.leadSchema.findMany({
      where: whereConditions,
      limit: limit,
      offset: offset,
      with: {
        event: true,
        membership: true,
      },
      orderBy: desc(leadSchema.created_at),
    });

    const total = await db
      .select({ count: leadSchema.id })
      .from(leadSchema)
      .where(whereConditions);

    return { leads, total: total.length };
  }

  public async findByUserIdWithEvents(userId: number, query?: LeadQuery) {
    const { page = 1, limit = 50, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = search
      ? and(
          eq(leadSchema.userId, userId),
          or(
            like(leadSchema.name, `%${search}%`),
            like(leadSchema.email, `%${search}%`),
            like(leadSchema.phone, `%${search}%`)
          )
        )
      : eq(leadSchema.userId, userId);

    const leads = await db
      .select({
        lead: leadSchema,
        event: {
          id: eventSchema.id,
          name: eventSchema.event_name,
          description: eventSchema.event_description,
          type: eventSchema.event_type,
          status: eventSchema.status,
          start_date: eventSchema.dates,
          live_video_url: eventSchema.live_video_url,
          live_venue_address: eventSchema.live_venue_address,
          created_at: eventSchema.created_at,
          updated_at: eventSchema.updated_at,
        },
        membership: {
          id: memberships.id,
          name: memberships.name,
          price: memberships.price,
          payment_type: memberships.payment_type,
        },
      })
      .from(leadSchema)
      .leftJoin(eventSchema, eq(leadSchema.event_id, eventSchema.id))
      .leftJoin(memberships, eq(leadSchema.membership_level, memberships.id))
      .where(whereConditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(leadSchema.created_at));

    const total = await db
      .select({ count: leadSchema.id })
      .from(leadSchema)
      .where(whereConditions);

    return { leads, total: total.length };
  }

  public async update(id: number, lead: Partial<Lead>) {
    return db.update(leadSchema).set(lead).where(eq(leadSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(leadSchema).where(eq(leadSchema.id, id));
  }
}
