import { logger } from '../lib/logger.js';
import type { PodcastRepository } from '../repository/podcast.js';
import type { NewPodcast, NewPodcastEpisode, Podcast, PodcastEpisode } from '../schema/schema.js';
import type { S3Service } from './s3.js';

export class PodcastService {
  private repository: PodcastRepository;
  private s3Service: S3Service;

  constructor(repository: PodcastRepository, s3Service: S3Service) {
    this.repository = repository;
    this.s3Service = s3Service;
  }

  async createPodcast(podcast: NewPodcast) {
    try {
      return await this.repository.createPodcast(podcast);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async updatePodcast(id: number, update: Partial<Podcast>) {
    try {
      await this.repository.updatePodcast(id, update);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async getPodcast(id: number) {
    try {
      const podcast = await this.repository.findPodcast(id);
      if (!podcast) return undefined;

      const episodes = await this.repository.findEpisodesByPodcast(id);

      // Add presigned URLs for cover and audio assets
      if (podcast.cover?.asset_url) {
        const presignedUrl = await this.s3Service.generateGetUrl(
          this.getKeyFromUrl(podcast.cover.asset_url),
          this.getContentType(podcast.cover.asset_type),
          86400,
        );
        podcast.cover = { ...podcast.cover, presignedUrl };
      }

      const episodesWithUrls = await Promise.all(
        episodes.map(async (episode) => {
          if (episode.audio?.asset_url) {
            const presignedUrl = await this.s3Service.generateGetUrl(
              this.getKeyFromUrl(episode.audio.asset_url),
              this.getContentType(episode.audio.asset_type),
              86400,
            );
            episode.audio = { ...episode.audio, presignedUrl };
          }
          return episode;
        }),
      );

      return {
        ...podcast,
        episodes: episodesWithUrls,
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async getAllPodcasts(query: any) {
    try {
      const { podcasts, total } = await this.repository.findAllPodcasts(query);

      // Add presigned URLs for cover assets
      const podcastsWithUrls = await Promise.all(
        podcasts.map(async (podcast) => {
          if (podcast.cover?.asset_url) {
            const presignedUrl = await this.s3Service.generateGetUrl(
              this.getKeyFromUrl(podcast.cover.asset_url),
              this.getContentType(podcast.cover.asset_type),
              86400,
            );
            podcast.cover = { ...podcast.cover, presignedUrl };
          }
          return podcast;
        }),
      );

      return { podcasts: podcastsWithUrls, total };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async deletePodcast(id: number) {
    try {
      await this.repository.deletePodcast(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async addEpisode(episode: NewPodcastEpisode) {
    try {
      return await this.repository.addEpisode(episode);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async updateEpisode(id: number, update: Partial<PodcastEpisode>) {
    try {
      await this.repository.updateEpisode(id, update);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async getEpisode(id: number) {
    try {
      const episode = await this.repository.findEpisode(id);
      if (!episode) return undefined;

      if (episode.audio?.asset_url) {
        const presignedUrl = await this.s3Service.generateGetUrl(
          this.getKeyFromUrl(episode.audio.asset_url),
          this.getContentType(episode.audio.asset_type),
          86400,
        );
        episode.audio = { ...episode.audio, presignedUrl };
      }

      return episode;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async getEpisodesByPodcast(podcast_id: number) {
    try {
      const episodes = await this.repository.findEpisodesByPodcast(podcast_id);

      // Add presigned URLs for audio assets
      const episodesWithUrls = await Promise.all(
        episodes.map(async (episode) => {
          if (episode.audio?.asset_url) {
            const presignedUrl = await this.s3Service.generateGetUrl(
              this.getKeyFromUrl(episode.audio.asset_url),
              this.getContentType(episode.audio.asset_type),
              86400,
            );
            episode.audio = { ...episode.audio, presignedUrl };
          }
          return episode;
        }),
      );

      return episodesWithUrls;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async deleteEpisode(id: number) {
    try {
      await this.repository.deleteEpisode(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  private getKeyFromUrl(url: string): string {
    const urlParts = url.split('.amazonaws.com/');
    return urlParts[1] || '';
  }

  private getContentType(assetType: string): string {
    switch (assetType) {
      case 'image':
        return 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'audio':
        return 'audio/mpeg';
      case 'document':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }
}
