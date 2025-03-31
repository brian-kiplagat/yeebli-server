import { logger } from "../lib/logger.js";
import { PricePlanRepository } from "../repository/pricePlan.ts";
import type { NewPricePlan, PricePlan } from "../schema/schema.ts";

type PricePlanQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export class PricePlanService {
  private repository: PricePlanRepository;

  constructor(repository: PricePlanRepository) {
    this.repository = repository;
  }

  public async createPricePlan(plan: NewPricePlan): Promise<number> {
    try {
      return await this.repository.create(plan);
    } catch (error) {
      logger.error("Failed to create price plan:", error);
      throw error;
    }
  }

  public async getPricePlan(id: number): Promise<PricePlan | undefined> {
    return await this.repository.find(id);
  }

  public async getAllPricePlans(
    query?: PricePlanQuery
  ): Promise<{ plans: PricePlan[]; total: number }> {
    return await this.repository.findAll(query);
  }

  public async updatePricePlan(
    id: number,
    plan: Partial<PricePlan>
  ): Promise<void> {
    await this.repository.update(id, plan);
  }

  public async deletePricePlan(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  public async getPricePlansByUser(
    userId: number,
    query?: PricePlanQuery
  ): Promise<{ plans: PricePlan[]; total: number }> {
    try {
      return await this.repository.findByUserId(userId, query);
    } catch (error) {
      logger.error("Failed to get price plans by user:", error);
      throw error;
    }
  }
}
