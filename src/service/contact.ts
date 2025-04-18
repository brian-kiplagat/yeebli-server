import { encrypt, verify } from '../lib/encryption.js';
import env from '../lib/env.js';
import type { ContactRepository } from '../repository/contact.ts';
import type { Contact, NewContact } from '../schema/schema.js';
import { sendTransactionalEmail } from '../task/sendWelcomeEmail.ts';

export class ContactService {
  private repository: ContactRepository;

  constructor(repository: ContactRepository) {
    this.repository = repository;
  }

  public async findByEmail(email: string) {
    return this.repository.findByEmail(email);
  }

  public async findById(id: number) {
    return this.repository.findById(id);
  }

  public async createFromLead(
    name: string,
    email: string,
    phone: string,
    token: string,
    stripeCustomerId: string,
  ) {
    const hashedPassword = encrypt(token);
    const contact: NewContact = {
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'lead',
      is_verified: true,
      stripe_customer_id: stripeCustomerId,
    };
    return this.repository.create(contact);
  }

  public async update(id: number, contact: Partial<Contact>) {
    return this.repository.update(id, contact);
  }

  public async register(data: { name: string; email: string; password: string; phone: string }) {
    const existingContact = await this.findByEmail(data.email);
    if (existingContact) {
      throw new Error('Email already registered');
    }

    const hashedPassword = encrypt(data.password);
    const emailToken = Math.floor(100000 + Math.random() * 900000).toString();

    await this.repository.create({
      ...data,
      password: hashedPassword,
      email_token: emailToken,
      is_verified: false,
      role: 'user',
    });

    const createdContact = await this.findByEmail(data.email);
    if (!createdContact) {
      throw new Error('Failed to create contact');
    }

    await sendTransactionalEmail(createdContact.email, createdContact.name, 1, {
      subject: 'Your code',
      title: 'Thanks for signing up',
      subtitle: `${emailToken}`,
      body: `Welcome to Yeebli. Your code is ${emailToken}`,
    });

    return createdContact;
  }

  public async sendToken(email: string) {
    const contact = await this.findByEmail(email);
    if (!contact) {
      throw new Error('Email not found');
    }

    const emailToken = Math.floor(100000 + Math.random() * 900000).toString();
    await this.repository.update(contact.id, { email_token: emailToken });

    await sendTransactionalEmail(contact.email, contact.name, 1, {
      subject: 'Your code',
      title: 'Thanks for signing up',
      subtitle: `${emailToken}`,
      body: `Welcome to Yeebli. Your code is ${emailToken}`,
    });

    return { message: 'Verification email sent' };
  }

  public async verifyRegistrationToken(id: number, token: string) {
    const contact = await this.findById(id);
    if (!contact) {
      throw new Error('Contact not found');
    }

    if (contact.email_token !== token) {
      throw new Error('Invalid token');
    }

    await this.repository.update(id, { is_verified: true });
    return { message: 'Email verified successfully' };
  }

  public async requestResetPassword(email: string) {
    const contact = await this.findByEmail(email);
    if (!contact) {
      throw new Error('Email not found');
    }

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    await this.repository.update(contact.id, { reset_token: resetToken });

    await sendTransactionalEmail(contact.email, contact.name, 1, {
      subject: 'Reset password',
      title: 'Reset password',
      subtitle: `${resetToken}`,
      body: `Please click this link to reset your password: ${env.FRONTEND_URL}/onboarding/reset?token=${resetToken}&email=${contact.email}`,
      cta_url: `${env.FRONTEND_URL}/onboarding/reset?token=${resetToken}&email=${contact.email}`,
    });

    return { message: 'Reset password link sent successfully' };
  }

  public async resetPassword(email: string, token: string, newPassword: string) {
    const contact = await this.findByEmail(email);
    if (!contact) {
      throw new Error('Email not found');
    }

    if (contact.reset_token !== token) {
      throw new Error('Invalid token');
    }

    const hashedPassword = encrypt(newPassword);
    await this.repository.update(contact.id, {
      password: hashedPassword,
      reset_token: null,
    });

    return { message: 'Password reset successfully' };
  }

  public async resetPasswordInApp(contactId: number, oldPassword: string, newPassword: string) {
    const contact = await this.findById(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    const isValidPassword = verify(oldPassword, contact.password);
    if (!isValidPassword) {
      throw new Error('Invalid current password');
    }

    const hashedPassword = encrypt(newPassword);
    await this.repository.update(contactId, { password: hashedPassword });

    return { message: 'Password updated successfully' };
  }

  public async getContactById(id: number) {
    const contact = await this.findById(id);
    if (!contact) {
      throw new Error('Contact not found');
    }
    return contact;
  }

  public async updateContactDetails(id: number, data: Partial<Contact>) {
    const contact = await this.findById(id);
    if (!contact) {
      throw new Error('Contact not found');
    }

    const updatedContact = await this.repository.update(id, data);
    return updatedContact;
  }
}
