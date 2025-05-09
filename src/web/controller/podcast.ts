import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import { MembershipService } from '../../service/membership.ts';
import type { PodcastService } from '../../service/podcast.js';
import type { UserService } from '../../service/user.js';
import { CreatePodcastBody, UpdatePodcastBody } from '../validator/podcast.ts';
import { ERRORS, serveBadRequest, serveInternalServerError, serveNotFound } from './resp/error.js';

export class PodcastController {
  private service: PodcastService;
  private userService: UserService;
  private membershipService: MembershipService;

  constructor(
    service: PodcastService,
    userService: UserService,
    membershipService: MembershipService,
  ) {
    this.service = service;
    this.userService = userService;
    this.membershipService = membershipService;
  }

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  }

  /**
   * Retrieves all podcasts based on user role and permissions
   * @param {Context} c - The Hono context containing pagination and search parameters
   * @returns {Promise<Response>} Response containing list of podcasts
   * @throws {Error} When fetching podcasts fails
   */
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

  /**
   * Retrieves detailed information about a specific podcast
   * @param {Context} c - The Hono context containing podcast ID
   * @returns {Promise<Response>} Response containing podcast details and episode assets
   * @throws {Error} When fetching podcast details fails
   */
  public getPodcast = async (c: Context) => {
    try {
      const podcastId = Number(c.req.param('id'));
      const podcast = await this.service.getPodcast(podcastId);

      if (!podcast) {
        return serveNotFound(c, ERRORS.PODCAST_NOT_FOUND);
      }

      //from each episode, build an array of the asset_ids
      const episodeAssetIds = podcast.episodes.map((episode) => episode.audio?.id);

      return c.json({ ...podcast, assets_ids: episodeAssetIds });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Creates a new podcast with episodes and membership requirements
   * @param {Context} c - The Hono context containing podcast details
   * @returns {Promise<Response>} Response containing created podcast information
   * @throws {Error} When podcast creation fails
   */
  public createPodcast = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: CreatePodcastBody = await c.req.json();
      const { assets } = body;

      if ((!assets || assets.length === 0) && body.podcast_type === 'prerecorded') {
        return serveBadRequest(c, ERRORS.INVALID_ASSETS);
      }

      if (body.podcast_type === 'link' && !body.link_url) {
        return serveBadRequest(c, ERRORS.INVALID_LINK_URL);
      }

      const membership_ids = body.memberships;
      if (membership_ids.length < 1) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_REQUIRED);
      }
      //ensure the membership_ids are valid
      const memberships = await this.membershipService.getMultipleMemberships(membership_ids);
      if (memberships.length !== membership_ids.length) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }
      //ensure none of the memberships.price_point is a `course` or `event`
      const isCourse = memberships.some(
        (m) => m.price_point === 'course' || m.price_point === 'standalone',
      );
      if (isCourse) {
        return serveBadRequest(c, ERRORS.COURSE_MEMBERSHIP_NOT_ALLOWED);
      }

      const podcastId = await this.service.createPodcast(
        {
          ...body,
          host_id: user.id,
        },
        assets,
        membership_ids,
      );

      return c.json({ message: 'Podcast created successfully', podcastId }, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Updates an existing podcast's details and episodes
   * @param {Context} c - The Hono context containing updated podcast information
   * @returns {Promise<Response>} Response indicating update status
   * @throws {Error} When podcast update fails
   */
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

      const body: UpdatePodcastBody = await c.req.json();

      const { assets, memberships, podcast_type, link_url } = body;

      if ((!assets || assets.length === 0) && podcast_type === 'prerecorded') {
        return serveBadRequest(c, ERRORS.INVALID_ASSETS);
      }

      if (podcast_type === 'link' && !link_url) {
        return serveBadRequest(c, ERRORS.INVALID_LINK_URL);
      }

      if (!memberships || memberships.length < 1) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_REQUIRED);
      }
      //ensure the membership_ids are valid
      const memberships_record = await this.membershipService.getMultipleMemberships(memberships);
      if (memberships_record.length !== memberships.length) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }
      //ensure none of the memberships.price_point is a `course` or `event`
      const isCourse = memberships_record.some(
        (m) => m.price_point === 'course' || m.price_point === 'standalone',
      );
      if (isCourse) {
        return serveBadRequest(c, ERRORS.COURSE_MEMBERSHIP_NOT_ALLOWED);
      }
      const episodes = record.episodes.map((ep) => ep.episode);
      const { host_id } = record.podcast;
      if (!host_id) {
        return serveBadRequest(c, ERRORS.HOST_ID_NOT_FOUND);
      }
      await this.service.updatePodcast(podcastId, body, episodes, host_id);

      return c.json({ message: 'Podcast updated successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Deletes a podcast and its associated episodes
   * @param {Context} c - The Hono context containing podcast ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When podcast deletion fails
   */
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

  /**
   * Adds a new episode to an existing podcast
   * @param {Context} c - The Hono context containing episode details
   * @returns {Promise<Response>} Response containing created episode information
   * @throws {Error} When episode creation fails
   */
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

  /**
   * Retrieves all episodes for a specific podcast
   * @param {Context} c - The Hono context containing podcast ID
   * @returns {Promise<Response>} Response containing list of episodes
   * @throws {Error} When fetching episodes fails
   */
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

  /**
   * Updates an existing episode's details
   * @param {Context} c - The Hono context containing updated episode information
   * @returns {Promise<Response>} Response indicating update status
   * @throws {Error} When episode update fails
   */
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

  /**
   * Deletes an episode from a podcast
   * @param {Context} c - The Hono context containing episode ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When episode deletion fails
   */
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
