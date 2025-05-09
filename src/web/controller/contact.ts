import type { Context } from 'hono';

import { verify } from '../../lib/encryption.ts';
import { encode } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import type { ContactService } from '../../service/contact.js';
import { PaymentService } from '../../service/payment.ts';
import type { StripeService } from '../../service/stripe.js';
import type {
  EmailVerificationBody,
  InAppResetPasswordBody,
  LoginBody,
  RegisterTokenBody,
  RequestResetPasswordBody,
  ResetPasswordBody,
  UpdateContactDetailsBody,
} from '../validator/contact.ts';
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveUnauthorized,
} from './resp/error.js';
import { serveData } from './resp/resp.js';
import { serializeContact } from './serializer/contact.js';

export class ContactController {
  private contactService: ContactService;
  private stripeService: StripeService;
  private paymentService: PaymentService;

  constructor(
    contactService: ContactService,
    stripeService: StripeService,
    paymentService: PaymentService,
  ) {
    this.contactService = contactService;
    this.stripeService = stripeService;
    this.paymentService = paymentService;
  }

  /**
   * Retrieves contact information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<Contact|null>} The contact object if found, null otherwise
   */
  private getContact = async (c: Context) => {
    const { email } = c.get('jwtPayload');
    const contact = await this.contactService.findByEmail(email);
    return contact;
  };

  /**
   * Authenticates a contact with email and password
   * @param {Context} c - The Hono context containing login credentials
   * @returns {Promise<Response>} Response containing JWT token and contact data
   * @throws {Error} When authentication fails
   */
  public login = async (c: Context) => {
    try {
      const body: LoginBody = await c.req.json();
      const user = await this.contactService.findByEmail(body.email);
      if (!user) {
        return c.json(
          {
            success: false,
            message: 'Invalid email, please try again',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }
      const isVerified = verify(body.password, user.password);
      if (!isVerified) {
        return c.json(
          {
            success: false,
            message: 'Invalid password, please try again',
            code: 'AUTH_INVALID_CREDENTIALS',
          },
          401,
        );
      }

      const token = await encode(user.id, user.email);
      const serializedContact = await serializeContact(user);
      return serveData(c, { token, contact: serializedContact });
    } catch (error: any) {
      logger.error(error);
      if (error.message === 'Invalid credentials' || error.message === 'Email not verified') {
        return serveUnauthorized(c);
      }
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Sends a verification token to contact's email
   * @param {Context} c - The Hono context containing email information
   * @returns {Promise<Response>} Response indicating token sending status
   * @throws {Error} When token generation or sending fails
   */
  public sendToken = async (c: Context) => {
    try {
      const body: EmailVerificationBody = await c.req.json();
      const result = await this.contactService.sendToken(body.email);
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === 'Email not found') {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Verifies the registration token sent to contact's email
   * @param {Context} c - The Hono context containing token and contact ID
   * @returns {Promise<Response>} Response indicating verification status
   * @throws {Error} When token verification fails
   */
  public verifyRegistrationToken = async (c: Context) => {
    try {
      const body: RegisterTokenBody = await c.req.json();
      const result = await this.contactService.verifyRegistrationToken(body.id, body.token);
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === 'Contact not found') {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (error.message === 'Invalid token') {
        return serveBadRequest(c, ERRORS.INVALID_TOKEN);
      }
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Initiates password reset process by sending reset token
   * @param {Context} c - The Hono context containing email information
   * @returns {Promise<Response>} Response indicating reset token status
   * @throws {Error} When reset token generation or sending fails
   */
  public requestResetPassword = async (c: Context) => {
    try {
      const body: RequestResetPasswordBody = await c.req.json();
      const result = await this.contactService.requestResetPassword(body.email);
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === 'Email not found') {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Resets contact's password using token sent via email
   * @param {Context} c - The Hono context containing new password and token
   * @returns {Promise<Response>} Response indicating password reset status
   * @throws {Error} When password reset fails
   */
  public resetPassword = async (c: Context) => {
    try {
      const body: ResetPasswordBody = await c.req.json();
      const result = await this.contactService.resetPassword(body.email, body.token, body.password);
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === 'Email not found') {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (error.message === 'Invalid token') {
        return serveBadRequest(c, ERRORS.INVALID_TOKEN);
      }
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Resets contact's password while logged in
   * @param {Context} c - The Hono context containing old and new passwords
   * @returns {Promise<Response>} Response indicating password reset status
   * @throws {Error} When password reset fails
   */
  public resetPasswordInApp = async (c: Context) => {
    try {
      const contact = await this.getContact(c);
      if (!contact) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: InAppResetPasswordBody = await c.req.json();
      const result = await this.contactService.resetPasswordInApp(
        contact.id,
        body.oldPassword,
        body.newPassword,
      );
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === 'Invalid current password') {
        return serveBadRequest(c, ERRORS.AUTH_INVALID_PASSWORD);
      }
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves current contact's profile information and payment history
   * @param {Context} c - The Hono context containing contact information
   * @returns {Promise<Response>} Response containing contact profile and payments
   * @throws {Error} When profile retrieval fails
   */
  public me = async (c: Context) => {
    try {
      const contact = await this.getContact(c);
      if (!contact) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      //get payments
      const payments = await this.paymentService.findByContactId(contact.id);
      const serializedContact = await serializeContact(contact);
      return serveData(c, { contact: serializedContact, payments });
    } catch (error: any) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves contact's saved payment methods from Stripe
   * @param {Context} c - The Hono context containing contact information
   * @returns {Promise<Response>} Response containing payment methods
   * @throws {Error} When payment methods retrieval fails
   */
  public paymentMethods = async (c: Context) => {
    try {
      const contact = await this.getContact(c);
      if (!contact) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      if (!contact.stripe_customer_id) {
        return serveBadRequest(c, ERRORS.STRIPE_CUSTOMER_ID_NOT_FOUND);
      }

      const paymentMethods = await this.stripeService.getCustomerPaymentMethods(
        contact.stripe_customer_id,
      );
      return serveData(c, paymentMethods);
    } catch (error: any) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Updates contact's profile details
   * @param {Context} c - The Hono context containing updated contact information
   * @returns {Promise<Response>} Response containing updated contact data
   * @throws {Error} When profile update fails
   */
  public updateContactDetails = async (c: Context) => {
    try {
      const contact = await this.getContact(c);
      if (!contact) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: UpdateContactDetailsBody = await c.req.json();
      const updatedContact = await this.contactService.updateContactDetails(contact.id, body);

      return serveData(c, updatedContact);
    } catch (error: any) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
