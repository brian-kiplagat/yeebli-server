import { and, desc, eq, like, or } from "drizzle-orm";
import { db } from "../lib/database.js";
import { assetsSchema } from "../schema/schema.js";
import type { Asset, NewAsset } from "../schema/schema.js";
import type { AssetQuery } from "../web/validator/asset.js";

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

  async findByUserId(
    userId: number,
    query?: AssetQuery
  ): Promise<{ assets: Asset[]; total: number }> {
    const { page = 1, limit = 10, search, asset_type } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = [];
    whereConditions.push(eq(assetsSchema.user_id, userId));

    if (search) {
      whereConditions.push(like(assetsSchema.asset_name, `%${search}%`));
    }

    if (asset_type) {
      whereConditions.push(eq(assetsSchema.asset_type, asset_type));
    }

    const assets = await db
      .select()
      .from(assetsSchema)
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(assetsSchema.created_at));

    const total = await db
      .select({ count: assetsSchema.id })
      .from(assetsSchema)
      .where(and(...whereConditions));

    return { assets, total: total.length };
  }

  async delete(id: number): Promise<void> {
    await db.delete(assetsSchema).where(eq(assetsSchema.id, id));
  }
}
