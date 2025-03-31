import { logger } from '../lib/logger.js';
import type { EventQuery, EventRepository } from '../repository/event.ts';
import type { Asset, Booking, Event, NewEvent } from '../schema/schema.js';
import { sendTransactionalEmail } from '../task/sendWelcomeEmail.js';
import type { LeadService } from './lead.ts';
import type { S3Service } from './s3.js';

type EventWithAsset = Event & {
  asset?: (Asset & { presignedUrl: string }) | null;
  host?: {
    name: string;
    email: string;
    profile_image: string | null;
  } | null;
  leadCount?: number;
  dates: Array<{
    id: number;
    event_id: number;
    date: string;
    created_at: Date | null;
    updated_at: Date | null;
  }>;
};

type EventWithRelations = {
  event: Event;
  asset: Asset | null;
  host: {
    name: string;
    email: string;
    profile_image: string | null;
  } | null;
  dates: Array<{
    id: number;
    event_id: number;
    date: string;
    created_at: Date | null;
    updated_at: Date | null;
  }>;
};

export class EventService {
  private repository: EventRepository;
  private s3Service: S3Service;
  private leadService: LeadService;

  constructor(repository: EventRepository, s3Service: S3Service, leadService: LeadService) {
    this.repository = repository;
    this.s3Service = s3Service;
    this.leadService = leadService;
  }

  public async createEvent(event: NewEvent) {
    try {
      // Create the event
      const newEvent = await this.repository.create(event);

      // Create all event dates in parallel
      if (event.dates && Array.isArray(event.dates)) {
        await Promise.all(
          event.dates.map((date) =>
            this.repository.createEventDate({
              event_id: newEvent[0].id,
              date: date,
            }),
          ),
        );
      }

      return newEvent;
    } catch (error) {
      logger.error('Failed to create event:', error);
      throw error;
    }
  }

  public async getEvent(id: number): Promise<EventWithAsset | undefined> {
    const result = await this.repository.find(id);
    if (!result) return undefined;

    const { event, asset, host, dates } = result;

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
        dates,
      };
    }

    return {
      ...event,
      asset: null,
      host,
      leadCount,
      dates,
    };
  }

  public async getAllEvents(query?: EventQuery): Promise<{ events: EventWithRelations[]; total: number }> {
    return await this.repository.findAll(query);
  }

  public async getEventsByUser(
    userId: number,
    query?: EventQuery,
  ): Promise<{ events: EventWithRelations[]; total: number }> {
    return await this.repository.findByUserId(userId, query);
  }

  public async updateEvent(id: number, event: Partial<Event>): Promise<void> {
    await this.repository.update(id, event);
  }

  public async cancelEvent(id: number, status: 'cancelled' | 'active' | 'suspended'): Promise<void> {
    await this.repository.cancel(id, status);
  }

  public async deleteEvent(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  private getKeyFromUrl(url: string): string {
    const urlParts = url.split('.amazonaws.com/');
    return urlParts[1] || '';
  }

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

  public async findByAssetId(assetId: number) {
    return this.repository.findByAssetId(assetId);
  }

  public async deleteEventDate(dateId: number): Promise<void> {
    // Get the event date details
    const date = await this.repository.findEventDate(dateId);
    if (!date) {
      throw new Error('Event date not found');
    }

    // Get the event details
    const event = await this.repository.find(date.event_id);
    if (!event) {
      throw new Error('Event not found');
    }

    // Get all bookings for this date
    const bookings = await this.repository.findBookingsByDateId(dateId);

    // Send emails to all booked users
    await Promise.all(
      bookings.map(async (booking: Booking) => {
        const lead = await this.leadService.find(booking.lead_id);
        if (lead?.email && lead?.name) {
          await sendTransactionalEmail(
            lead.email,
            lead.name,
            1, // Use appropriate template ID
            {
              subject: 'Event Date Cancelled',
              title: 'Event Date Cancelled',
              subtitle: `The event "${event.event.event_name}" has been cancelled for ${date.date}`,
              body: `We regret to inform you that the event "${event.event.event_name}" scheduled for ${date.date} has been cancelled.`,
            },
          );
        }
      }),
    );

    // Delete the event date
    await this.repository.deleteEventDate(dateId);
  }
}
