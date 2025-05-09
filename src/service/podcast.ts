import { logger } from '../lib/logger.js';
import type { PodcastQuery, PodcastRepository } from '../repository/podcast.js';
import type { NewPodcast, NewPodcastEpisode, Podcast, PodcastEpisode } from '../schema/schema.js';
import { getContentTypeFromAssetType, getKeyFromUrl } from '../util/string.ts';
import type { S3Service } from './s3.js';

/**
 * Service class for managing podcasts, including episodes, assets, and memberships
 */
export class PodcastService {
  private repository: PodcastRepository;
  private s3Service: S3Service;

  /**
   * Creates an instance of PodcastService
   * @param {PodcastRepository} repository - Repository for podcast operations
   * @param {S3Service} s3Service - Service for S3 storage operations
   */
  constructor(repository: PodcastRepository, s3Service: S3Service) {
    this.repository = repository;
    this.s3Service = s3Service;
  }

  /**
   * Creates a new podcast with episodes and memberships
   * @param {NewPodcast} podcast - The podcast information to create
   * @param {number[]} [assets] - Array of asset IDs for episodes
   * @param {number[]} membership_ids - Array of membership IDs to associate
   * @returns {Promise<number>} ID of the created podcast
   * @throws {Error} When podcast creation fails
   */
  async createPodcast(podcast: NewPodcast, assets: number[] | undefined, membership_ids: number[]) {
    try {
      const podcastId = await this.repository.createPodcast(podcast);
      //promise loop through assets and add them to the podcast
      if (assets) {
        await Promise.all(
          assets.map(async (asset, index) => {
            const adding = await this.repository.addEpisode({
              title: 'Episode ' + (index + 1),
              description: 'Sample description for episode ' + (index + 1),
              host_id: podcast.host_id,
              podcast_id: podcastId,
              audio_asset_id: asset,
            });
            return adding;
          }),
        );
      }
      //promise loop through membership_ids and add them to the podcast
      await Promise.all(
        membership_ids.map(async (membership_id) => {
          await this.repository.addPodcastMembership(podcastId, membership_id);
        }),
      );
      return podcastId;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Updates a podcast's information, episodes, and memberships
   * @param {number} id - ID of the podcast to update
   * @param {Partial<Podcast> & { assets?: number[]; memberships?: number[] }} update - Updated podcast data
   * @param {PodcastEpisode[]} episodes - Current episodes of the podcast
   * @param {number} host_id - ID of the podcast host
   * @returns {Promise<void>}
   * @throws {Error} When podcast update fails
   */
  async updatePodcast(
    id: number,
    update: Partial<Podcast> & { assets?: number[]; memberships?: number[] },
    episodes: PodcastEpisode[],
    host_id: number,
  ) {
    try {
      const { memberships, assets, ...rest } = update;

      // Handle memberships
      if (memberships) {
        // Get current memberships
        const currentMemberships = await this.repository.findPodcastMemberships(id);
        const currentMembershipIds = currentMemberships.map(
          (m: { membership_id: number }) => m.membership_id,
        );

        // Find memberships to add and remove
        const membershipsToAdd = memberships.filter(
          (membershipId: number) => !currentMembershipIds.includes(membershipId),
        );
        const membershipsToRemove = currentMembershipIds.filter(
          (membershipId: number) => !memberships.includes(membershipId),
        );

        // Remove memberships that are no longer needed
        if (membershipsToRemove.length > 0) {
          await Promise.all(
            membershipsToRemove.map((membershipId: number) =>
              this.repository.deletePodcastMembership(id, membershipId),
            ),
          );
        }

        // Add new memberships
        if (membershipsToAdd.length > 0) {
          await Promise.all(
            membershipsToAdd.map((membershipId: number) =>
              this.repository.addPodcastMembership(id, membershipId),
            ),
          );
        }
      }
      //handle assets and episodes
      if (assets) {
        const currentAssetIds = episodes.map((episode) => episode.audio_asset_id);

        // Find assets to add and remove
        const assetsToAdd = assets.filter((assetId) => !currentAssetIds.includes(assetId));
        const assetsToRemove = currentAssetIds.filter(
          (assetId) => !assets.includes(Number(assetId)),
        );

        // Remove episodes for assets that are no longer needed
        if (assetsToRemove.length > 0) {
          await Promise.all(
            assetsToRemove.map((assetId) => {
              const episode = episodes.find((ep) => ep.audio_asset_id === assetId);
              if (episode) {
                return this.repository.deleteEpisode(episode.id);
              }
            }),
          );
        }

        // Add new episodes for new assets
        if (assetsToAdd.length > 0) {
          await Promise.all(
            assetsToAdd.map(async (assetId, index) => {
              const episodeNumber = episodes.length + index + 1;
              return this.repository.addEpisode({
                title: `Episode ${episodeNumber}`,
                description: `Sample description for episode ${episodeNumber}`,
                host_id: host_id,
                podcast_id: id,
                audio_asset_id: assetId,
              });
            }),
          );
        }
      }

      await this.repository.updatePodcast(id, rest);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves a podcast with its episodes and presigned URLs
   * @param {number} id - ID of the podcast
   * @returns {Promise<Object|undefined>} The podcast with episodes and URLs if found
   * @throws {Error} When podcast retrieval fails
   */
  async getPodcast(id: number) {
    try {
      const podcast = await this.repository.findPodcast(id);
      if (!podcast) return undefined;

      const episodes = await this.repository.findEpisodesByPodcast(id);

      let coverPresignedUrl = null;
      if (podcast.cover?.asset_url) {
        coverPresignedUrl = await this.s3Service.generateGetUrl(
          getKeyFromUrl(podcast.cover.asset_url),
          getContentTypeFromAssetType('image'),
          86400,
        );
      }

      const audioPresignedUrls = await Promise.all(
        episodes.map(async (episode) => {
          if (episode.audio?.asset_url) {
            const presignedUrl = await this.s3Service.generateGetUrl(
              getKeyFromUrl(episode.audio.asset_url),
              getContentTypeFromAssetType('audio'),
              86400,
            );
            return { episode_id: episode.episode.id, presignedUrl };
          }
          return null;
        }),
      );

      return {
        ...podcast,
        episodes,
        coverPresignedUrl,
        audioPresignedUrls: audioPresignedUrls.filter(Boolean),
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves all podcasts with optional filtering
   * @param {PodcastQuery} query - Query parameters for filtering podcasts
   * @returns {Promise<{podcasts: Array, total: number}>} List of podcasts and total count
   * @throws {Error} When podcast retrieval fails
   */
  async getAllPodcasts(query: PodcastQuery) {
    try {
      const { podcasts } = await this.repository.findAllPodcasts(query);

      const podcastsWithUrls = await Promise.all(
        podcasts.map(async (podcast) => {
          let coverPresignedUrl = null;
          if (podcast.cover?.asset_url) {
            coverPresignedUrl = await this.s3Service.generateGetUrl(
              getKeyFromUrl(podcast.cover.asset_url),
              getContentTypeFromAssetType('image'),
              86400,
            );
          }
          return { ...podcast, coverPresignedUrl };
        }),
      );

      return { podcasts: podcastsWithUrls, total: podcastsWithUrls.length };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Deletes a podcast
   * @param {number} id - ID of the podcast to delete
   * @returns {Promise<void>}
   * @throws {Error} When podcast deletion fails
   */
  async deletePodcast(id: number) {
    try {
      await this.repository.deletePodcast(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Adds a new episode to a podcast
   * @param {NewPodcastEpisode} episode - The episode information to add
   * @returns {Promise<number>} ID of the created episode
   * @throws {Error} When episode creation fails
   */
  async addEpisode(episode: NewPodcastEpisode) {
    try {
      return await this.repository.addEpisode(episode);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Updates an episode's information
   * @param {number} id - ID of the episode to update
   * @param {Partial<PodcastEpisode>} update - Updated episode information
   * @returns {Promise<void>}
   * @throws {Error} When episode update fails
   */
  async updateEpisode(id: number, update: Partial<PodcastEpisode>) {
    try {
      await this.repository.updateEpisode(id, update);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves an episode with its presigned audio URL
   * @param {number} id - ID of the episode
   * @returns {Promise<Object|undefined>} The episode with audio URL if found
   * @throws {Error} When episode retrieval fails
   */
  async getEpisode(id: number) {
    try {
      const episode = await this.repository.findEpisode(id);
      if (!episode) return undefined;

      let audioPresignedUrl = null;
      if (episode.audio?.asset_url) {
        audioPresignedUrl = await this.s3Service.generateGetUrl(
          getKeyFromUrl(episode.audio.asset_url),
          getContentTypeFromAssetType('audio'),
          86400,
        );
      }

      return { ...episode, audioPresignedUrl };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Deletes an episode
   * @param {number} id - ID of the episode to delete
   * @returns {Promise<void>}
   * @throws {Error} When episode deletion fails
   */
  async deleteEpisode(id: number) {
    try {
      await this.repository.deleteEpisode(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
