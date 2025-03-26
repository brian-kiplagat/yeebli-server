import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const userSchema = mysqlTable("user", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  phone: varchar("phone", { length: 100 }).notNull().default(""),
  password: varchar("password", { length: 255 }).notNull(),
  reset_token: varchar("reset_token", { length: 255 }),
  email_token: varchar("email_token", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  role: mysqlEnum("role", ["master", "owner", "host", "user"]).default("user"),
  profile_picture: varchar("profile_picture", { length: 255 }),
  bio: varchar("bio", { length: 255 }),
  custom_id: varchar("custom_id", { length: 255 }),
  is_verified: boolean("is_verified").default(false),
  is_banned: boolean("is_banned").default(false),
  is_deleted: boolean("is_deleted").default(false),
  stripe_account_id: varchar("stripe_account_id", { length: 255 }),
  stripe_customer_id: varchar("stripe_customer_id", { length: 255 }),
  stripe_account_status: mysqlEnum("stripe_account_status", [
    "pending",
    "active",
    "rejected",
    "restricted",
  ]).default("pending"),
  subscription_id: varchar("subscription_id", { length: 255 }),
  subscription_status: mysqlEnum("subscription_status", [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "paused",
    "unpaid",
  ]),
  trial_ends_at: timestamp("trial_ends_at"),
  stripe_oauth_state: varchar("stripe_oauth_state", { length: 255 }),
});

export const membershipSchema = mysqlTable("memberships", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const leadSchema = mysqlTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }),
  email: varchar("email", { length: 100 }),
  phone: varchar("phone", { length: 100 }),
  event_id: int("event_id")
    .references(() => eventSchema.id)
    .notNull(),
  registered_date: varchar("registered_date", { length: 100 }),
  membership_active: boolean("membership_active").default(false),
  form_identifier: varchar("form_identifier", { length: 100 }),
  host_id: int("host_id")
    .references(() => userSchema.id)
    .notNull(),
  token: varchar("token", { length: 255 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow(),
  status_identifier: mysqlEnum("status_identifier", [
    "Manual",
    "Form",
    "Interested",
    "Member",
    "Inactive Member",
  ]).default("Manual"),
  lead_status: int("lead_status")
    .references(() => membershipSchema.id)
    .notNull()
    .default(1),
  source_url: text("source_url"),
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
  event_description: text("event_description"),
  event_type: mysqlEnum("event_type", [
    "live_venue",
    "prerecorded",
    "live_video_call",
  ]).default("prerecorded"),
  event_date: varchar("event_date", { length: 50 }).notNull(), // Format: MM/DD/YYYY
  asset_id: int("asset_id").references(() => assetsSchema.id),
  created_at: timestamp("created_at").defaultNow(),
  status: mysqlEnum("status", ["active", "suspended", "cancelled"]).default(
    "active"
  ),
  live_video_url: text("live_video_url"),
  success_url: text("success_url"),
  instructions: text("instructions"),
  landing_page_url: text("landing_page_url"),
  live_venue_address: text("live_venue_address"),
  other_dates: json("other_dates"),
  lead_level: json("lead_level"),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow(),
  host_id: int("host_id")
    .references(() => userSchema.id)
    .notNull(),
});

export const assetsSchema = mysqlTable("assets", {
  id: serial("id").primaryKey(),
  asset_name: varchar("asset_name", { length: 255 }).notNull(),
  asset_type: mysqlEnum("asset_type", [
    "image",
    "video",
    "audio",
    "document",
  ]).default("image"),
  asset_url: text("asset_url"),
  asset_size: int("asset_size"),
  duration: int("duration"),
  hls_url: text("hls_url"),
  processing_status: mysqlEnum("processing_status", [
    "pending",
    "processing",
    "completed",
    "failed",
  ]).default("pending"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow(),
  user_id: int("user_id")
    .references(() => userSchema.id)
    .notNull(),
});

export const subscriptionSchema = mysqlTable("subscription", {
  id: serial("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  user_id: int("user_id").notNull(),
  object: text("object").notNull(),
  amount_subtotal: int("amount_subtotal").notNull(),
  amount_total: int("amount_total").notNull(),
  session_id: text("session_id").notNull(),
  cancel_url: text("cancel_url").notNull(),
  success_url: text("success_url").notNull(),
  created: int("created").notNull(),
  currency: text("currency").notNull(),
  mode: text("mode").notNull(),
  payment_status: text("payment_status").notNull(),
  status: text("status").notNull(),
  subscription_id: text("subscription_id"),
});

// Define the relations
export const leadRelations = relations(leadSchema, ({ one }) => ({
  event: one(eventSchema, {
    fields: [leadSchema.event_id],
    references: [eventSchema.id],
  }),
  membership: one(membershipSchema, {
    fields: [leadSchema.lead_status],
    references: [membershipSchema.id],
  }),
}));

export type Lead = typeof leadSchema.$inferSelect & {
  event?: Event | null;
  membership?: Membership | null;
};
export type NewLead = typeof leadSchema.$inferInsert;
export type Event = typeof eventSchema.$inferSelect;
export type NewEvent = typeof eventSchema.$inferInsert;
export type Asset = typeof assetsSchema.$inferSelect;
export type NewAsset = typeof assetsSchema.$inferInsert;
export type Membership = typeof membershipSchema.$inferSelect;
export type NewMembership = typeof membershipSchema.$inferInsert;
