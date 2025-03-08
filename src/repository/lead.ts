import { and, desc, eq, like, or } from "drizzle-orm";
import { type Lead, type NewLead, db } from "../lib/database.js";
import { leadSchema } from "../schema/schema.js";

export interface LeadQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export class LeadRepository {
  public async create(lead: NewLead) {
    return db.insert(leadSchema).values(lead);
  }

  public async find(id: number) {
    return db.query.leadSchema.findFirst({
      where: eq(leadSchema.id, id),
      with: {
        event: true,
      },
    });
  }

  public async findAll() {
    return db.query.leadSchema.findMany({
      with: {
        event: true,
      },
    });
  }

  public async findByUserId(userId: number, query?: LeadQuery) {
    const { page = 1, limit = 10, search } = query || {};
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
      .select()
      .from(leadSchema)
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
