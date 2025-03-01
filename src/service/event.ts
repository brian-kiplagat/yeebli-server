import type { EventRepository } from '../repository/event.ts';
import type { Event, NewEvent } from '../schema/schema.js';

export class EventService {
  private repository: EventRepository;

  constructor(repository: EventRepository) {
    this.repository = repository;
  }

  public async createEvent(lead: NewEvent): Promise<void> {
    await this.repository.create(lead);
  }

  public async getEvent(id: number): Promise<Event | undefined> {
    return this.repository.find(id);
  }

  public async getAllEvents(): Promise<Event[]> {
    return this.repository.findAll();
  }

  public async getEventsByUser(userId: number): Promise<Event[]> {
    return this.repository.findByUserId(userId);
  }

  public async updateEvent(id: number, lead: Partial<Event>): Promise<void> {
    await this.repository.update(id, lead);
  }

  public async deleteEvent(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
