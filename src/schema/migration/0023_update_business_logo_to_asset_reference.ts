import { sql } from "drizzle-orm";
import { int, mysqlTable } from "drizzle-orm/mysql-core";
import { assetsSchema } from "../schema.ts";

export const updateBusinessLogoToAssetReference = mysqlTable("businesses", {
  logo_asset_id: int("logo_asset_id").references(() => assetsSchema.id),
});

export async function up(db: any) {
  // First, add the new column
  await db.schema.alterTable("businesses").addColumn("logo_asset_id", "int");

  // Add foreign key constraint
  await db.schema
    .alterTable("businesses")
    .addForeignKey("logo_asset_id", "assets", "id");

  // Drop the old logo column
  await db.schema.alterTable("businesses").dropColumn("logo");
}

export async function down(db: any) {
  // First, add back the logo column
  await db.schema.alterTable("businesses").addColumn("logo", "varchar(255)");

  // Drop the foreign key constraint
  await db.schema.alterTable("businesses").dropForeignKey("logo_asset_id");

  // Drop the logo_asset_id column
  await db.schema.alterTable("businesses").dropColumn("logo_asset_id");
}
