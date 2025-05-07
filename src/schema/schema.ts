import { relations } from 'drizzle-orm';
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
} from 'drizzle-orm/mysql-core';

export const teamSchema = mysqlTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const teamMemberSchema = mysqlTable('team_members', {
  id: serial('id').primaryKey(),
  team_id: int('team_id').notNull(),
  user_id: int('user_id').notNull(),
  role: mysqlEnum('role', ['host', 'member']).default('member'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const userSchema = mysqlTable('user', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  phone: varchar('phone', { length: 100 }).notNull().default(''),
  password: varchar('password', { length: 255 }).notNull(),
  reset_token: varchar('reset_token', { length: 255 }),
  email_token: varchar('email_token', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  role: mysqlEnum('role', ['master', 'owner', 'host']).default('host'),
  profile_picture: text('profile_picture'),
  bio: varchar('bio', { length: 255 }),
  custom_id: varchar('custom_id', { length: 255 }),
  is_verified: boolean('is_verified').default(false),
  is_banned: boolean('is_banned').default(false),
  is_deleted: boolean('is_deleted').default(false),
  stripe_account_id: varchar('stripe_account_id', { length: 255 }),
  stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),
  stripe_account_status: mysqlEnum('stripe_account_status', [
    'pending',
    'active',
    'rejected',
    'restricted',
  ]).default('pending'),
  subscription_id: varchar('subscription_id', { length: 255 }),
  subscription_status: mysqlEnum('subscription_status', [
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'paused',
    'unpaid',
  ]),
  trial_ends_at: timestamp('trial_ends_at'),
  stripe_oauth_state: varchar('stripe_oauth_state', { length: 255 }),
  google_id: varchar('google_id', { length: 255 }),
  google_access_token: varchar('google_access_token', { length: 255 }),
  auth_provider: mysqlEnum('auth_provider', ['local', 'google']).default('local'),
  stripe_product_id: varchar('stripe_product_id', { length: 255 }),
  stripe_price_id: varchar('stripe_price_id', { length: 255 }),
});

export const contactSchema = mysqlTable('contacts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  phone: varchar('phone', { length: 100 }).notNull().default(''),
  password: varchar('password', { length: 255 }).notNull(),
  reset_token: varchar('reset_token', { length: 255 }),
  email_token: varchar('email_token', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  role: mysqlEnum('role', ['lead', 'user']).default('lead'),
  profile_picture: text('profile_picture'),
  bio: varchar('bio', { length: 255 }),
  custom_id: varchar('custom_id', { length: 255 }),
  is_verified: boolean('is_verified').default(false),
  stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),
  subscription_id: varchar('subscription_id', { length: 255 }),
  subscription_status: mysqlEnum('subscription_status', [
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'paused',
    'unpaid',
  ]),
  google_id: varchar('google_id', { length: 255 }),
  google_access_token: varchar('google_access_token', { length: 255 }),
  auth_provider: mysqlEnum('auth_provider', ['local', 'google']).default('local'),
});

export const businessSchema = mysqlTable('businesses', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  address: varchar('address', { length: 255 }),
  phone: varchar('phone', { length: 255 }),
  email: varchar('email', { length: 255 }),
  description: text('description'),
  logo_asset_id: int('logo_asset_id').references(() => assetsSchema.id),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
  created_at: timestamp('created_at').defaultNow(),
});

export const membershipSchema = mysqlTable('memberships', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const leadSchema = mysqlTable('leads', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 100 }),
  phone: varchar('phone', { length: 100 }),
  event_id: int('event_id').references(() => eventSchema.id),
  registered_date: varchar('registered_date', { length: 100 }),
  membership_active: boolean('membership_active').default(false),
  form_identifier: varchar('form_identifier', { length: 100 }),
  host_id: int('host_id')
    .references(() => userSchema.id)
    .notNull(),
  token: varchar('token', { length: 255 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
  status_identifier: mysqlEnum('status_identifier', [
    'Manual',
    'Form',
    'Interested',
    'Member',
    'Inactive Member',
  ]).default('Manual'),
  lead_status: int('lead_status')
    .references(() => membershipSchema.id)
    .notNull()
    .default(1),
  dates: json('dates').$type<number[]>(),
  source_url: text('source_url'),
  membership_level: int('membership_level')
    .references(() => membershipSchema.id)
    .default(1),
  userId: int('user_id').references(() => userSchema.id),
});

