import type { Context } from "hono";
import { encode } from "../../lib/jwt.js";
import { logger } from "../../lib/logger.js";
import type { GoogleService } from "../../service/google.js";
import type { BusinessService } from "../../service/business.js";
import { ERRORS, serveBadRequest, serveNotFound } from "./resp/error.ts";
import { serializeUser } from "./serializer/user.js";

export class GoogleController {
  private googleService: GoogleService;
  private businessService: BusinessService;

  constructor(googleService: GoogleService, businessService: BusinessService) {
    this.googleService = googleService;
    this.businessService = businessService;
  }

  public initiateAuth = async (c: Context) => {
    try {
      const authUrl = await this.googleService.getAuthUrl();
      return c.json({
        success: true,
        authUrl,
      });
    } catch (error) {
      logger.error("Failed to initiate Google auth:", error);
      return serveBadRequest(c, ERRORS.AUTH_FAILED);
    }
  };

  public handleCallback = async (c: Context) => {
    try {
      const code = c.req.query("code");

      if (!code) {
        return serveBadRequest(c, ERRORS.NO_AUTHORIZATION_CODE);
      }

      const user = await this.googleService.handleCallback(code);

      if (!user) {
        return serveNotFound(c, ERRORS.GOOGLE_AUTH_USER_NOT_FOUND);
      }

      // Generate JWT using the same encode function as auth controller
      const token = await encode(user.id, user.email);
      const serializedUser = await serializeUser(user, this.businessService);

      // Return JSON response like other auth endpoints
      return c.json({
        success: true,
        token,
        user: serializedUser,
      });
    } catch (error) {
      logger.error("Google callback failed:", error);
      return serveBadRequest(c, ERRORS.AUTH_FAILED);
    }
  };
}
