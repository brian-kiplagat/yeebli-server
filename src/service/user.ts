import { encrypt } from '../lib/encryption.ts';
import { logger } from '../lib/logger.ts';
import type { UserRepository } from '../repository/user.ts';
import type { User } from '../schema/schema.ts';
import { sendTransactionalEmail } from '../task/sendWelcomeEmail.ts';
import type { MembershipService } from './membership.ts';
import type { StripeService } from './stripe.ts';

export class UserService {
  private repo: UserRepository;
  private stripeService: StripeService;
  private membershipService: MembershipService;

  constructor(userRepository: UserRepository, stripeService: StripeService, membershipService: MembershipService) {
    this.repo = userRepository;
    this.stripeService = stripeService;
    this.membershipService = membershipService;

    this.create = this.create.bind(this);
    this.findByEmail = this.findByEmail.bind(this);
  }

  public async create(
    name: string,
    email: string,
    password: string,
    role: 'master' | 'owner' | 'host',
    phone: string,
    additionalFields: Partial<User> = {},
  ) {
    try {
      // Create Stripe customer first if not provided
      const stripeCustomerId =
        additionalFields.stripe_customer_id || (await this.stripeService.createCustomer(email)).id;

      const hashedPassword = encrypt(password);

      // Create user with all fields
      const user = await this.repo.create({
        name,
        email,
        password: hashedPassword,
        role,
        phone,
        stripe_customer_id: stripeCustomerId,
        auth_provider: 'local',
        ...additionalFields,
      });

      //create a free membership plan for the user
      const membership = await this.membershipService.createMembership({
        name: 'Free',
        description: 'Free membership plan',
        price: 0,
        payment_type: 'one_off',
        user_id: user[0].id,
      });

      return user;
    } catch (error) {
      console.log(error);
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  public async findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  public async find(id: number) {
    return this.repo.find(id);
  }

  public async update(id: number, user: Partial<User>) {
    return this.repo.update(id, user);
  }

  public async updateProfileImage(id: number, imageUrl: string) {
    return this.repo.update(id, {
      profile_picture: imageUrl,
    });
  }

  public async delete(id: number) {
    return this.repo.delete(id);
  }

  public async sendWelcomeEmail(email: string) {
    try {
      const user = await this.findByEmail(email);
      if (!user) {
        throw new Error('User not found');
      }

      await sendTransactionalEmail(user.email, user.name, 1, {
        subject: 'Welcome to Yeebli',
        title: 'Welcome to Yeebli',
        subtitle: 'Your subscription is now active',
        body: 'Thank you for subscribing to Yeebli. Your subscription is now active and you can start using all our features.',
      });

      logger.info(`Welcome email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      throw error;
    }
  }
}
