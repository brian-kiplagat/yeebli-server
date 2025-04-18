import { and, desc, eq, like } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { Asset, NewAsset } from '../schema/schema.js';
import { assetsSchema } from '../schema/schema.js';
import type { AssetQuery } from '../web/validator/asset.js';

export interface AssetSearchQuery {
  asset_type?: 'image' | 'video' | 'audio' | 'document';
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export class AssetRepository {
  async create(asset: NewAsset): Promise<number> {
    const result = await db.insert(assetsSchema).values(asset).$returningId();
    return result[0].id;
  }

  async find(id: number): Promise<Asset | undefined> {
    const result = await db.select().from(assetsSchema).where(eq(assetsSchema.id, id)).limit(1);
    return result[0];
  }

  async findByUserId(
    userId: number,
    query?: AssetQuery,
  ): Promise<{ assets: Asset[]; total: number }> {
    const { page = 1, limit = 50, search, asset_type } = query || {};
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

  async update(id: number, asset: Partial<Asset>): Promise<void> {
    await db.update(assetsSchema).set(asset).where(eq(assetsSchema.id, id));
  }

  async findByQuery(query: AssetSearchQuery): Promise<{ assets: Asset[]; total: number }> {
    const whereConditions = [];

    if (query.asset_type) {
      whereConditions.push(eq(assetsSchema.asset_type, query.asset_type));
    }

    if (query.processing_status) {
      whereConditions.push(eq(assetsSchema.processing_status, query.processing_status));
    }

    const assets = await db
      .select()
      .from(assetsSchema)
      .where(and(...whereConditions))
      .orderBy(desc(assetsSchema.created_at));

    return { assets, total: assets.length };
  }
}
