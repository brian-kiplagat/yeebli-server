import { and, desc, eq, like } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { NewPodcast, NewPodcastEpisode, Podcast, PodcastEpisode } from '../schema/schema.js';
import {
  assetsSchema,
  memberships,
  podcastEpisodeSchema,
  podcastMembershipSchema,
  podcastSchema,
  userSchema,
} from '../schema/schema.js';

export interface PodcastQuery {
  page?: number;
  limit?: number;
  search?: string;
  host_id?: number;
}

export class PodcastRepository {
  async createPodcast(podcast: NewPodcast) {
    const [result] = await db.insert(podcastSchema).values(podcast).$returningId();
    return result.id;
  }

  async updatePodcast(id: number, update: Partial<Podcast>) {
    await db.update(podcastSchema).set(update).where(eq(podcastSchema.id, id));
  }

  async findPodcast(id: number) {
    const [podcast] = await db
      .select({
        podcast: podcastSchema,
        cover: assetsSchema,
        host: {
          id: userSchema.id,
          name: userSchema.name,
          email: userSchema.email,
        },
      })
      .from(podcastSchema)
      .leftJoin(assetsSchema, eq(podcastSchema.cover_image_asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(podcastSchema.host_id, userSchema.id))
      .where(eq(podcastSchema.id, id))
      .limit(1);

    if (!podcast) return null;

    // Get all memberships for the podcast with full membership details
    const podcastMemberships = await db
      .select({
        id: memberships.id,
        name: memberships.name,
        description: memberships.description,
        price: memberships.price,
        payment_type: memberships.payment_type,
        price_point: memberships.price_point,
        billing: memberships.billing,
        podcast_id: podcastMembershipSchema.podcast_id,
        podcast_membership_id: podcastMembershipSchema.id,
      })
      .from(podcastMembershipSchema)
      .leftJoin(memberships, eq(podcastMembershipSchema.membership_id, memberships.id))
      .where(eq(podcastMembershipSchema.podcast_id, id));

    return { ...podcast, memberships: podcastMemberships };
  }

  async findAllPodcasts(query: PodcastQuery = {}) {
    const { page = 1, limit = 10, search, host_id } = query;
    const offset = (page - 1) * limit;
    const where: any[] = [];
    if (search) where.push(like(podcastSchema.title, `%${search}%`));
    if (host_id) where.push(eq(podcastSchema.host_id, host_id));

    const podcasts = await db
      .select({
        podcast: podcastSchema,
        cover: assetsSchema,
        host: {
          id: userSchema.id,
          name: userSchema.name,
          email: userSchema.email,
        },
      })
      .from(podcastSchema)
      .leftJoin(assetsSchema, eq(podcastSchema.cover_image_asset_id, assetsSchema.id))
      .leftJoin(userSchema, eq(podcastSchema.host_id, userSchema.id))
      .where(where.length ? and(...where) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(podcastSchema.created_at));

    const total = await db
      .select({ count: podcastSchema.id })
      .from(podcastSchema)
      .where(where.length ? and(...where) : undefined);

    return { podcasts, total: total.length };
  }

  async deletePodcast(id: number) {
    //parralel delete
    await Promise.all([
      db.delete(podcastEpisodeSchema).where(eq(podcastEpisodeSchema.podcast_id, id)),
      db.delete(podcastSchema).where(eq(podcastSchema.id, id)),
      db.delete(podcastMembershipSchema).where(eq(podcastMembershipSchema.podcast_id, id)),
    ]);
  }

  async addPodcastMembership(podcast_id: number, membership_id: number) {
    const [result] = await db
      .insert(podcastMembershipSchema)
      .values({
        podcast_id,
        membership_id,
      })
      .$returningId();
    return result.id;
  }

  async addEpisode(episode: NewPodcastEpisode) {
    const [result] = await db.insert(podcastEpisodeSchema).values(episode).$returningId();
    return result.id;
  }

  async updateEpisode(id: number, update: Partial<PodcastEpisode>) {
    await db.update(podcastEpisodeSchema).set(update).where(eq(podcastEpisodeSchema.id, id));
  }

  async findEpisode(id: number) {
    const [episode] = await db
      .select({
        episode: podcastEpisodeSchema,
        audio: assetsSchema,
      })
      .from(podcastEpisodeSchema)
      .leftJoin(assetsSchema, eq(podcastEpisodeSchema.audio_asset_id, assetsSchema.id))
      .where(eq(podcastEpisodeSchema.id, id))
      .limit(1);
    return episode;
  }

  async findEpisodesByPodcast(podcast_id: number) {
    return db
      .select({
        episode: podcastEpisodeSchema,
        audio: assetsSchema,
      })
      .from(podcastEpisodeSchema)
      .leftJoin(assetsSchema, eq(podcastEpisodeSchema.audio_asset_id, assetsSchema.id))
      .where(eq(podcastEpisodeSchema.podcast_id, podcast_id))
      .orderBy(desc(podcastEpisodeSchema.created_at));
  }

  async deleteEpisode(id: number) {
    await db.delete(podcastEpisodeSchema).where(eq(podcastEpisodeSchema.id, id));
  }

  async findPodcastMemberships(podcast_id: number) {
    return db
      .select()
      .from(podcastMembershipSchema)
      .where(eq(podcastMembershipSchema.podcast_id, podcast_id));
  }

  async deletePodcastMembership(podcast_id: number, membership_id: number) {
    await db
      .delete(podcastMembershipSchema)
      .where(
        and(
          eq(podcastMembershipSchema.podcast_id, podcast_id),
          eq(podcastMembershipSchema.membership_id, membership_id),
        ),
      );
  }
}
