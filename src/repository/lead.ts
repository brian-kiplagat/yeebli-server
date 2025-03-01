import { eq } from "drizzle-orm";
import { type NewLead, type Lead, db } from "../lib/database.js";
import { leadSchema } from "../schema/schema.js";

export class LeadRepository {
  public async create(lead: NewLead) {
    return db.insert(leadSchema).values(lead);
  }

  public async find(id: number) {
    return db.query.leadSchema.findFirst({
      where: eq(leadSchema.id, id),
    });
  }

  public async findAll() {
    return db.query.leadSchema.findMany();
  }

  public async findByUserId(userId: number) {
    return db.query.leadSchema.findMany({
      where: eq(leadSchema.userId, userId),
    });
  }

  public async update(id: number, lead: Partial<Lead>) {
    return db.update(leadSchema).set(lead).where(eq(leadSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(leadSchema).where(eq(leadSchema.id, id));
  }
}
