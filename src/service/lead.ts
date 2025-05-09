import type { LeadQuery, LeadRepository } from '../repository/lead.ts';
import type { Lead, NewTag, NewTagAssignment } from '../schema/schema.ts';
import type { NewLead } from '../schema/schema.ts';
import type { ContactService } from './contact.ts';
import type { StripeService } from './stripe.ts';

/**
 * Service class for managing leads, including creation, updates, and tag management
 */
export class LeadService {
  private repository: LeadRepository;
  private contactService: ContactService;
  private stripeService: StripeService;

  /**
   * Creates an instance of LeadService
   * @param {LeadRepository} repository - Repository for lead operations
   * @param {ContactService} contactService - Service for managing contacts
   * @param {StripeService} stripeService - Service for managing Stripe integrations
   */
  constructor(
    repository: LeadRepository,
    contactService: ContactService,
    stripeService: StripeService,
  ) {
    this.repository = repository;
    this.contactService = contactService;
    this.stripeService = stripeService;
  }

  /**
   * Creates a new lead and associated contact if needed
   * @param {NewLead} lead - The lead information to create
   * @returns {Promise<number>} ID of the created lead
   */
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

  /**
   * Creates a new tag
   * @param {NewTag} tag - The tag information to create
   * @returns {Promise<number>} ID of the created tag
   */
  public async createTag(tag: NewTag) {
    return this.repository.createTag(tag);
  }

  /**
   * Assigns a tag to a lead
   * @param {NewTagAssignment} tagAssignment - The tag assignment information
   * @returns {Promise<number>} ID of the created tag assignment
   */
  public async createTagAssignment(tagAssignment: NewTagAssignment) {
    return this.repository.createTagAssignment(tagAssignment);
  }

  /**
   * Deletes a tag
   * @param {number} tagId - ID of the tag to delete
   * @returns {Promise<void>}
   */
  public async deleteTag(tagId: number) {
    return this.repository.deleteTag(tagId);
  }

  /**
   * Removes a tag assignment from a lead
   * @param {number} tagId - ID of the tag
   * @param {number} leadId - ID of the lead
   * @returns {Promise<void>}
   */
  public async deleteTagAssignment(tagId: number, leadId: number) {
    return this.repository.deleteTagAssignment(tagId, leadId);
  }

  /**
   * Finds a tag by its ID
   * @param {number} tagId - ID of the tag
   * @returns {Promise<Tag|undefined>} The tag if found
   */
  public async findTag(tagId: number) {
    return this.repository.findTag(tagId);
  }

  /**
   * Finds all tags assigned to a lead
   * @param {number} leadId - ID of the lead
   * @returns {Promise<Tag[]>} List of tags assigned to the lead
   */
  public async findTagsByLeadId(leadId: number) {
    return this.repository.findTagsByLeadId(leadId);
  }

  /**
   * Finds a lead by its ID
   * @param {number} id - ID of the lead
   * @returns {Promise<Lead|undefined>} The lead if found
   */
  public async find(id: number) {
    return this.repository.find(id);
  }

  /**
   * Finds leads associated with an event
   * @param {number} eventId - ID of the event
   * @returns {Promise<Lead[]>} List of leads for the event
   */
  public async findByEventId(eventId: number) {
    return this.repository.findByEventId(eventId);
  }

  /**
   * Finds a lead by event ID and token
   * @param {number} eventId - ID of the event
   * @param {string} token - Lead token
   * @returns {Promise<Lead|undefined>} The lead if found
   */
  public async findByEventIdAndToken(eventId: number, token: string) {
    return this.repository.findByEventIdAndToken(eventId, token);
  }

  /**
   * Retrieves all leads with optional filtering
   * @param {LeadQuery} [query] - Query parameters for filtering leads
   * @returns {Promise<{leads: Lead[], total: number}>} List of leads and total count
   */
  public async findAll(query?: LeadQuery) {
    return this.repository.findAll(query);
  }

  /**
   * Finds leads associated with a user
   * @param {number} userId - ID of the user
   * @param {LeadQuery} [query] - Query parameters for filtering leads
   * @returns {Promise<{leads: Lead[], total: number}>} List of leads and total count
   */
  public async findByUserId(userId: number, query?: LeadQuery) {
    return this.repository.findByUserId(userId, query);
  }

  /**
   * Finds leads associated with a user, including their events
   * @param {number} userId - ID of the user
   * @param {LeadQuery} [query] - Query parameters for filtering leads
   * @returns {Promise<{leads: Lead[], total: number}>} List of leads with events and total count
   */
  public async findByUserIdWithEvents(userId: number, query?: LeadQuery) {
    return this.repository.findByUserIdWithEvents(userId, query);
  }

  /**
   * Updates a lead's information
   * @param {number} id - ID of the lead to update
   * @param {Partial<Lead>} lead - Updated lead information
   * @returns {Promise<Lead>} The updated lead
   */
  public async update(id: number, lead: Partial<Lead>) {
    return this.repository.update(id, lead);
  }

  /**
   * Deletes a lead
   * @param {number} id - ID of the lead to delete
   * @returns {Promise<void>}
   */
  public async delete(id: number) {
    return this.repository.delete(id);
  }

  /**
   * Retrieves all available tags
   * @returns {Promise<Tag[]>} List of all tags
   */
  public async getTags() {
    return this.repository.getTags();
  }
}
