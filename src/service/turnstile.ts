import env from "../lib/env.js";
import { logger } from "../lib/logger.js";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes": string[];
  challenge_ts?: string;
  hostname?: string;
}

export class TurnstileService {
  private readonly VERIFY_URL =
    "https://challenges.cloudflare.com/turnstile/v0/siteverify";

  public async verify(token: string, ip?: string): Promise<boolean> {
    try {
      const formData = new FormData();
      formData.append("secret", env.TURNSTILE_SECRET_KEY);
      formData.append("response", token);
      if (ip) {
        formData.append("remoteip", ip);
      }

      const result = await fetch(this.VERIFY_URL, {
        method: "POST",
        body: formData,
      });

      const outcome = (await result.json()) as TurnstileVerifyResponse;

      if (!outcome.success) {
        logger.warn("Turnstile verification failed:", outcome["error-codes"]);
      }

      return outcome.success;
    } catch (error) {
      logger.error("Error verifying Turnstile token:", error);
      return false;
    }
  }
}
