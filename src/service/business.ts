import { logger } from "../lib/logger.js";
import type { BusinessRepository } from "../repository/business.js";
import type { BusinessQuery } from "../web/validator/business.ts";

export class BusinessService {
  private repository: BusinessRepository;

  constructor(repository: BusinessRepository) {
    this.repository = repository;
  }

  public async getBusinessByUserId(userId: number) {
    try {
      return await this.repository.findByUserId(userId);
    } catch (error) {
      logger.error("Failed to get business by user:", error);
      throw error;
    }
  }

  public async getAllBusinesses(query?: BusinessQuery) {
    try {
      return await this.repository.findAll(query);
    } catch (error) {
      logger.error("Failed to get all businesses:", error);
      throw error;
    }
  }

  public async upsertBusiness(userId: number, business: any) {
    try {
      const existingBusiness = await this.repository.findByUserId(userId);

      if (existingBusiness) {
        // Update existing business
        await this.repository.update(existingBusiness.id, business);
        return { ...existingBusiness, ...business };
      } else {
        // Create new business
        const newBusiness = await this.repository.create({
          ...business,
          user_id: userId,
        });
        return newBusiness[0];
      }
    } catch (error) {
      logger.error("Failed to upsert business:", error);
      throw error;
    }
  }
}
