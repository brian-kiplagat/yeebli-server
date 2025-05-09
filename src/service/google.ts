import { OAuth2Client } from 'google-auth-library';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import type { StripeService } from './stripe.js';
import type { UserService } from './user.js';

/**
 * Service class for handling Google OAuth2 authentication and user management
 */
export class GoogleService {
  private client: OAuth2Client;
  private userService: UserService;
  private stripeService: StripeService;

  /**
   * Creates an instance of GoogleService
   * @param {UserService} userService - Service for managing users
   * @param {StripeService} stripeService - Service for managing Stripe integrations
   */
  constructor(userService: UserService, stripeService: StripeService) {
    this.client = new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URL,
    });
    this.userService = userService;
    this.stripeService = stripeService;
  }

  /**
   * Generates the Google OAuth2 authentication URL
   * @returns {Promise<string>} The authentication URL
   */
  async getAuthUrl() {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
    });
  }

  /**
   * Handles the OAuth2 callback from Google
   * @param {string} code - The authorization code from Google
   * @returns {Promise<Object>} The user object
   * @throws {Error} When email is not provided by Google or authentication fails
   */
  async handleCallback(code: string) {
    try {
      const { tokens } = await this.client.getToken(code);
      this.client.setCredentials(tokens);

      // Use the correct method to get user info
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      const userInfo = await response.json();

      if (!userInfo.email) {
        throw new Error('Email not provided by Google');
      }

      // Check if user exists
      let user = await this.userService.findByEmail(userInfo.email);

      if (!user) {
        // Create Stripe customer
        const stripeCustomer = await this.stripeService.createCustomer(userInfo.email);

        // Create new user with explicit auth_provider
        await this.userService.create(
          userInfo.name || 'Google User',
          userInfo.email,
          crypto.randomUUID(),
          'host',
          '',
          {
            google_id: userInfo.id,
            google_access_token: tokens.access_token,
            auth_provider: 'google',
            is_verified: true,
            stripe_customer_id: stripeCustomer.id,
            profile_picture: userInfo.picture || null,
          },
        );
        user = await this.userService.findByEmail(userInfo.email);
      } else if (!user.google_id) {
        // Update existing user with Google info
        await this.userService.update(user.id, {
          google_id: userInfo.id,
          google_access_token: tokens.access_token,
          auth_provider: 'google',
          is_verified: true,
          profile_picture: userInfo.picture || user.profile_picture,
        });
      }

      return user;
    } catch (error) {
      logger.error('Google authentication failed:', error);
      throw error;
    }
  }
}
