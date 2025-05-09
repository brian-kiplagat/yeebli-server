import Stripe from 'stripe';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import type { Lead } from '../schema/schema.ts';

/**
 * Service class for managing Stripe payment operations, including subscriptions, OAuth, and payment processing
 */
export class StripeService {
  private stripe: Stripe;
  private readonly clientId: string;
  private readonly redirectUri: string;

  /**
   * Creates an instance of StripeService
   * Initializes Stripe client with appropriate API keys based on environment
   */
  constructor() {
    this.stripe = new Stripe(
      env.NODE_ENV === 'production' ? env.STRIPE_LIVE_SECRET_KEY : env.STRIPE_TEST_SECRET_KEY,
      {
        apiVersion: '2025-02-24.acacia',
      },
    );
    this.clientId =
      env.NODE_ENV === 'production' ? env.STRIPE_LIVE_CLIENT_ID : env.STRIPE_TEST_CLIENT_ID;
    this.redirectUri = env.STRIPE_OAUTH_REDIRECT_URI;
  }

  // OAuth Methods
  public generateOAuthUrl(state: string) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: 'read_write',
      state: state,
    });

    params.append('redirect_uri', this.redirectUri);

    return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Handles OAuth callback from Stripe
   * @param {string} code - Authorization code from Stripe
   * @returns {Promise<Stripe.OAuthToken>} OAuth token response
   * @throws {Error} When OAuth token retrieval fails
   */
  public async handleOAuthCallback(code: string): Promise<Stripe.OAuthToken> {
    try {
      return await this.stripe.oauth.token({
        grant_type: 'authorization_code',
        code,
      });
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  // Subscription Methods
  /**
   * Creates a new Stripe subscription
   * @param {Object} params - Subscription parameters
   * @param {string} params.customer - Stripe customer ID
   * @param {Array<{price: string}>} params.items - Array of price items
   * @param {number} [params.trial_period_days] - Optional trial period in days
   * @param {Record<string, string>} [params.metadata] - Optional metadata
   * @returns {Promise<Stripe.Subscription>} Created subscription
   * @throws {Error} When subscription creation fails
   */
  public async createSubscription(params: {
    customer: string;
    items: Array<{ price: string }>;
    trial_period_days?: number;
    metadata?: Record<string, string>;
  }) {
    try {
      return await this.stripe.subscriptions.create(params);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Cancels a Stripe subscription
   * @param {string} subscriptionId - ID of the subscription to cancel
   * @returns {Promise<Stripe.Subscription>} Cancelled subscription
   * @throws {Error} When subscription cancellation fails
   */
  public async cancelSubscription(subscriptionId: string) {
    try {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async updateSubscription(subscriptionId: string, priceId: string) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return await this.stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: priceId,
          },
        ],
      });
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves a Stripe subscription
   * @param {string} subscriptionId - ID of the subscription
   * @returns {Promise<Stripe.Subscription>} The subscription
   * @throws {Error} When subscription retrieval fails
   */
  public async getSubscription(subscriptionId: string) {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async getCustomerPaymentMethods(customerId: string) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
      return paymentMethods.data;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Constructs a webhook event from Stripe payload
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Stripe signature header
   * @returns {Stripe.Event} Constructed webhook event
   * @throws {Error} When event construction fails
   */
  public constructWebhookEvent(payload: string, signature: string) {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        env.NODE_ENV === 'production'
          ? env.STRIPE_LIVE_WEBHOOK_SECRET
          : env.STRIPE_TEST_WEBHOOK_SECRET,
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async createProduct(params: { name: string; metadata?: Record<string, string> }) {
    try {
      return await this.stripe.products.create(params);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async createPrice(params: {
    product: string;
    unit_amount: number;
    currency: string;
    recurring: {
      interval: 'day' | 'week' | 'month' | 'year';
    };
  }) {
    try {
      return await this.stripe.prices.create(params);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Creates a new Stripe Connect account
   * @param {number} userId - ID of the user
   * @param {string} email - Email for the Connect account
   * @returns {Promise<Stripe.Account>} Created Connect account
   * @throws {Error} When account creation fails
   */
  public async createConnectAccount(userId: number, email: string) {
    try {
      return await this.stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: email,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: {
          userId: userId.toString(),
        },
      });
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Creates a Stripe account link for Connect onboarding
   * @param {string} accountId - Stripe Connect account ID
   * @param {string} baseUrl - Base URL for redirect URIs
   * @returns {Promise<Stripe.AccountLink>} Created account link
   * @throws {Error} When account link creation fails
   */
  public async createAccountLink(accountId: string, baseUrl: string) {
    try {
      return await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/stripe/connect/refresh`,
        return_url: `${baseUrl}/stripe/connect/return`,
        type: 'account_onboarding',
      });
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves a Stripe Connect account status
   * @param {string} accountId - Stripe Connect account ID
   * @returns {Promise<Stripe.Account>} The Connect account
   * @throws {Error} When account retrieval fails
   */
  public async getAccountStatus(accountId: string) {
    try {
      return await this.stripe.accounts.retrieve(accountId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async createCheckoutSession(params: {
    customer: string;
    line_items: Array<{ price: string; quantity: number }>;
    mode: Stripe.Checkout.SessionCreateParams.Mode;
    success_url: string;
    cancel_url: string;
    metadata?: Record<string, string>;
    payment_intent_data?: {
      setup_future_usage?: 'off_session';
    };
    subscription_data?: {
      trial_period_days?: number;
      metadata?: Record<string, string>;
    };
  }) {
    try {
      return await this.stripe.checkout.sessions.create(params);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Creates a checkout session for lead upgrade
   * @param {Lead} lead - The lead being upgraded
   * @param {string} customerId - Stripe customer ID
   * @param {Object} params - Checkout session parameters
   * @param {'payment'|'subscription'} params.mode - Payment mode
   * @param {string} params.success_url - Success redirect URL
   * @param {string} params.cancel_url - Cancel redirect URL
   * @param {string} params.hostStripeAccountId - Host's Stripe account ID
   * @param {number} params.price - Price amount
   * @param {string} params.eventName - Name of the event
   * @param {string} params.membershipName - Name of the membership
   * @param {string} params.membershipId - ID of the membership
   * @param {string} params.eventId - ID of the event
   * @param {number[]} params.dates - Array of date IDs
   * @returns {Promise<{session: Stripe.Checkout.Session, paymentIntentId: string|undefined}>} Created session and payment intent
   * @throws {Error} When checkout session creation fails
   */
  public async createLeadUpgradeCheckoutSession(
    lead: Lead,
    customerId: string,
    params: {
      mode: 'payment' | 'subscription';
      success_url: string;
      cancel_url: string;
      hostStripeAccountId: string;
      price: number;
      eventName: string;
      membershipName: string;
      membershipId: string;
      eventId: string;
      dates: number[];
    },
  ) {
    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              product_data: {
                name: `${params.eventName} - ${params.membershipName}`,
              },
              unit_amount: params.price * 100,
            },
            quantity: 1,
          },
        ],
        mode: params.mode,
        customer: customerId,
        success_url: params.success_url,
        cancel_url: params.cancel_url,
        metadata: {
          leadId: lead.id.toString(),
          type: 'lead_upgrade',
          eventId: params.eventId,
          membershipId: params.membershipId,
          dates: String(params.dates),
        },
      };

      if (params.mode === 'payment') {
        sessionParams.payment_intent_data = {
          on_behalf_of: params.hostStripeAccountId,
          setup_future_usage: 'off_session',
        };
      } else if (params.mode === 'subscription') {
        sessionParams.subscription_data = {
          on_behalf_of: params.hostStripeAccountId,
        };
      }

      const session = await this.stripe.checkout.sessions.create(sessionParams);

      return {
        session,
        paymentIntentId: session.payment_intent?.toString(),
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Creates a new Stripe customer
   * @param {string} email - Customer's email address
   * @param {Record<string, string>} [metadata] - Optional metadata
   * @returns {Promise<Stripe.Customer>} Created customer
   * @throws {Error} When customer creation fails
   */
  public async createCustomer(email: string, metadata?: Record<string, string>) {
    try {
      return await this.stripe.customers.create({
        email,
        metadata,
      });
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async getProduct(productId: string, priceId: string) {
    try {
      const [product, price] = await Promise.all([
        this.stripe.products.retrieve(productId),
        this.stripe.prices.retrieve(priceId),
      ]);
      return {
        product,
        price,
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
