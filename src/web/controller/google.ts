import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import { encode } from "../../lib/jwt.js";
import type { GoogleService } from "../../service/google.js";
import { serializeUser } from "./serializer/user.js";
import { ERRORS, serveBadRequest } from "./resp/error.ts";

export class GoogleController {
  private googleService: GoogleService;

  constructor(googleService: GoogleService) {
    this.googleService = googleService;
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
        return c.json({ error: "User not found" }, 404);
      }

      // Generate JWT using the same encode function as auth controller
      const token = await encode(user.id, user.email);
      const serializedUser = serializeUser(user);

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
