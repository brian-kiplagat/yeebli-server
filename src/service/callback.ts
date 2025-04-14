import { logger } from "../lib/logger.ts";
import type { CallbackRepository } from "../repository/callback.ts";
import type { Callback, NewCallback } from "../schema/schema.ts";

export class CallbackService {
  private repository: CallbackRepository;

  constructor(repository: CallbackRepository) {
    this.repository = repository;
  }

  public async createCallback(data: NewCallback): Promise<number> {
    try {
      // Validate scheduled time for scheduled callbacks
      if (data.callback_type === "scheduled" && !data.scheduled_time) {
        throw new Error("Scheduled time is required for scheduled callbacks");
      }

      return await this.repository.createCallback(data);
    } catch (error) {
      logger.error("Failed to create callback:", error);
      throw error;
    }
  }

  public async getCallback(id: number): Promise<Callback | undefined> {
    try {
      return await this.repository.findCallbackById(id);
    } catch (error) {
      logger.error("Failed to get callback:", error);
      throw error;
    }
  }

  public async getCallbacksByLeadId(leadId: number): Promise<Callback[]> {
    try {
      return await this.repository.findCallbacksByLeadId(leadId);
    } catch (error) {
      logger.error("Failed to get callbacks by lead ID:", error);
      throw error;
    }
  }

  public async getUncalledCallbacks(): Promise<Callback[]> {
    try {
      return await this.repository.findUncalledCallbacks();
    } catch (error) {
      logger.error("Failed to get uncalled callbacks:", error);
      throw error;
    }
  }

  public async getScheduledCallbacks(): Promise<Callback[]> {
    try {
      return await this.repository.findScheduledCallbacks();
    } catch (error) {
      logger.error("Failed to get scheduled callbacks:", error);
      throw error;
    }
  }

  public async updateCallback(
    id: number,
    data: Partial<typeof callbackSchema.$inferInsert>
  ): Promise<void> {
    try {
      // Validate scheduled time for scheduled callbacks
      if (data.callback_type === "scheduled" && !data.scheduled_time) {
        throw new Error("Scheduled time is required for scheduled callbacks");
      }

      await this.repository.updateCallback(id, data);
    } catch (error) {
      logger.error("Failed to update callback:", error);
      throw error;
    }
  }

  public async deleteCallback(id: number): Promise<void> {
    try {
      await this.repository.deleteCallback(id);
    } catch (error) {
      logger.error("Failed to delete callback:", error);
      throw error;
    }
  }

  public async markCallbackAsCalled(id: number): Promise<void> {
    try {
      await this.repository.markCallbackAsCalled(id);
    } catch (error) {
      logger.error("Failed to mark callback as called:", error);
      throw error;
    }
  }
}