export const eventSchema = mysqlTable('events', {
  id: serial('id').primaryKey(),
  event_name: varchar('event_name', { length: 255 }).notNull(),
  event_description: text('event_description'),
  event_type: mysqlEnum('event_type', ['live_venue', 'prerecorded', 'live_video_call']).default(
    'prerecorded',
  ),
  asset_id: int('asset_id').references(() => assetsSchema.id),
  created_at: timestamp('created_at').defaultNow(),
  status: mysqlEnum('status', ['active', 'suspended', 'cancelled']).default('active'),
  live_video_url: text('live_video_url'),
  success_url: text('success_url'),
  instructions: text('instructions'),
  landing_page_url: text('landing_page_url'),
  live_venue_address: text('live_venue_address'),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
  host_id: int('host_id')
    .references(() => userSchema.id)
    .notNull(),
});

export const membershipDates = mysqlTable('membership_dates', {
  id: serial('id').primaryKey(),
  membership_id: int('membership_id')
    .references(() => membershipSchema.id)
    .notNull(),
  date: varchar('date', { length: 50 }).notNull(), // Format: MM/DD/YYYY
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
});

export const bookings = mysqlTable('bookings', {
  id: serial('id').primaryKey(),
  event_id: int('event_id')
    .references(() => eventSchema.id)
    .notNull(),

  lead_id: int('lead_id')
    .references(() => leadSchema.id)
    .notNull(),
  host_id: int('host_id')
    .references(() => userSchema.id)
    .notNull(),
  passcode: varchar('passcode', { length: 255 }),
  dates: json('dates').$type<number[]>(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const memberships = mysqlTable('memberships', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: int('price').notNull(),
  payment_type: mysqlEnum('payment_type', ['one_off', 'recurring']).default('one_off'),
  price_point: mysqlEnum('price_point', ['standalone', 'course', 'podcast']).default('standalone'),
  billing: mysqlEnum('billing', ['per-day', 'package']).default('per-day'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
});

export const assetsSchema = mysqlTable('assets', {
  id: serial('id').primaryKey(),
  asset_name: varchar('asset_name', { length: 255 }).notNull(),
  asset_type: mysqlEnum('asset_type', [
    'image',
    'video',
    'audio',
    'document',
    'profile_picture',
  ]).default('image'),
  content_type: varchar('content_type', { length: 100 }),
  asset_url: text('asset_url'),
  asset_size: int('asset_size'),
  duration: int('duration'),
  hls_url: text('hls_url'),
  processing_status: mysqlEnum('processing_status', [
    'pending',
    'processing',
    'completed',
    'failed',
  ]).default('pending'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
});

export const subscriptionSchema = mysqlTable('subscription', {
  id: serial('id').primaryKey(),
  created_at: timestamp('created_at').defaultNow(),
  user_id: int('user_id').notNull(),
  object: text('object').notNull(),
  amount_subtotal: int('amount_subtotal').notNull(),
  amount_total: int('amount_total').notNull(),
  session_id: text('session_id').notNull(),
  cancel_url: text('cancel_url').notNull(),
  success_url: text('success_url').notNull(),
  created: int('created').notNull(),
  currency: text('currency').notNull(),
  mode: text('mode').notNull(),
  payment_status: text('payment_status').notNull(),
  status: text('status').notNull(),
  subscription_id: text('subscription_id'),
});

export const teamInvitationSchema = mysqlTable('team_invitations', {
  id: serial('id').primaryKey(),
  team_id: int('team_id')
    .references(() => teamSchema.id)
    .notNull(),
  inviter_id: int('inviter_id')
    .references(() => userSchema.id)
    .notNull(),
  invitee_email: varchar('invitee_email', { length: 255 }).notNull(),
  status: mysqlEnum('status', ['pending', 'accepted', 'rejected']).default('pending'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const paymentSchema = mysqlTable('payments', {
  id: serial('id').primaryKey(),
  contact_id: int('contact_id')
    .references(() => contactSchema.id)
    .notNull(),
  lead_id: int('lead_id')
    .references(() => leadSchema.id)
    .notNull(),
  event_id: int('event_id')
    .references(() => eventSchema.id)
    .notNull(),
  membership_id: int('membership_id')
    .references(() => memberships.id)
    .notNull(),
  stripe_customer_id: varchar('stripe_customer_id', { length: 255 }).notNull(),
  checkout_session_id: varchar('checkout_session_id', {
    length: 255,
  }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('gbp'),
  status: mysqlEnum('status', [
    'pending',
    'processing',
    'succeeded',
    'failed',
    'canceled',
    'refunded',
  ]).default('pending'),
  payment_type: mysqlEnum('payment_type', ['one_off', 'subscription']).notNull(),
  metadata: json('metadata'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const callbackSchema = mysqlTable('callbacks', {
  id: serial('id').primaryKey(),
  lead_id: int('lead_id')
    .references(() => leadSchema.id)
    .notNull(),
  event_id: int('event_id')
    .references(() => eventSchema.id)
    .notNull(),
  host_id: int('host_id')
    .references(() => userSchema.id)
    .notNull(),
  callback_type: mysqlEnum('callback_type', ['instant', 'scheduled']).notNull(),
  scheduled_time: timestamp('scheduled_time'),
  status: mysqlEnum('status', ['called', 'uncalled']).default('uncalled'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const podcastSchema = mysqlTable('podcasts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  cover_image_asset_id: int('cover_image_asset_id')
    .references(() => assetsSchema.id)
    .notNull(),
  podcast_type: mysqlEnum('podcast_type', ['prerecorded', 'link']).default('prerecorded'),
  episode_type: mysqlEnum('episode_type', ['single', 'multiple']).default('multiple'),
  host_id: int('host_id')
    .references(() => userSchema.id)
    .notNull(),
  status: mysqlEnum('status', ['draft', 'published', 'archived']).default('draft'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
  link_url: text('link_url'),
  landing_page_url: text('landing_page_url'),
});

export const podcastEpisodeSchema = mysqlTable('podcast_episodes', {
  id: serial('id').primaryKey(),
  podcast_id: int('podcast_id')
    .references(() => podcastSchema.id)
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  audio_asset_id: int('audio_asset_id').references(() => assetsSchema.id),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
  host_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
});

export const tagsSchema = mysqlTable('tags', {
  id: serial('id').primaryKey(),
  lead_id: int('lead_id')
    .references(() => leadSchema.id)
    .notNull(),
  host_id: int('host_id')
    .references(() => userSchema.id)
    .notNull(),
  tag: varchar('tag', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const eventMembershipSchema = mysqlTable('event_memberships', {
  id: serial('id').primaryKey(),
  event_id: int('event_id')
    .references(() => eventSchema.id)
    .notNull(),
  membership_id: int('membership_id')
    .references(() => membershipSchema.id)
    .notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const podcastMembershipSchema = mysqlTable('podcast_memberships', {
  id: serial('id').primaryKey(),
  podcast_id: int('podcast_id')
    .references(() => podcastSchema.id)
    .notNull(),
  membership_id: int('membership_id')
    .references(() => membershipSchema.id)
    .notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export type Lead = typeof leadSchema.$inferSelect & {
  event?: Event | null;
  membership?: Membership | null;
};

export type Tag = typeof tagsSchema.$inferSelect;
export type NewTag = typeof tagsSchema.$inferInsert;

export type Membership = typeof memberships.$inferSelect & {
  dates?: (typeof membershipDates.$inferSelect)[];
};
export type NewMembership = typeof memberships.$inferInsert;
export type MembershipDate = typeof membershipDates.$inferSelect;
export type NewMembershipDate = typeof membershipDates.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type NewLead = typeof leadSchema.$inferInsert;
export type Event = typeof eventSchema.$inferSelect & {
  memberships?: (typeof eventMembershipSchema.$inferSelect & {
    membership: Membership;
  })[];
};
export type NewEvent = typeof eventSchema.$inferInsert;
export type Asset = typeof assetsSchema.$inferSelect;
export type NewAsset = typeof assetsSchema.$inferInsert;
export type Contact = typeof contactSchema.$inferSelect;
export type NewContact = typeof contactSchema.$inferInsert;
export type Payment = typeof paymentSchema.$inferSelect;
export type NewPayment = typeof paymentSchema.$inferInsert;
export type User = typeof userSchema.$inferSelect & {
  business?: typeof businessSchema.$inferSelect | null;
};
export type TeamMember = typeof teamMemberSchema.$inferSelect;
export type NewTeamMember = typeof teamMemberSchema.$inferInsert;

export type NewUser = typeof userSchema.$inferInsert;
export type NewBusiness = typeof businessSchema.$inferInsert;
export type Callback = typeof callbackSchema.$inferSelect;
export type NewCallback = typeof callbackSchema.$inferInsert;
export type Podcast = typeof podcastSchema.$inferSelect & {
  cover?: Asset | null;
  host?: {
    id: number;
    name: string;
    email: string;
  } | null;
  episodes?: PodcastEpisode[];
};
export type NewPodcast = typeof podcastSchema.$inferInsert;
export type PodcastEpisode = typeof podcastEpisodeSchema.$inferSelect & {
  audio?: Asset | null;
};
export type NewPodcastEpisode = typeof podcastEpisodeSchema.$inferInsert;
export type PodcastMembership = typeof podcastMembershipSchema.$inferSelect;
export type NewPodcastMembership = typeof podcastMembershipSchema.$inferInsert;
// Define relations
export const userRelations = relations(userSchema, ({ one }) => ({
  business: one(businessSchema, {
    fields: [userSchema.id],
    references: [businessSchema.user_id],
  }),
}));

export const tagRelations = relations(tagsSchema, ({ one }) => ({
  lead: one(leadSchema, {
    fields: [tagsSchema.lead_id],
    references: [leadSchema.id],
  }),
  host: one(userSchema, {
    fields: [tagsSchema.host_id],
    references: [userSchema.id],
  }),
}));

export const businessRelations = relations(businessSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [businessSchema.user_id],
    references: [userSchema.id],
  }),
}));

// Define the relations
export const leadRelations = relations(leadSchema, ({ one }) => ({
  event: one(eventSchema, {
    fields: [leadSchema.event_id],
    references: [eventSchema.id],
  }),
  membership: one(membershipSchema, {
    fields: [leadSchema.membership_level],
    references: [membershipSchema.id],
  }),
}));

export const paymentRelations = relations(paymentSchema, ({ one }) => ({
  contact: one(contactSchema, {
    fields: [paymentSchema.contact_id],
    references: [contactSchema.id],
  }),
  lead: one(leadSchema, {
    fields: [paymentSchema.lead_id],
    references: [leadSchema.id],
  }),
  event: one(eventSchema, {
    fields: [paymentSchema.event_id],
    references: [eventSchema.id],
  }),
  membership: one(memberships, {
    fields: [paymentSchema.membership_id],
    references: [memberships.id],
  }),
}));

// Define relations
export const teamRelations = relations(teamSchema, ({ many }) => ({
  members: many(teamMemberSchema),
  invitations: many(teamInvitationSchema),
}));

export const teamMemberRelations = relations(teamMemberSchema, ({ one }) => ({
  team: one(teamSchema, {
    fields: [teamMemberSchema.team_id],
    references: [teamSchema.id],
  }),
  user: one(userSchema, {
    fields: [teamMemberSchema.user_id],
    references: [userSchema.id],
  }),
}));

export const teamInvitationRelations = relations(teamInvitationSchema, ({ one }) => ({
  team: one(teamSchema, {
    fields: [teamInvitationSchema.team_id],
    references: [teamSchema.id],
  }),
  inviter: one(userSchema, {
    fields: [teamInvitationSchema.inviter_id],
    references: [userSchema.id],
  }),
}));

export const bookingRelations = relations(bookings, ({ one }) => ({
  event: one(eventSchema, {
    fields: [bookings.event_id],
    references: [eventSchema.id],
  }),
  lead: one(leadSchema, {
    fields: [bookings.lead_id],
    references: [leadSchema.id],
  }),
}));

export const callbackRelations = relations(callbackSchema, ({ one }) => ({
  lead: one(leadSchema, {
    fields: [callbackSchema.lead_id],
    references: [leadSchema.id],
  }),
  event: one(eventSchema, {
    fields: [callbackSchema.event_id],
    references: [eventSchema.id],
  }),
  host: one(userSchema, {
    fields: [callbackSchema.host_id],
    references: [userSchema.id],
  }),
}));

export const eventRelations = relations(eventSchema, ({ many }) => ({
  memberships: many(eventMembershipSchema),
}));

export const membershipRelations = relations(membershipSchema, ({ many }) => ({
  events: many(eventMembershipSchema),
}));

export const eventMembershipRelations = relations(eventMembershipSchema, ({ one }) => ({
  event: one(eventSchema, {
    fields: [eventMembershipSchema.event_id],
    references: [eventSchema.id],
  }),
  membership: one(membershipSchema, {
    fields: [eventMembershipSchema.membership_id],
    references: [membershipSchema.id],
  }),
}));

export const podcastMembershipRelations = relations(podcastMembershipSchema, ({ one }) => ({
  podcast: one(podcastSchema, {
    fields: [podcastMembershipSchema.podcast_id],
    references: [podcastSchema.id],
  }),
  membership: one(membershipSchema, {
    fields: [podcastMembershipSchema.membership_id],
    references: [membershipSchema.id],
  }),
}));

export const podcastRelations = relations(podcastSchema, ({ one, many }) => ({
  cover: one(assetsSchema, {
    fields: [podcastSchema.cover_image_asset_id],
    references: [assetsSchema.id],
  }),
  host: one(userSchema, {
    fields: [podcastSchema.host_id],
    references: [userSchema.id],
  }),
  episodes: many(podcastEpisodeSchema),
}));

export const podcastEpisodeRelations = relations(podcastEpisodeSchema, ({ one }) => ({
  podcast: one(podcastSchema, {
    fields: [podcastEpisodeSchema.podcast_id],
    references: [podcastSchema.id],
  }),
  audio: one(assetsSchema, {
    fields: [podcastEpisodeSchema.audio_asset_id],
    references: [assetsSchema.id],
  }),
  host: one(userSchema, {
    fields: [podcastEpisodeSchema.host_id],
    references: [userSchema.id],
  }),
}));
