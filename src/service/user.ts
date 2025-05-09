import { encrypt } from '../lib/encryption.ts';
import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';
import type { UserRepository } from '../repository/user.ts';
import type { User } from '../schema/schema.ts';
import { sendTransactionalEmail } from '../task/sendWelcomeEmail.ts';
import type { MembershipService } from './membership.ts';
import type { StripeService } from './stripe.ts';

/**
 * Service class for managing users, including creation, authentication, and profile management
 */
export class UserService {
  private repo: UserRepository;
  private stripeService: StripeService;
  private membershipService: MembershipService;

  /**
   * Creates an instance of UserService
   * @param {UserRepository} userRepository - Repository for user operations
   * @param {StripeService} stripeService - Service for Stripe operations
   * @param {MembershipService} membershipService - Service for membership operations
   */
  constructor(
    userRepository: UserRepository,
    stripeService: StripeService,
    membershipService: MembershipService,
  ) {
    this.repo = userRepository;
    this.stripeService = stripeService;
    this.membershipService = membershipService;

    this.create = this.create.bind(this);
    this.findByEmail = this.findByEmail.bind(this);
  }

  /**
   * Creates a new user
   * @param {string} name - User's name
   * @param {string} email - User's email address
   * @param {string} password - User's password (will be encrypted)
   * @param {'master'|'owner'|'host'} role - User's role
   * @param {string} phone - User's phone number
   * @param {Partial<User>} [additionalFields={}] - Optional additional user fields
   * @returns {Promise<User>} Created user
   * @throws {Error} When user creation fails
   */
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

      return user;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Finds a user by their email address
   * @param {string} email - Email address to search for
   * @returns {Promise<User|undefined>} The user if found
   */
  public async findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  /**
   * Finds a user by their ID
   * @param {number} id - ID of the user
   * @returns {Promise<User|undefined>} The user if found
   */
  public async find(id: number) {
    return this.repo.find(id);
  }

  /**
   * Updates a user's information
   * @param {number} id - ID of the user to update
   * @param {Partial<User>} user - Updated user information
   * @returns {Promise<User>} The updated user
   */
  public async update(id: number, user: Partial<User>) {
    return this.repo.update(id, user);
  }

  /**
   * Updates a user's profile image
   * @param {number} id - ID of the user to update
   * @param {string} imageUrl - URL of the new profile image
   * @returns {Promise<User>} The updated user
   */
  public async updateProfileImage(id: number, imageUrl: string) {
    return this.repo.update(id, {
      profile_picture: imageUrl,
    });
  }

  /**
   * Deletes a user
   * @param {number} id - ID of the user to delete
   * @returns {Promise<void>}
   */
  public async delete(id: number) {
    return this.repo.delete(id);
  }

  /**
   * Sends a welcome email to a newly registered user
   * @param {string} email - Email address of the user
   * @returns {Promise<void>}
   * @throws {Error} When user is not found or email sending fails
   */
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
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });

      logger.info(`Welcome email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      throw error;
    }
  }
}
