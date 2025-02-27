import { User } from "../lib/database.ts";
import { logger } from "../lib/logger.js";
import type { UserService } from "../service/user.js";

type TransactionalEmail = {
  subject: string;
  message: string;
};

const sendWelcomeEmail = async (data: any, userService: UserService) => {
  const user = await userService.find(data.userId);
  logger.info(`Welcome email sent to ${user?.email}`);
};

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const sendTransactionalEmail = async (
  user: User,
  templateId: number,
  params: Record<string, string>
) => {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key":
          "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",
      },
      body: JSON.stringify({
        templateId: templateId,
        to: [
          {
            email: user.email,
            name: user.name,
          },
        ],
        params: params,
      }),
    });

    if (!response.ok) {
      const error = await response.json();

      logger.info(
        `Mailer error to ${user.email} using template ${templateId}:`,
        error
      );
      throw new Error(`Email API error: ${error.message}`);
    }

    const result = await response.json();
    logger.info(`Email sent to ${user.email} using template ${templateId}`);
    return result;
  } catch (error) {
    logger.error(`Failed to send email to ${user.email}:`, error);
    throw error;
  }
};

export { sendTransactionalEmail, sendWelcomeEmail };
