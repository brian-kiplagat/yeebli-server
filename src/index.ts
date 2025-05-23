import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { showRoutes } from 'hono/dev';
import { logger as httpLogger } from 'hono/logger';
import { trimTrailingSlash } from 'hono/trailing-slash';

import { NODE_ENVIRONMENTS } from './lib/constants.js';
import { connection } from './lib/database.js';
import env from './lib/env.js';
import { logger } from './lib/logger.js';
import { tracing } from './web/middleware/tracing.js';
import { Server } from './web/server.js';

const app = new Hono();

// Generic middlewares
app.use(cors());
app.use(tracing);
app.use(compress());
app.use(httpLogger());
app.use(trimTrailingSlash());

const poolPing = await connection.getConnection();
try {
  await poolPing.ping();
  logger.info('Database connection established');
} catch (error) {
  logger.error('Database connection failed', { error });
}

const server = new Server(app);
server.configure();

if (
  env.NODE_ENV === NODE_ENVIRONMENTS.development ||
  env.NODE_ENV === NODE_ENVIRONMENTS.production
) {
  console.log('Available routes:');
  showRoutes(app);
}

const port = Number.parseInt(env.PORT);
logger.info(`Server is running on port: ${port}, environment: ${env.NODE_ENV}`);
logger.info(`http://localhost:${port}`);
const web = serve({ fetch: app.fetch, port });

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received');

  logger.info('Closing http server');
  web.close(async () => {
    logger.info('Closing worker');
    await server.shutDownWorker();

    logger.info('Closing database connection');
    await connection.end();

    logger.info('Exiting...');
    process.exit(0);
  });
});
