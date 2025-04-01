import { and, desc, eq, like } from "drizzle-orm";
import { db } from "../lib/database.ts";
import { memberships } from "../schema/schema.ts";
import type { NewMembership, Membership } from "../schema/schema.ts";

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
    const result = await db
      .select()
      .from(memberships)
      .where(eq(memberships.id, id))
      .limit(1);
    return result[0];
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
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(memberships.created_at));

    const total = await db
      .select({ count: memberships.id })
      .from(memberships)
      .where(whereConditions.length ? and(...whereConditions) : undefined);

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
      .select()
      .from(memberships)
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(memberships.created_at));

    const total = await db
      .select({ count: memberships.id })
      .from(memberships)
      .where(and(...whereConditions));

    return { plans, total: total.length };
  }
}
