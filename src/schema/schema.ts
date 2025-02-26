import {
  boolean,
  mysqlEnum,
  mysqlTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const userSchema = mysqlTable("user", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 65 }).notNull(),
  reset_token: varchar("reset_token", { length: 100 }),
  email_token: varchar("email_token", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  role: mysqlEnum("role", ["admin", "user", "moderator", "host"]).default(
    "user"
  ),
  profile_picture: varchar("profile_picture", { length: 255 }),
  bio: varchar("bio", { length: 255 }),
  custom_id: varchar("custom_id", { length: 255 }),
  is_verified: boolean("is_verified").default(false),
  is_banned: boolean("is_banned").default(false),
  is_deleted: boolean("is_deleted").default(false),
});
