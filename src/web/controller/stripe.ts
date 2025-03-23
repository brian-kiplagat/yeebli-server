import type { Context } from 'hono';
import { logger } from '../../lib/logger.js';
import type { StripeService } from '../../service/stripe.js';
import type { UserService } from '../../service/user.js';
import type { StripeUrlBody, StripeWebhookBody } from '../validator/stripe.js';

export class StripeController {
  private stripeService: StripeService;
  private userService: UserService;

  constructor(stripeService: StripeService, userService: UserService) {
    this.stripeService = stripeService;
    this.userService = userService;
  }

  public createConnectAccount = async (c: Context) => {
    try {
      const userId = c.get('jwtPayload').id;
      const user = await this.userService.find(userId);

      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Check if user already has a Stripe account
      if (user.stripe_account_id) {
        const account = await this.stripeService.getAccountStatus(user.stripe_account_id);

        if (account.charges_enabled) {
          return c.json({ error: 'Stripe account already setup and verified' }, 400);
        }
      }

      // Create new Stripe account if none exists
      const account = await this.stripeService.createConnectAccount(userId, user.email);

      // Update user with Stripe account ID
      await this.userService.update(userId, {
        stripe_account_id: account.id,
        stripe_account_status: 'pending',
      });

      // Generate onboarding link
      const accountLink = await this.stripeService.createAccountLink(account.id, `${c.req.url.split('/v1')[0]}/v1`);

      return c.json({
        url: accountLink.url,
        accountId: account.id,
      });
    } catch (error) {
      logger.error('Error in createConnectAccount:', error);
      return c.json({ error: 'Failed to create Stripe Connect account' }, 500);
    }
  };

  public getAccountStatus = async (c: Context) => {
    try {
      const userId = c.get('jwtPayload').id;
      const user = await this.userService.find(userId);

      if (!user?.stripe_account_id) {
        return c.json({ error: 'No Stripe account found' }, 404);
      }

      const account = await this.stripeService.getAccountStatus(user.stripe_account_id);

      return c.json({
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        status: user.stripe_account_status,
      });
    } catch (error) {
      logger.error('Error in getAccountStatus:', error);
      return c.json({ error: 'Failed to get account status' }, 500);
    }
  };

  public handleWebhook = async (c: Context) => {
    try {
      const payload = (await c.req.json()) as StripeWebhookBody;
      const signature = c.req.header('stripe-signature');

      if (!signature) {
        return c.json({ error: 'No signature provided' }, 400);
      }

      // Verify webhook signature
      try {
        const event = this.stripeService.constructWebhookEvent(payload, signature);

        // Handle different event types
        switch (event.type) {
          case 'account.updated':
            await this.handleAccountUpdate(event.data.object);
            break;
          // Add other event types as needed
        }

        return c.json({ received: true });
      } catch (err) {
        return c.json({ error: 'Invalid signature' }, 400);
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
      return c.json({ error: 'Webhook handler failed' }, 500);
    }
  };

  private async handleAccountUpdate(account: any) {
    try {
      const userId = account.metadata.userId;
      if (!userId) return;

      let status: 'pending' | 'active' | 'rejected' | 'restricted' = 'pending';

      if (account.charges_enabled && account.payouts_enabled) {
        status = 'active';
      } else if (account.requirements?.disabled_reason) {
        status = 'restricted';
      } else if (account.requirements?.errors?.length > 0) {
        status = 'rejected';
      }

      await this.userService.update(Number.parseInt(userId), {
        stripe_account_status: status,
      });
    } catch (error) {
      logger.error('Error handling account update:', error);
      throw error;
    }
  }
}
