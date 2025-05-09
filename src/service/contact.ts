import { encrypt, verify } from '../lib/encryption.js';
import env from '../lib/env.js';
import type { ContactRepository } from '../repository/contact.ts';
import type { Contact, NewContact } from '../schema/schema.js';
import { sendTransactionalEmail } from '../task/sendWelcomeEmail.ts';

/**
 * Service class for managing contacts, including user registration, authentication, and profile management
 */
export class ContactService {
  private repository: ContactRepository;

  constructor(repository: ContactRepository) {
    this.repository = repository;
  }

  /**
   * Finds a contact by their email address
   * @param {string} email - Email address to search for
   * @returns {Promise<Contact|undefined>} The contact if found
   */
  public async findByEmail(email: string) {
    return this.repository.findByEmail(email);
  }

  /**
   * Finds a contact by their ID
   * @param {number} id - ID of the contact to find
   * @returns {Promise<Contact|undefined>} The contact if found
   */
  public async findById(id: number) {
    return this.repository.findById(id);
  }

  /**
   * Creates a new contact from lead information
   * @param {string} name - Contact's name
   * @param {string} email - Contact's email
   * @param {string} phone - Contact's phone number
   * @param {string} token - Token for password generation
   * @param {string} stripeCustomerId - Stripe customer ID
   * @returns {Promise<Contact>} The created contact
   */
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

  /**
   * Updates an existing contact's information
   * @param {number} id - ID of the contact to update
   * @param {Partial<Contact>} contact - Updated contact information
   * @returns {Promise<Contact>} The updated contact
   */
  public async update(id: number, contact: Partial<Contact>) {
    return this.repository.update(id, contact);
  }

  /**
   * Registers a new user contact
   * @param {Object} data - Registration data
   * @param {string} data.name - User's name
   * @param {string} data.email - User's email
   * @param {string} data.password - User's password
   * @param {string} data.phone - User's phone number
   * @returns {Promise<Contact>} The registered contact
   * @throws {Error} When email is already registered or contact creation fails
   */
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
      buttonText: 'Ok, got it',
      buttonLink: `${env.FRONTEND_URL}`,
    });

    return createdContact;
  }

  /**
   * Sends a verification token to the user's email
   * @param {string} email - Email address to send token to
   * @returns {Promise<{message: string}>} Success message
   * @throws {Error} When email is not found
   */
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
      buttonText: 'Ok, got it',
      buttonLink: `${env.FRONTEND_URL}`,
    });

    return { message: 'Verification email sent' };
  }

  /**
   * Verifies a registration token for a contact
   * @param {number} id - ID of the contact
   * @param {string} token - Verification token
   * @returns {Promise<{message: string}>} Success message
   * @throws {Error} When contact is not found or token is invalid
   */
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

  /**
   * Initiates a password reset request
   * @param {string} email - Email address for password reset
   * @returns {Promise<{message: string}>} Success message
   * @throws {Error} When email is not found
   */
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
      buttonText: 'Reset password',
      buttonLink: `${env.FRONTEND_URL}/onboarding/reset?token=${resetToken}&email=${contact.email}`,
    });

    return { message: 'Reset password link sent successfully' };
  }

  /**
   * Resets a contact's password using a reset token
   * @param {string} email - Contact's email
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<{message: string}>} Success message
   * @throws {Error} When email is not found or token is invalid
   */
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

  /**
   * Resets a contact's password within the application (when already logged in)
   * @param {number} contactId - ID of the contact
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<{message: string}>} Success message
   * @throws {Error} When contact is not found or current password is invalid
   */
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

  /**
   * Retrieves a contact by their ID
   * @param {number} id - ID of the contact
   * @returns {Promise<Contact>} The contact
   * @throws {Error} When contact is not found
   */
  public async getContactById(id: number) {
    const contact = await this.findById(id);
    if (!contact) {
      throw new Error('Contact not found');
    }
    return contact;
  }

  /**
   * Updates contact details
   * @param {number} id - ID of the contact
   * @param {Partial<Contact>} data - Updated contact data
   * @returns {Promise<Contact>} The updated contact
   * @throws {Error} When contact is not found
   */
  public async updateContactDetails(id: number, data: Partial<Contact>) {
    const contact = await this.findById(id);
    if (!contact) {
      throw new Error('Contact not found');
    }

    const updatedContact = await this.repository.update(id, data);
    return updatedContact;
  }
}
