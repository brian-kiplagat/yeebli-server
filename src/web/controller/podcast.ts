import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import type { PodcastService } from '../../service/podcast.js';
import type { UserService } from '../../service/user.js';
import { CreatePodcastBody } from '../validator/podcast.ts';
import { ERRORS, serveBadRequest, serveInternalServerError, serveNotFound } from './resp/error.js';

export class PodcastController {
  private service: PodcastService;
  private userService: UserService;

  constructor(service: PodcastService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public getPodcasts = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const { page, limit, search } = c.req.query();
      const query = {
        page: page ? Number.parseInt(page) : 1,
        limit: limit ? Number.parseInt(limit) : 10,
        search,
      };

      if (user.role === 'master' || user.role === 'owner') {
        const podcasts = await this.service.getAllPodcasts(query);
        return c.json(podcasts);
      }

      // Get hostId from context and if hostId exists (team access), get resources for that host
      const hostId = c.get('hostId');
      if (hostId) {
        const podcasts = await this.service.getAllPodcasts({ ...query, host_id: hostId });
        return c.json(podcasts);
      }

      // Regular users only see their own resources
      const podcasts = await this.service.getAllPodcasts({ ...query, host_id: user.id });
      return c.json(podcasts);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getPodcast = async (c: Context) => {
    try {
      const podcastId = Number(c.req.param('id'));
      const podcast = await this.service.getPodcast(podcastId);

      if (!podcast) {
        return serveNotFound(c, ERRORS.PODCAST_NOT_FOUND);
      }

      return c.json(podcast);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public createPodcast = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: CreatePodcastBody = await c.req.json();
      const { assets } = body;
      if (!assets || assets.length === 0) {
        return serveBadRequest(c, ERRORS.INVALID_ASSETS);
      }

      const podcastId = await this.service.createPodcast(
        {
          ...body,
          host_id: user.id,
        },
        assets,
      );

      return c.json({ message: 'Podcast created successfully', podcastId }, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public updatePodcast = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const podcastId = Number(c.req.param('id'));
      const record = await this.service.getPodcast(podcastId);

      if (!record) {
        return serveNotFound(c, ERRORS.PODCAST_NOT_FOUND);
      }

      // Only master, owner, or the podcast host can update
      if (user.role !== 'master' && user.role !== 'owner' && record.podcast.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body = await c.req.json();
      await this.service.updatePodcast(podcastId, body);

      return c.json({ message: 'Podcast updated successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deletePodcast = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const podcastId = Number(c.req.param('id'));
      const record = await this.service.getPodcast(podcastId);

      if (!record) {
        return serveNotFound(c, ERRORS.PODCAST_NOT_FOUND);
      }

      // Only master, owner, or the podcast host can delete
      if (user.role !== 'master' && user.role !== 'owner' && record.podcast.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.service.deletePodcast(podcastId);
      return c.json({ message: 'Podcast deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public addEpisode = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const podcastId = Number(c.req.param('podcastId'));
      const record = await this.service.getPodcast(podcastId);

      if (!record) {
        return serveNotFound(c, ERRORS.PODCAST_NOT_FOUND);
      }

      // Only master, owner, or the podcast host can add episodes
      if (user.role !== 'master' && user.role !== 'owner' && record.podcast.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body = await c.req.json();
      const episodeId = await this.service.addEpisode({
        ...body,
        podcast_id: podcastId,
      });

      return c.json({ message: 'Episode added successfully', episodeId }, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getEpisodes = async (c: Context) => {
    try {
      const podcastId = Number(c.req.param('podcastId'));
      const podcast = await this.service.getPodcast(podcastId);

      if (!podcast) {
        return serveNotFound(c, ERRORS.PODCAST_NOT_FOUND);
      }

      const episodes = await this.service.getEpisodesByPodcast(podcastId);
      return c.json(episodes);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public updateEpisode = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const episodeId = Number(c.req.param('episodeId'));
      const record = await this.service.getEpisode(episodeId);

      if (!record) {
        return serveNotFound(c, ERRORS.EPISODE_NOT_FOUND);
      }

      // Only master, owner, or the podcast host can update episodes
      if (user.role !== 'master' && user.role !== 'owner' && record.episode.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body = await c.req.json();
      await this.service.updateEpisode(episodeId, body);

      return c.json({ message: 'Episode updated successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteEpisode = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const episodeId = Number(c.req.param('episodeId'));
      const record = await this.service.getEpisode(episodeId);

      if (!record) {
        return serveNotFound(c, ERRORS.EPISODE_NOT_FOUND);
      }

      // Only master, owner, or the podcast host can delete episodes
      if (user.role !== 'master' && user.role !== 'owner' && record.episode.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.service.deleteEpisode(episodeId);
      return c.json({ message: 'Episode deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
