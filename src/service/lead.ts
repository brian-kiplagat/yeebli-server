import { Lead } from "../schema/schema.ts";
import { LeadQuery, LeadRepository } from "../repository/lead.ts";
import { NewLead } from "../schema/schema.ts";

export class LeadService {
  private repository: LeadRepository;

  constructor(repository: LeadRepository) {
    this.repository = repository;
  }

  public async create(lead: NewLead) {
    return this.repository.create(lead);
  }

  public async find(id: number) {
    return this.repository.find(id);
  }

  public async findByEventId(eventId: number) {
    return this.repository.findByEventId(eventId);
  }

  public async findAll(query?: LeadQuery) {
    return this.repository.findAll(query);
  }

  public async findByUserId(userId: number, query?: LeadQuery) {
    return this.repository.findByUserId(userId, query);
  }

  public async update(id: number, lead: Partial<Lead>) {
    return this.repository.update(id, lead);
  }

  public async delete(id: number) {
    return this.repository.delete(id);
  }
}
