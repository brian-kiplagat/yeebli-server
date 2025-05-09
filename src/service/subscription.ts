import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';
import type { SubscriptionRepository } from '../repository/subscription.ts';
import type { User } from '../schema/schema.ts';
import { sendTransactionalEmail } from '../task/sendWelcomeEmail.ts';
import type { StripeService } from './stripe.ts';
import type { UserService } from './user.ts';

/**
 * Service class for managing user subscriptions, including creation, cancellation, and retrieval
 */
export class SubscriptionService {
  private subscriptionRepo: SubscriptionRepository;
  private stripeService: StripeService;
  private userService: UserService;

  /**
   * Creates an instance of SubscriptionService
   * @param {SubscriptionRepository} subscriptionRepo - Repository for subscription operations
   * @param {StripeService} stripeService - Service for Stripe operations
   * @param {UserService} userService - Service for user operations
   */
  constructor(
    subscriptionRepo: SubscriptionRepository,
    stripeService: StripeService,
    userService: UserService,
  ) {
    this.subscriptionRepo = subscriptionRepo;
    this.stripeService = stripeService;
    this.userService = userService;
  }

  /**
   * Creates a new subscription for a user
   * @param {User} user - The user subscribing
   * @param {string} priceId - Stripe price ID
   * @param {string} productId - Stripe product ID
   * @param {string} successUrl - URL to redirect on success
   * @param {string} cancelUrl - URL to redirect on cancellation
   * @returns {Promise<Stripe.Checkout.Session>} Created checkout session
   * @throws {Error} When user has no Stripe customer ID or subscription creation fails
   */
  public async createSubscription(
    user: User,
    priceId: string,
    productId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    try {
      if (!user.stripe_customer_id) {
        throw new Error('User has no Stripe customer ID');
      }

      const session = await this.stripeService.createCheckoutSession({
        customer: user.stripe_customer_id,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: String(user.id),
          type: 'subscription',
        },
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            userId: String(user.id),
            productId: productId,
            priceId: priceId,
          },
        },
      });

      // Store the checkout session in our database
      await this.subscriptionRepo.createSubscription({
        user_id: user.id,
        object: 'checkout.session',
        amount_subtotal: session.amount_subtotal || 0,
        amount_total: session.amount_total || 0,
        session_id: session.id,
        cancel_url: session.cancel_url || '',
        success_url: session.success_url || '',
        created: Number(session.created),
        currency: session.currency || '',
        mode: session.mode || '',
        payment_status: session.payment_status || '',
        status: session.status || '',
        subscription_id: session.subscription?.toString() || null,
      });

      return session;
    } catch (error) {
      logger.error('Error creating subscription checkout session:', error);
      throw error;
    }
  }

  /**
   * Cancels a user's subscription
   * @param {number} userId - ID of the user
   * @param {string} email - User's email
   * @param {string} name - User's name
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Stripe.Subscription>} Cancelled subscription
   * @throws {Error} When subscription cancellation fails
   */
  public async cancelSubscription(
    userId: number,
    email: string,
    name: string,
    subscriptionId: string,
  ) {
    try {
      const [subscription] = await Promise.all([
        this.stripeService.cancelSubscription(subscriptionId),
        this.userService.update(userId, {
          subscription_status: 'canceled',
          subscription_id: null,
        }),
      ]);
      await sendTransactionalEmail(email, name, 1, {
        subject: 'You have cancelled your subscription',
        title: 'We Are Sorry to See You Go',
        subtitle: 'Your subscription has been cancelled',
        body: `We're truly sorry to see you leave. Your subscription has been successfully cancelled, and your premium access has now ended. If you have any feedback about your experience or if there's anything we could have done better, we'd love to hear from you. If you ever change your mind, you can easily regain full access to all premium features by subscribing again at any time. Our support team is always here to help—feel free to reach out whenever you need. Thank you for being with us.`,
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });
      return subscription;
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Retrieves all subscriptions for a user
   * @param {number} userId - ID of the user
   * @returns {Promise<Array>} List of user's subscriptions
   * @throws {Error} When subscription retrieval fails
   */
  public async getSubscriptions(userId: number) {
    try {
      return await this.subscriptionRepo.findSubscriptionsByUserId(userId);
    } catch (error) {
      logger.error('Error getting subscriptions:', error);
      throw error;
    }
  }
}
