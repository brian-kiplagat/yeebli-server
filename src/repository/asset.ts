import { eq } from "drizzle-orm";
import { db } from "../lib/database.js";
import { assetsSchema } from "../schema/schema.js";
import type { Asset, NewAsset } from "../schema/schema.js";

export class AssetRepository {
  async create(asset: NewAsset): Promise<void> {
    await db.insert(assetsSchema).values(asset);
  }

  async find(id: number): Promise<Asset | undefined> {
    return db
      .select()
      .from(assetsSchema)
      .where(eq(assetsSchema.id, id))
      .limit(1)
      .then((rows) => rows[0]);
  }

  async findByUserId(userId: number): Promise<Asset[]> {
    return db
      .select()
      .from(assetsSchema)
      .where(eq(assetsSchema.user_id, userId));
  }

  async delete(id: number): Promise<void> {
    await db.delete(assetsSchema).where(eq(assetsSchema.id, id));
  }
}
