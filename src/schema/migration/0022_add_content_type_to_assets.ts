import { sql } from 'drizzle-orm';
import { mysqlTable, varchar } from 'drizzle-orm/mysql-core';

export const addContentTypeToAssets = mysqlTable('assets', {
  content_type: varchar('content_type', { length: 100 }),
});

export async function up(db: any) {
  await db.schema.alterTable('assets').addColumn('content_type', 'varchar(100)');
}

export async function down(db: any) {
  await db.schema.alterTable('assets').dropColumn('content_type');
}
