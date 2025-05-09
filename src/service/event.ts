import { logger } from '../lib/logger.js';
import type { EventRepository } from '../repository/event.ts';
import type { Asset, Booking, Event, NewEvent } from '../schema/schema.js';
import { sendTransactionalEmail } from '../task/sendWelcomeEmail.js';
import { EventQuery } from '../web/validator/event.ts';
import type { LeadService } from './lead.ts';
import type { S3Service } from './s3.js';

/**
 * Type representing an event with its associated asset and host information
 */
type EventWithAsset = Event & {
  asset?: (Asset & { presignedUrl: string }) | null;
  host?: {
    name: string;
    email: string;
    profile_image: string | null;
    id: number;
  } | null;
  leadCount?: number;

  memberships: Array<{
    id: number;
    created_at: Date | null;
    updated_at: Date | null;
    event_id: number;
    membership_id: number;
    membership: {
      id: number;
      name: string;
      created_at: Date | null;
      updated_at: Date | null;
      user_id: number;
      description: string | null;
      price: number;
      payment_type: 'one_off' | 'recurring' | null;
      price_point: 'standalone' | 'course' | null;
    } | null;
  }>;
};

/**
 * Type representing an event with its related entities
 */
type EventWithRelations = {
  event: Event;
  asset: Asset | null;
  host: {
    name: string;
    email: string;
    profile_image: string | null;
  } | null;
  membership?: {
    id: number;
    name: string;
    created_at: Date | null;
    updated_at: Date | null;
    user_id: number;
    description: string | null;
    price: number;
    payment_type: 'one_off' | 'recurring' | null;
  } | null;
};

/**
 * Service class for managing events, including creation, retrieval, updates, and related operations
 */
export class EventService {
  private repository: EventRepository;
  private s3Service: S3Service;
  private leadService: LeadService;

  constructor(repository: EventRepository, s3Service: S3Service, leadService: LeadService) {
    this.repository = repository;
    this.s3Service = s3Service;
    this.leadService = leadService;
  }

