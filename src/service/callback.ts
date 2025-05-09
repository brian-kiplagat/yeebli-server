import { logger } from '../lib/logger.ts';
import type { CallbackRepository } from '../repository/callback.ts';
import type { Callback, NewCallback } from '../schema/schema.ts';

/**
 * Service class for managing callback requests and scheduling
 */
export class CallbackService {
  private repository: CallbackRepository;

  constructor(repository: CallbackRepository) {
    this.repository = repository;
  }

  /**
   * Creates a new callback request
   * @param {NewCallback} data - The callback details to create
   * @returns {Promise<number>} ID of the created callback
   * @throws {Error} When callback creation fails
   */
  public async createCallback(data: NewCallback): Promise<number> {
    try {
      const callback = await this.repository.createCallback(data);
      return callback[0].id;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Finds a callback by lead ID, event ID, and callback type
   * @param {number} leadId - ID of the lead
   * @param {number} eventId - ID of the event
   * @param {'instant'|'scheduled'} callbackType - Type of callback
   * @returns {Promise<Callback|undefined>} The callback if found
   * @throws {Error} When callback retrieval fails
   */
  public async getCallbackByLeadIdAndEventIdAndCallbackType(
    leadId: number,
    eventId: number,
    callbackType: 'instant' | 'scheduled',
  ): Promise<Callback | undefined> {
    try {
      return await this.repository.findCallbackByLeadIdAndEventIdAndCallbackType(
        leadId,
        eventId,
        callbackType,
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves a callback by its ID
   * @param {number} id - ID of the callback
   * @returns {Promise<Callback|undefined>} The callback if found
   * @throws {Error} When callback retrieval fails
   */
  public async getCallback(id: number): Promise<Callback | undefined> {
    try {
      return await this.repository.findCallbackById(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves all callbacks for a specific lead
   * @param {number} leadId - ID of the lead
   * @returns {Promise<Callback[]>} List of callbacks for the lead
   * @throws {Error} When callback retrieval fails
   */
  public async getCallbacksByLeadId(leadId: number): Promise<Callback[]> {
    try {
      return await this.repository.findCallbacksByLeadId(leadId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves all uncalled callbacks for a host
   * @param {number} hostId - ID of the host
   * @returns {Promise<Callback[]>} List of uncalled callbacks
   * @throws {Error} When callback retrieval fails
   */
  public async getUncalledCallbacks(hostId: number): Promise<Callback[]> {
    try {
      return await this.repository.findUncalledCallbacks(hostId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves all scheduled callbacks
   * @returns {Promise<Callback[]>} List of scheduled callbacks
   * @throws {Error} When callback retrieval fails
   */
  public async getScheduledCallbacks(): Promise<Callback[]> {
    try {
      return await this.repository.findScheduledCallbacks();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Updates an existing callback
   * @param {number} id - ID of the callback to update
   * @param {Partial<Callback>} data - Updated callback data
   * @returns {Promise<void>}
   * @throws {Error} When callback update fails
   */
  public async updateCallback(id: number, data: Partial<Callback>): Promise<void> {
    try {
      await this.repository.updateCallback(id, data);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Deletes a callback
   * @param {number} id - ID of the callback to delete
   * @returns {Promise<void>}
   * @throws {Error} When callback deletion fails
   */
  public async deleteCallback(id: number): Promise<void> {
    try {
      await this.repository.deleteCallback(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Marks a callback as completed
   * @param {number} id - ID of the callback to mark as called
   * @returns {Promise<void>}
   * @throws {Error} When status update fails
   */
  public async markCallbackAsCalled(id: number): Promise<void> {
    try {
      await this.repository.markCallbackAsCalled(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
