import type { User } from "../lib/database.ts";
import { encrypt } from "../lib/encryption.js";
import { logger } from "../lib/logger.ts";
import type { UserRepository } from "../repository/user.js";
import type { StripeService } from "./stripe.ts";

export class UserService {
  private repo: UserRepository;
  private stripeService: StripeService;

  constructor(userRepository: UserRepository, stripeService: StripeService) {
    this.repo = userRepository;
    this.stripeService = stripeService;

    this.create = this.create.bind(this);
    this.findByEmail = this.findByEmail.bind(this);
  }

  public async create(
    name: string,
    email: string,
    password: string,
    role: "master" | "owner" | "host" | "user",
    phone: string
  ) {
    try {
      // Create Stripe customer first
      const stripeCustomer = await this.stripeService.createCustomer(email);

      const hashedPassword = encrypt(password);

      // Create user with stripe customer ID
      const user = await this.repo.create({
        name,
        email,
        password: hashedPassword,
        role,
        phone,
        stripe_customer_id: stripeCustomer.id,
      });

      return user;
    } catch (error) {
      logger.error("Error creating user:", error);
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
    if (user.password) {
      user.password = encrypt(user.password);
    }
    return this.repo.update(id, user);
  }

  public async delete(id: number) {
    return this.repo.delete(id);
  }
}
