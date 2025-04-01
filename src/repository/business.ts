import { and, desc, eq, like } from "drizzle-orm";
import { db } from "../lib/database.js";
import { businessSchema, businessRelations } from "../schema/schema.js";
import type { BusinessQuery } from "../web/validator/business.ts";

export class BusinessRepository {
  async create(business: typeof businessSchema.$inferInsert) {
    const result = await db
      .insert(businessSchema)
      .values(business)
      .$returningId();
    return await this.findById(result[0].id);
  }

  async findById(id: number) {
    return db.query.businessSchema.findFirst({
      where: eq(businessSchema.id, id),
      with: {
        user: true,
      },
    });
  }

  async findByUserId(userId: number) {
    return db.query.businessSchema.findFirst({
      where: eq(businessSchema.user_id, userId),
      with: {
        user: true,
      },
    });
  }

  async findAll(query?: BusinessQuery) {
    const { page = 1, limit = 10, search } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = [];
    if (search) {
      whereConditions.push(like(businessSchema.name, `%${search}%`));
    }

    const businesses = await db.query.businessSchema.findMany({
      where: whereConditions.length ? and(...whereConditions) : undefined,
      with: {
        user: true,
      },
      limit,
      offset,
      orderBy: desc(businessSchema.created_at),
    });

    const total = await db
      .select({ count: businessSchema.id })
      .from(businessSchema)
      .where(whereConditions.length ? and(...whereConditions) : undefined);

    return { businesses, total: total.length };
  }

  async update(
    id: number,
    business: Partial<typeof businessSchema.$inferSelect>
  ) {
    await db
      .update(businessSchema)
      .set(business)
      .where(eq(businessSchema.id, id));
    return await this.findById(id);
  }
}
