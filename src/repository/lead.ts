import { and, desc, eq, like, or } from 'drizzle-orm';

import { db } from '../lib/database.ts';
import {
  eventSchema,
  type Lead,
  leadSchema,
  memberships,
  type NewLead,
  NewTag,
  tagsSchema,
} from '../schema/schema.js';

export interface LeadQuery {
  page?: number;
  limit?: number;
  search?: string;
}

interface LeadWithEvents extends Omit<Lead, 'membership'> {
  events: Lead['event'][];
  membership: {
    id: number;
    name: string;
    created_at: Date | null;
    updated_at: Date | null;
    user_id: number;
    description: string | null;
    price: number;
    payment_type: 'one_off' | 'recurring' | null;
  } | null;
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

  public async findTagsByLeadId(leadId: number) {
    return db.query.tagsSchema.findMany({
      where: eq(tagsSchema.lead_id, leadId),
    });
  }

  public async createTag(tag: NewTag) {
    return db.insert(tagsSchema).values(tag).$returningId();
  }

  public async deleteTag(tagId: number) {
    return db.delete(tagsSchema).where(eq(tagsSchema.id, tagId));
  }

  public async findTag(tagId: number) {
    return db.query.tagsSchema.findFirst({ where: eq(tagsSchema.id, tagId) });
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
          like(leadSchema.phone, `%${search}%`),
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

    const total = await db.select({ count: leadSchema.id }).from(leadSchema).where(whereConditions);

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
            like(leadSchema.phone, `%${search}%`),
          ),
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

    const total = await db.select({ count: leadSchema.id }).from(leadSchema).where(whereConditions);

    return { leads, total: total.length };
  }

  public async findByUserIdWithEvents(
    userId: number,
    query: LeadQuery = {},
  ): Promise<LeadWithEvents[]> {
    const { page = 1, limit = 10, search = '' } = query;
    const offset = (page - 1) * limit;

    const leads = await db
      .select({
        id: leadSchema.id,
        name: leadSchema.name,
        email: leadSchema.email,
        phone: leadSchema.phone,
        event_id: leadSchema.event_id,
        registered_date: leadSchema.registered_date,
        membership_active: leadSchema.membership_active,
        form_identifier: leadSchema.form_identifier,
        host_id: leadSchema.host_id,
        token: leadSchema.token,
        status_identifier: leadSchema.status_identifier,
        lead_status: leadSchema.lead_status,
        source_url: leadSchema.source_url,
        membership_level: leadSchema.membership_level,
        userId: leadSchema.userId,
        created_at: leadSchema.created_at,
        updated_at: leadSchema.updated_at,
        events: {
          id: eventSchema.id,
          event_name: eventSchema.event_name,
          event_description: eventSchema.event_description,
          event_type: eventSchema.event_type,
          asset_id: eventSchema.asset_id,
          created_at: eventSchema.created_at,
          updated_at: eventSchema.updated_at,
          status: eventSchema.status,
          live_video_url: eventSchema.live_video_url,
          success_url: eventSchema.success_url,
          instructions: eventSchema.instructions,
          landing_page_url: eventSchema.landing_page_url,
          live_venue_address: eventSchema.live_venue_address,
          host_id: eventSchema.host_id,
        },
        membership: {
          id: memberships.id,
          name: memberships.name,
          created_at: memberships.created_at,
          updated_at: memberships.updated_at,
          user_id: memberships.user_id,
          description: memberships.description,
          price: memberships.price,
          payment_type: memberships.payment_type,
        },
      })
      .from(leadSchema)
      .leftJoin(eventSchema, eq(leadSchema.event_id, eventSchema.id))
      .leftJoin(memberships, eq(leadSchema.membership_level, memberships.id))
      .where(
        and(
          eq(leadSchema.userId, userId),
          or(
            like(leadSchema.name, `%${search}%`),
            like(leadSchema.email, `%${search}%`),
            like(leadSchema.phone, `%${search}%`),
          ),
        ),
      )
      .orderBy(desc(leadSchema.created_at))
      .limit(limit)
      .offset(offset);

    // Group events by lead and ensure unique emails
    const uniqueLeads = new Map<string, any>();

    leads.forEach((lead) => {
      if (lead.email) {
        if (!uniqueLeads.has(lead.email)) {
          // Initialize the lead with its first event
          uniqueLeads.set(lead.email, {
            ...lead,
            events: lead.events ? [lead.events] : [],
          });
        } else {
          // Add additional events to existing lead if they're not already included
          const existingLead = uniqueLeads.get(lead.email);
          if (lead.events?.id && !existingLead.events.some((e: any) => e.id === lead.events?.id)) {
            existingLead.events.push(lead.events);
          }
        }
      }
    });

    const uniqueLeadsArray = Array.from(uniqueLeads.values());
    return uniqueLeadsArray;
  }

  public async update(id: number, lead: Partial<Lead>) {
    return db.update(leadSchema).set(lead).where(eq(leadSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(leadSchema).where(eq(leadSchema.id, id));
  }

  async findLeadEventsByUserId(leadId: number, userId: number) {
    const lead = await db
      .select({
        id: leadSchema.id,
        name: leadSchema.name,
        email: leadSchema.email,
        phone: leadSchema.phone,
        event_id: leadSchema.event_id,
        registered_date: leadSchema.registered_date,
        membership_active: leadSchema.membership_active,
        form_identifier: leadSchema.form_identifier,
        host_id: leadSchema.host_id,
        token: leadSchema.token,
        status_identifier: leadSchema.status_identifier,
        lead_status: leadSchema.lead_status,
        source_url: leadSchema.source_url,
        membership_level: leadSchema.membership_level,
        userId: leadSchema.userId,
        created_at: leadSchema.created_at,
        updated_at: leadSchema.updated_at,
        events: {
          id: eventSchema.id,
          event_name: eventSchema.event_name,
          event_description: eventSchema.event_description,
          event_type: eventSchema.event_type,
          asset_id: eventSchema.asset_id,
          created_at: eventSchema.created_at,
          updated_at: eventSchema.updated_at,
          status: eventSchema.status,
          live_video_url: eventSchema.live_video_url,
          success_url: eventSchema.success_url,
          instructions: eventSchema.instructions,
          landing_page_url: eventSchema.landing_page_url,
          live_venue_address: eventSchema.live_venue_address,
          host_id: eventSchema.host_id,
        },
      })
      .from(leadSchema)
      .leftJoin(eventSchema, eq(leadSchema.event_id, eventSchema.id))
      .where(and(eq(leadSchema.id, leadId), eq(eventSchema.host_id, userId)))
      .limit(1);

    return lead[0];
  }
}
