import { and, desc, eq, like } from "drizzle-orm";
import { db } from "../lib/database.js";
import { pricePlans } from "../schema/schema.js";
import type { NewPricePlan, PricePlan } from "../schema/schema.js";

export type PricePlanQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export class PricePlanRepository {
  async create(plan: NewPricePlan): Promise<number> {
    const result = await db.insert(pricePlans).values(plan).$returningId();
    return result[0].id;
  }

  async find(id: number): Promise<PricePlan | undefined> {
    const result = await db
      .select()
      .from(pricePlans)
      .where(eq(pricePlans.id, id))
      .limit(1);
    return result[0];
  }

  async findAll(query?: PricePlanQuery) {
    const { page = 1, limit = 10, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = [];
    if (search) {
      whereConditions.push(like(pricePlans.name, `%${search}%`));
    }

    const plans = await db
      .select()
      .from(pricePlans)
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(pricePlans.created_at));

    const total = await db
      .select({ count: pricePlans.id })
      .from(pricePlans)
      .where(whereConditions.length ? and(...whereConditions) : undefined);

    return { plans, total: total.length };
  }

  async update(id: number, plan: Partial<PricePlan>): Promise<void> {
    await db.update(pricePlans).set(plan).where(eq(pricePlans.id, id));
  }

  async delete(id: number): Promise<void> {
    await db.delete(pricePlans).where(eq(pricePlans.id, id));
  }

  async findByUserId(userId: number, query?: PricePlanQuery) {
    const { page = 1, limit = 10, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = [eq(pricePlans.user_id, userId)];
    if (search) {
      whereConditions.push(like(pricePlans.name, `%${search}%`));
    }

    const plans = await db
      .select()
      .from(pricePlans)
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(pricePlans.created_at));

    const total = await db
      .select({ count: pricePlans.id })
      .from(pricePlans)
      .where(and(...whereConditions));

    return { plans, total: total.length };
  }
}
