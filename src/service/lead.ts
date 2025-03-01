import type { LeadRepository } from '../repository/lead.js';
import type { Lead, NewLead } from '../schema/schema.js';

export class LeadService {
  private repository: LeadRepository;

  constructor(repository: LeadRepository) {
    this.repository = repository;
  }

  public async createLead(lead: NewLead): Promise<void> {
    await this.repository.create(lead);
  }

  public async getLead(id: number): Promise<Lead | undefined> {
    return this.repository.find(id);
  }

  public async getAllLeads(): Promise<Lead[]> {
    return this.repository.findAll();
  }

  public async getLeadsByUser(userId: number): Promise<Lead[]> {
    return this.repository.findByUserId(userId);
  }

  public async updateLead(id: number, lead: Partial<Lead>): Promise<void> {
    await this.repository.update(id, lead);
  }

  public async deleteLead(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
