import { and, asc, eq, inArray, like } from 'drizzle-orm';

import { db } from '../lib/database.ts';
import type { Membership, NewMembership, NewMembershipDate } from '../schema/schema.ts';
import {
  eventMembershipSchema,
  eventSchema,
  membershipDates,
  memberships,
} from '../schema/schema.ts';

export type MembershipQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export class MembershipRepository {
  async create(plan: NewMembership): Promise<number> {
    const result = await db.insert(memberships).values(plan).$returningId();
    return result[0].id;
  }

  async find(id: number): Promise<Membership | undefined> {
    const result = await db.select().from(memberships).where(eq(memberships.id, id)).limit(1);
    return result[0];
  }

  async findMultiple(ids: number[]): Promise<Membership[]> {
    if (ids.length === 0) return [];
    return await db.select().from(memberships).where(inArray(memberships.id, ids));
  }

  async findAll(query?: MembershipQuery) {
    const { page = 1, limit = 10, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = [];
    if (search) {
      whereConditions.push(like(memberships.name, `%${search}%`));
    }

    const plans = await db
      .select()
      .from(memberships)
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset)
      .orderBy(asc(memberships.price));

    const total = await db
      .select({ count: memberships.id })
      .from(memberships)
      .where(and(...whereConditions));

    return { plans, total: total.length };
  }

  async update(id: number, plan: Partial<Membership>): Promise<void> {
    await db.update(memberships).set(plan).where(eq(memberships.id, id));
  }

  async delete(id: number): Promise<void> {
    await db.delete(memberships).where(eq(memberships.id, id));
  }

  async findByUserId(userId: number, query?: MembershipQuery) {
    const { page = 1, limit = 10, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = [eq(memberships.user_id, userId)];
    if (search) {
      whereConditions.push(like(memberships.name, `%${search}%`));
    }

    const plans = await db
      .select({
        membership: memberships,
        date: membershipDates,
      })
      .from(memberships)
      .leftJoin(membershipDates, eq(membershipDates.membership_id, memberships.id))
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset)
      .orderBy(asc(memberships.price));

    const total = await db
      .select({ count: memberships.id })
      .from(memberships)
      .where(and(...whereConditions));

    return { plans, total: total.length };
  }

  async getEventsByMembership(membershipId: number) {
    return await db
      .select()
      .from(eventSchema)
      .innerJoin(eventMembershipSchema, eq(eventSchema.id, eventMembershipSchema.event_id))
      .where(eq(eventMembershipSchema.membership_id, membershipId));
  }

  public async createMembershipDate(membershipDate: NewMembershipDate) {
    return db.insert(membershipDates).values(membershipDate).$returningId();
  }

  public async getMembershipDates(membershipId: number) {
    return await db
      .select()
      .from(membershipDates)
      .where(eq(membershipDates.membership_id, membershipId));
  }

  public async deleteMembershipDate(dateId: number) {
    return await db.delete(membershipDates).where(eq(membershipDates.id, dateId));
  }

  public async getEventMemberships(eventId: number) {
    return await db
      .select({
        membership: memberships,
      })
      .from(eventMembershipSchema)
      .leftJoin(memberships, eq(eventMembershipSchema.membership_id, memberships.id))
      .where(eq(eventMembershipSchema.event_id, eventId));
  }

  public async getMultipleMembershipDates(dates: number[]) {
    return await db.select().from(membershipDates).where(inArray(membershipDates.id, dates));
  }
}
