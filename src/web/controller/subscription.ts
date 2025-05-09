import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import type { StripeService } from '../../service/stripe.js';
import type { SubscriptionService } from '../../service/subscription.js';
import type { UserService } from '../../service/user.js';
import { type SubscriptionRequestBody } from '../validator/subscription.js';
import { ERRORS, serveBadRequest, serveInternalServerError } from './resp/error.js';
import { serveData } from './resp/resp.js';

export class SubscriptionController {
  private subscriptionService: SubscriptionService;
  private stripeService: StripeService;
  private userService: UserService;

  constructor(
    subscriptionService: SubscriptionService,
    stripeService: StripeService,
    userService: UserService,
  ) {
    this.subscriptionService = subscriptionService;
    this.stripeService = stripeService;
    this.userService = userService;
  }

  /**
   * Retrieves the user from the JWT payload in the context
   * @private
   * @param {Context} c - The Hono context containing the JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  }

  /**
   * Creates a new subscription for a user
   * @param {Context} c - The Hono context containing the request data
   * @returns {Promise<Response>} Response containing the checkout session URL or error
   * @throws {Error} When subscription creation fails
   */
  public subscribe = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: SubscriptionRequestBody = await c.req.json();
      const session = await this.subscriptionService.createSubscription(
        user,
        body.priceId,
        body.productId,
        body.successUrl,
        body.cancelUrl,
      );

      return serveData(c, { url: session.url });
    } catch (error) {
      logger.error('Error creating subscription:', error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Cancels an existing subscription for a user
   * @param {Context} c - The Hono context containing the user information
   * @returns {Promise<Response>} Response indicating success or error
   * @throws {Error} When subscription cancellation fails
   */
  public cancelSubscription = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (!user.subscription_id) {
        return serveBadRequest(c, ERRORS.SUBSCRIPTION_NOT_FOUND);
      }

      await this.subscriptionService.cancelSubscription(
        user.id,
        user.email,
        user.name,
        user.subscription_id,
      );
      return serveData(c, { message: 'Subscription cancelled successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves all subscriptions for a user
   * @param {Context} c - The Hono context containing the user information
   * @returns {Promise<Response>} Response containing the list of subscriptions or error
   * @throws {Error} When fetching subscriptions fails
   */
  public getSubscriptions = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const subscriptions = await this.subscriptionService.getSubscriptions(user.id);
      return serveData(c, { subscriptions });
    } catch (error) {
      logger.error('Error getting subscriptions:', error);
      return serveInternalServerError(c, error);
    }
  };
}
