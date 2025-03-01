import {
  boolean,
  mysqlEnum,
  mysqlTable,
  serial,
  timestamp,
  varchar,
  int,
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
  role: mysqlEnum("role", ["master", "owner", "host", "user"]).default("user"),
  profile_picture: varchar("profile_picture", { length: 255 }),
  bio: varchar("bio", { length: 255 }),
  custom_id: varchar("custom_id", { length: 255 }),
  is_verified: boolean("is_verified").default(false),
  is_banned: boolean("is_banned").default(false),
  is_deleted: boolean("is_deleted").default(false),
});

export const leadSchema = mysqlTable("leads", {
  id: serial("id").primaryKey(),
  membershipLevel: varchar("membership_level", { length: 50 }),
  membershipActive: boolean("membership_active").default(false),
  formIdentifier: varchar("form_identifier", { length: 100 }),
  hostId: int("host_id").references(() => userSchema.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  status_identifier: mysqlEnum("status_identifier", [
    "Free Event",
    "Event Interested",
    "Membership- Silver",
    "Membership- Gold",
    "Membership- Platinum",
  ]).default("Free Event"),
  userId: int("user_id").references(() => userSchema.id),
});

export type Lead = typeof leadSchema.$inferSelect;
export type NewLead = typeof leadSchema.$inferInsert;
