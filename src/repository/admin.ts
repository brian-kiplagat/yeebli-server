import { and, asc, desc, eq, like, or } from 'drizzle-orm';
import { db } from '../lib/database.js';
import { eventSchema, leadSchema, userSchema } from '../schema/schema.js';
import type { AdminEventQuery, AdminLeadQuery, AdminUserQuery } from '../web/validator/admin.js';

export class AdminRepository {
  async getUsers(query: AdminUserQuery) {
    const { page = 1, limit = 10, role, search } = query;
    const offset = (page - 1) * limit;

    const whereClause = [];
    if (role) whereClause.push(eq(userSchema.role, role));
    if (search) {
      whereClause.push(or(like(userSchema.name, `%${search}%`), like(userSchema.email, `%${search}%`)));
    }

    const users = await db
      .select()
      .from(userSchema)
      .where(whereClause.length ? and(...whereClause) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(userSchema.createdAt));

    const total = await db
      .select({ count: userSchema.id })
      .from(userSchema)
      .where(whereClause.length ? and(...whereClause) : undefined);

    return { users, total: total.length };
  }

  async getLeads(query: AdminLeadQuery) {
    const { page = 1, limit = 10, status, membership_level, search } = query;
    const offset = (page - 1) * limit;

    const whereClause = [];
    if (status) whereClause.push(eq(leadSchema.status_identifier, status));
    if (membership_level) whereClause.push(eq(leadSchema.membership_level, membership_level));
    if (search) {
      whereClause.push(
        or(
          like(leadSchema.name, `%${search}%`),
          like(leadSchema.email, `%${search}%`),
          like(leadSchema.phone, `%${search}%`),
        ),
      );
    }

    const leads = await db
      .select()
      .from(leadSchema)
      .where(whereClause.length ? and(...whereClause) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(leadSchema.created_at));

    const total = await db
      .select({ count: leadSchema.id })
      .from(leadSchema)
      .where(whereClause.length ? and(...whereClause) : undefined);

    return { leads, total: total.length };
  }

  async getEvents(query: AdminEventQuery) {
    const { page = 1, limit = 10, search, date_range } = query;
    const offset = (page - 1) * limit;

    const whereClause = [];
    if (search) {
      whereClause.push(
        or(like(eventSchema.event_name, `%${search}%`), like(eventSchema.event_description, `%${search}%`)),
      );
    }
    if (date_range) {
      whereClause.push(
        and(like(eventSchema.event_date, `%${date_range.start}%`), like(eventSchema.event_date, `%${date_range.end}%`)),
      );
    }

    const events = await db
      .select()
      .from(eventSchema)
      .where(whereClause.length ? and(...whereClause) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(asc(eventSchema.event_date));

    const total = await db
      .select({ count: eventSchema.id })
      .from(eventSchema)
      .where(whereClause.length ? and(...whereClause) : undefined);

    return { events, total: total.length };
  }
}
