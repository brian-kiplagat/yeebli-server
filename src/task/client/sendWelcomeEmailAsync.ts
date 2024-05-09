import { logger } from '../../lib/logger';
import { TASK, defaultQueue } from '../../lib/queue';

const sendWelcomeEmailAsync = async (userId: number) => {
  const job = await defaultQueue.add(TASK.SendWelcomeEmail, { userId });
  logger.info(`Job ${job.id} added to queue. Task scheduled for ${TASK.SendWelcomeEmail}, user: ${userId}`);
};

export default sendWelcomeEmailAsync;
