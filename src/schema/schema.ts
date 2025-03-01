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
  name: varchar("name", { length: 100 }),
  email: varchar("email", { length: 100 }),
  phone: varchar("phone", { length: 100 }),
  event_url: varchar("event_url", { length: 255 }),
  event_date: timestamp("event_date"),
  start_time: timestamp("start_time"),
  membership_active: boolean("membership_active").default(false),
  form_identifier: varchar("form_identifier", { length: 100 }),
  host_id: int("host_id").references(() => userSchema.id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow(),
  status_identifier: mysqlEnum("status_identifier", [
    "Manual",
    "Form",
    "Interested",
    "Member",
    "Inactive Member",
  ]).default("Manual"),
  membership_level: mysqlEnum("membership_level", [
    "Silver",
    "Gold",
    "Platinum",
  ]).default("Silver"),
  userId: int("user_id").references(() => userSchema.id),
});

export const eventSchema = mysqlTable("events", {
  id: serial("id").primaryKey(),
  event_name: varchar("event_name", { length: 255 }).notNull(),
  event_date: varchar("event_date", { length: 10 }).notNull(), // Format: MM/DD/YYYY
  start_time: varchar("start_time", { length: 5 }).notNull(), // Format: HH:MM
  end_time: varchar("end_time", { length: 5 }).notNull(), // Format: HH:MM
  video_url: varchar("video_url", { length: 255 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow(),
  lead_id: int("lead_id").references(() => leadSchema.id).notNull(),
  host_id: int("host_id").references(() => userSchema.id).notNull(),
});

export type Lead = typeof leadSchema.$inferSelect;
export type NewLead = typeof leadSchema.$inferInsert;
export type Event = typeof eventSchema.$inferSelect;
export type NewEvent = typeof eventSchema.$inferInsert;
