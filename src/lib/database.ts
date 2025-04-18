import type { Logger as drizzleLogger } from 'drizzle-orm/logger';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import * as schema from '../schema/schema.js';
import env from './env.js';
import { logger } from './logger.js';

const DB_ERRORS = {
  DUPLICATE_KEY: 'ER_DUP_ENTRY',
};

export interface DatabaseError {
  type: string;
  message: string;
  stack?: string;
  code: string;
  errno: number;
  sql: string;
  sqlState: string;
  sqlMessage: string;
}

class DBLogger implements drizzleLogger {
  logQuery(query: string, params: unknown[]): void {
    logger.debug({ query, params });
  }
}

/*const connection = await mysql.createConnection({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});
*/

const connection = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});

const db = drizzle(connection, {
  schema: schema,
  mode: 'default',
  logger: new DBLogger(),
});
export { connection, db, DB_ERRORS };
