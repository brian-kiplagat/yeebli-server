import Stripe from 'stripe';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import type { Lead } from '../schema/schema.ts';

export class StripeService {
  private stripe: Stripe;
  private readonly clientId: string;
  private readonly redirectUri: string;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });
    this.clientId = env.STRIPE_CLIENT_ID;
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

  public constructWebhookEvent(payload: string, signature: string) {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
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
