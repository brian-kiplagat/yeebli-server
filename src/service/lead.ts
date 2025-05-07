import type { LeadQuery, LeadRepository } from '../repository/lead.ts';
import type { Lead, NewTag } from '../schema/schema.ts';
import type { NewLead } from '../schema/schema.ts';
import type { ContactService } from './contact.ts';
import type { StripeService } from './stripe.ts';

export class LeadService {
  private repository: LeadRepository;
  private contactService: ContactService;
  private stripeService: StripeService;

  constructor(
    repository: LeadRepository,
    contactService: ContactService,
    stripeService: StripeService,
  ) {
    this.repository = repository;
    this.contactService = contactService;
    this.stripeService = stripeService;
  }

  public async create(lead: NewLead) {
    // First check if a contact with this email exists
    if (lead.email) {
      const existingContact = await this.contactService.findByEmail(lead.email);

      // If no contact exists, create one
      if (!existingContact && lead.name && lead.phone) {
        const stripeCustomer = await this.stripeService.createCustomer(lead.email);
        await this.contactService.createFromLead(
          lead.name,
          lead.email,
          lead.phone,
          String(lead.token),
          stripeCustomer.id,
        );
      }
    }

    return this.repository.create(lead);
  }

  public async createTag(tag: NewTag) {
    return this.repository.createTag(tag);
  }

  public async deleteTag(tagId: number) {
    return this.repository.deleteTag(tagId);
  }

  public async findTag(tagId: number) {
    return this.repository.findTag(tagId);
  }

  public async findTagsByLeadId(leadId: number) {
    return this.repository.findTagsByLeadId(leadId);
  }

  public async find(id: number) {
    return this.repository.find(id);
  }

  public async findByEventId(eventId: number) {
    return this.repository.findByEventId(eventId);
  }

  public async findByEventIdAndToken(eventId: number, token: string) {
    return this.repository.findByEventIdAndToken(eventId, token);
  }

  public async findAll(query?: LeadQuery) {
    return this.repository.findAll(query);
  }

  public async findByUserId(userId: number, query?: LeadQuery) {
    return this.repository.findByUserId(userId, query);
  }

  public async findByUserIdWithEvents(userId: number, query?: LeadQuery) {
    return this.repository.findByUserIdWithEvents(userId, query);
  }

  public async update(id: number, lead: Partial<Lead>) {
    return this.repository.update(id, lead);
  }

  public async delete(id: number) {
    return this.repository.delete(id);
  }
}
