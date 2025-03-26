import type { EventQuery, EventRepository } from '../repository/event.ts';
import type { Asset, Event, NewEvent } from '../schema/schema.js';
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

  public async createEvent(event: NewEvent): Promise<number> {
    const result = await this.repository.create(event);
    return result[0].id;
  }

  public async getEvent(id: number): Promise<EventWithAsset | undefined> {
    const result = await this.repository.find(id);
    if (!result) return undefined;

    const { event, asset, host } = result;

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
      };
    }

    return {
      ...event,
      asset: null,
      host,
      leadCount,
    };
  }

  public async getAllEvents(query?: EventQuery): Promise<{ events: Event[]; total: number }> {
    return this.repository.findAll(query);
  }

  public async getEventsByUser(userId: number, query?: EventQuery): Promise<{ events: Event[]; total: number }> {
    return this.repository.findByUserId(userId, query);
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
}
