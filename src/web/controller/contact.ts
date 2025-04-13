import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { ContactService } from "../../service/contact.js";
import type {
  EmailVerificationBody,
  InAppResetPasswordBody,
  LoginBody,
  RegisterTokenBody,
  RequestResetPasswordBody,
  ResetPasswordBody,
  UpdateContactDetailsBody,
} from "../validator/contact.ts";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveUnauthorized,
} from "./resp/error.js";
import { serveData } from "./resp/resp.js";
import { serializeContact } from "./serializer/contact.js";
import { verify } from "../../lib/encryption.ts";
import { type JWTPayload, encode } from "../../lib/jwt.js";

export class ContactController {
  constructor(private contactService: ContactService) {}

  private getContact = async (c: Context) => {
    const email = c.get("jwtPayload").email;
    const contact = await this.contactService.findByEmail(email);
    return contact;
  };

  public login = async (c: Context) => {
    try {
      const body: LoginBody = await c.req.json();
      const user = await this.contactService.findByEmail(body.email);
      if (!user) {
        return c.json(
          {
            success: false,
            message: "Invalid email, please try again",
            code: "AUTH_INVALID_CREDENTIALS",
          },
          401
        );
      }
      const isVerified = verify(body.password, user.password);
      if (!isVerified) {
        return c.json(
          {
            success: false,
            message: "Invalid password, please try again",
            code: "AUTH_INVALID_CREDENTIALS",
          },
          401
        );
      }

      const token = await encode(user.id, user.email);
      const serializedContact = await serializeContact(user);
      return serveData(c, { token, contact: serializedContact });
    } catch (error: any) {
      logger.error(error);
      if (
        error.message === "Invalid credentials" ||
        error.message === "Email not verified"
      ) {
        return serveUnauthorized(c);
      }
      return serveInternalServerError(c, error);
    }
  };

  public sendToken = async (c: Context) => {
    try {
      const body: EmailVerificationBody = await c.req.json();
      const result = await this.contactService.sendToken(body.email);
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === "Email not found") {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      return serveInternalServerError(c, error);
    }
  };

  public verifyRegistrationToken = async (c: Context) => {
    try {
      const body: RegisterTokenBody = await c.req.json();
      const result = await this.contactService.verifyRegistrationToken(
        body.id,
        body.token
      );
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === "Contact not found") {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (error.message === "Invalid token") {
        return serveBadRequest(c, ERRORS.INVALID_TOKEN);
      }
      return serveInternalServerError(c, error);
    }
  };

  public requestResetPassword = async (c: Context) => {
    try {
      const body: RequestResetPasswordBody = await c.req.json();
      const result = await this.contactService.requestResetPassword(body.email);
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === "Email not found") {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      return serveInternalServerError(c, error);
    }
  };

  public resetPassword = async (c: Context) => {
    try {
      const body: ResetPasswordBody = await c.req.json();
      const result = await this.contactService.resetPassword(
        body.email,
        body.token,
        body.password
      );
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === "Email not found") {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (error.message === "Invalid token") {
        return serveBadRequest(c, ERRORS.INVALID_TOKEN);
      }
      return serveInternalServerError(c, error);
    }
  };

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
        body.newPassword
      );
      return serveData(c, result);
    } catch (error: any) {
      logger.error(error);
      if (error.message === "Invalid current password") {
        return serveBadRequest(c, ERRORS.AUTH_INVALID_PASSWORD);
      }
      return serveInternalServerError(c, error);
    }
  };

  public me = async (c: Context) => {
    try {
      const contact = await this.getContact(c);
      if (!contact) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const serializedContact = await serializeContact(contact);
      return serveData(c, { contact: serializedContact });
    } catch (error: any) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public updateContactDetails = async (c: Context) => {
    try {
      const contact = await this.getContact(c);
      if (!contact) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: UpdateContactDetailsBody = await c.req.json();
      const updatedContact = await this.contactService.updateContactDetails(
        contact.id,
        body
      );

      return serveData(c, "Contact details updated successfully");
    } catch (error: any) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