  /**
   * Creates a new event
   * @param {NewEvent} event - The event details to create
   * @returns {Promise<number>} ID of the created event
   * @throws {Error} When event creation fails
   */
  public async createEvent(event: NewEvent) {
    try {
      // Create the event
      const newEventId = await this.repository.create(event);
      return newEventId;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves an event by ID with associated asset and host information
   * @param {number} id - ID of the event
   * @returns {Promise<EventWithAsset|undefined>} The event with its relations if found
   */
  public async getEvent(id: number): Promise<EventWithAsset | undefined> {
    const result = await this.repository.find(id);
    if (!result || !result.event) return undefined;

    const { event, asset, host, memberships } = result;

    // Get lead count for this event
    const leads = await this.leadService.findByEventId(event.id);
    const leadCount = leads ? leads.length : 0;

    if (asset?.asset_url) {
      const presignedUrl = await this.s3Service.generateGetUrl(
        this.getKeyFromUrl(asset.asset_url),
        this.getContentType(asset.asset_type as string),
        86400, // 24 hours
      );
      return {
        ...event,
        asset: {
          ...asset,
          presignedUrl,
        },
        host,
        leadCount,
        memberships,
      };
    }

    return {
      ...event,
      asset: null,
      host,
      leadCount,
      memberships,
    };
  }

  /**
   * Retrieves only the event data without relations
   * @param {number} id - ID of the event
   * @returns {Promise<Event>} The event data
   */
  public async getEventOnly(id: number) {
    const result = await this.repository.find(id);
    return result.event;
  }

  /**
   * Retrieves all events with optional filtering
   * @param {EventQuery} [query] - Query parameters for filtering events
   * @returns {Promise<{events: EventWithRelations[], total: number}>} List of events and total count
   */
  public async getAllEvents(
    query?: EventQuery,
  ): Promise<{ events: EventWithRelations[]; total: number }> {
    return await this.repository.findAll(query);
  }

  /**
   * Retrieves events for a specific user
   * @param {number} userId - ID of the user
   * @param {EventQuery} [query] - Query parameters for filtering events
   * @returns {Promise<{events: EventWithRelations[], total: number}>} List of events and total count
   */
  public async getEventsByUser(
    userId: number,
    query?: EventQuery,
  ): Promise<{ events: EventWithRelations[]; total: number }> {
    return await this.repository.findByUserId(userId, query);
  }

  /**
   * Updates an existing event
   * @param {number} id - ID of the event to update
   * @param {Object} event - Updated event data
   * @param {number[]} [event.memberships] - Array of membership IDs
   * @returns {Promise<void>}
   */
  public async updateEvent(
    id: number,
    event: Omit<Partial<Event>, 'memberships'> & { memberships?: number[] },
  ): Promise<void> {
    const { memberships, ...rest } = event;

    if (memberships) {
      // Get current memberships
      const currentMemberships = await this.repository.findMembershipsByEventId(id);
      const currentMembershipIds = currentMemberships.map((m) => m.membership_id);

      // Find memberships to add and remove
      const membershipsToAdd = memberships.filter((id) => !currentMembershipIds.includes(id));
      const membershipsToRemove = currentMembershipIds.filter((id) => !memberships.includes(id));

      // Remove memberships that are no longer needed
      if (membershipsToRemove.length > 0) {
        await this.repository.deleteEventMemberships(id, membershipsToRemove);
      }

      // Add new memberships
      if (membershipsToAdd.length > 0) {
        await this.repository.addMemberships(id, membershipsToAdd);
      }
    }

    await this.repository.update(id, rest);
  }

  /**
   * Updates the status of an event
   * @param {number} id - ID of the event
   * @param {'cancelled'|'active'|'suspended'} status - New status for the event
   * @returns {Promise<void>}
   */
  public async cancelEvent(
    id: number,
    status: 'cancelled' | 'active' | 'suspended',
  ): Promise<void> {
    await this.repository.cancel(id, status);
  }

  /**
   * Deletes an event
   * @param {number} id - ID of the event to delete
   * @returns {Promise<void>}
   */
  public async deleteEvent(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Extracts the key from an S3 URL
   * @private
   * @param {string} url - S3 URL
   * @returns {string} The extracted key
   */
  private getKeyFromUrl(url: string): string {
    const urlParts = url.split('.amazonaws.com/');
    return urlParts[1] || '';
  }

  /**
   * Determines the content type based on asset type
   * @private
   * @param {string} assetType - Type of the asset
   * @returns {string} The corresponding content type
   */
  private getContentType(assetType: string): string {
    switch (assetType) {
      case 'image':
        return 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'audio':
        return 'audio/mpeg';
      case 'document':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Finds an event by its associated asset ID
   * @param {number} assetId - ID of the asset
   * @returns {Promise<Event>} The event associated with the asset
   */
  public async findByAssetId(assetId: number) {
    return this.repository.findByAssetId(assetId);
  }

  /**
   * Retrieves memberships associated with an event
   * @param {number} eventId - ID of the event
   * @returns {Promise<Array>} List of memberships for the event
   * @throws {Error} When membership retrieval fails
   */
  public async getMembershipsByEventId(eventId: number) {
    try {
      return await this.repository.findMembershipsByEventId(eventId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves a specific event date
   * @param {number} dateId - ID of the event date
   * @returns {Promise<Object>} The event date information
   * @throws {Error} When event date retrieval fails
   */
  public async getEventDate(dateId: number) {
    try {
      return await this.repository.findEventDate(dateId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Sends information to all attendees of an event
   * @param {Event} event - The event
   * @param {Object} data - Email data to send
   * @param {string} data.subject - Email subject
   * @param {string} data.title - Email title
   * @param {string} data.subtitle - Email subtitle
   * @param {string} data.body - Email body
   * @param {string} data.buttonText - Text for email button
   * @param {string} data.buttonLink - Link for email button
   * @returns {Promise<void>}
   */
  public async informAttendees(
    event: Event,
    data: {
      subject: string;
      title: string;
      subtitle: string;
      body: string;
      buttonText: string;
      buttonLink: string;
    },
  ) {
    // Get all bookings for this date
    const bookings = await this.repository.findBookingsByEventId(event.id);

    // Send emails to all booked users
    await Promise.all(
      bookings.map(async (booking: Booking) => {
        const lead = await this.leadService.find(booking.lead_id);
        if (lead?.email && lead?.name) {
          await sendTransactionalEmail(
            lead.email,
            lead.name,
            1, // Use appropriate template ID
            data,
          );
        }
      }),
    );
  }
}
