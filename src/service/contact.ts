import { encrypt } from "../lib/encryption.js";
import type { ContactRepository } from "../repository/contact.ts";
import type { Contact, NewContact } from "../schema/schema.js";

export class ContactService {
  private repository: ContactRepository;

  constructor(repository: ContactRepository) {
    this.repository = repository;
  }

  public async findByEmail(email: string) {
    return this.repository.findByEmail(email);
  }

  public async createFromLead(name: string, email: string, phone: string, token: string, stripeCustomerId: string) {
    // Generate password for the contact from his token
    const hashedPassword = encrypt(token);

    const contact: NewContact = {
      name,
      email,
      phone,
      password: hashedPassword,
      role: "lead",
      is_verified: true,
      stripe_customer_id: stripeCustomerId,
    };

    return this.repository.create(contact);
  }

  public async update(id: number, contact: Partial<Contact>) {
    return this.repository.update(id, contact);
  }
}
