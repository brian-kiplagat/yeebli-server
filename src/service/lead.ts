import type { Lead } from "../lib/database.js";
import type { LeadRepository, LeadQuery } from "../repository/lead.js";

export class LeadService {
  private repository: LeadRepository;

  constructor(repository: LeadRepository) {
    this.repository = repository;
  }

  public async create(lead: Lead) {
    return this.repository.create(lead);
  }

  public async find(id: number) {
    return this.repository.find(id);
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
