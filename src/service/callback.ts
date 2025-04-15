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
      const callback = await this.repository.createCallback(data);
      return callback[0].id;
    } catch (error) {
      logger.error("Failed to create callback:", error);
      throw error;
    }
  }

  public async getCallbackByLeadIdAndEventIdAndCallbackType(leadId: number, eventId: number, callbackType: "instant" | "scheduled"): Promise<Callback | undefined> {
    try {
      return await this.repository.findCallbackByLeadIdAndEventIdAndCallbackType(leadId, eventId, callbackType);
    } catch (error) {
      logger.error("Failed to get callback by lead ID and event ID and callback type:", error);
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
    data: Partial<Callback>
  ): Promise<void> {
    try {
      

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
