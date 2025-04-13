import { eq } from 'drizzle-orm';
import { db } from '../lib/database.ts';
import { type Contact, type NewContact, contactSchema } from '../schema/schema.js';

export class ContactRepository {
  public async create(contact: NewContact) {
    return db.insert(contactSchema).values(contact);
  }

  public async findByEmail(email: string) {
    return db.query.contactSchema.findFirst({
      where: eq(contactSchema.email, email),
    });
  }

  public async findById(id: number) {
    return db.query.contactSchema.findFirst({
      where: eq(contactSchema.id, id),
    });
  }

  public async update(id: number, contact: Partial<Contact>) {
    return db.update(contactSchema).set(contact).where(eq(contactSchema.id, id));
  }
}
