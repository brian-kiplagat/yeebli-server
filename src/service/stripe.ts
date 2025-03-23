import Stripe from 'stripe';
import env from '../lib/env.js';
import { logger } from '../lib/logger.js';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }

  public async createConnectAccount(userId: number, email: string) {
    try {
      const account = await this.stripe.accounts.create({
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

      return account;
    } catch (error) {
      logger.error('Error creating Stripe Connect account:', error);
      throw error;
    }
  }

  public async createAccountLink(accountId: string, baseUrl: string) {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/stripe/connect/refresh`,
        return_url: `${baseUrl}/stripe/connect/return`,
        type: 'account_onboarding',
      });

      return accountLink;
    } catch (error) {
      logger.error('Error creating account link:', error);
      throw error;
    }
  }

  public async getAccountStatus(accountId: string) {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      return account;
    } catch (error) {
      logger.error('Error retrieving account status:', error);
      throw error;
    }
  }

  public constructWebhookEvent(payload: any, signature: string) {
    try {
      return this.stripe.webhooks.constructEvent(JSON.stringify(payload), signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      logger.error('Error constructing webhook event:', error);
      throw error;
    }
  }
}
