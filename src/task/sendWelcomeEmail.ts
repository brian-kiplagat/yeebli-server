import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const sendTransactionalEmail = async (
  email: string,
  name: string,
  templateId: number,
  params: Record<string, string>,
) => {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        templateId: templateId,
        to: [
          {
            email: email,
            name: name,
          },
        ],
        params: params,
      }),
    });

    if (!response.ok) {
      const error = await response.json();

      logger.info(`Mailer error to ${email} using template ${templateId}:`, error);
      throw new Error(`Email API error: ${error.message}`);
    }

    const result = await response.json();
    logger.info(`Email sent to ${email} using template ${templateId}`);
    return result;
  } catch (error) {
    logger.error(`Failed to send email to ${email}:`, error);
    throw error;
  }
};

export { sendTransactionalEmail };
