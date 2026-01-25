import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  decimal,
  date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  emailConfirmed: boolean('email_confirmed').default(false).notNull(),
  userType: text('user_type').notNull(), // 'client' or 'provider'
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  organizationName: text('organization_name'),
  county: text('county').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Service Providers table
export const serviceProviders = pgTable('service_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gender: text('gender').notNull(), // 'Male' or 'Female'
  dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),
  identityNumber: text('identity_number').notNull(), // encrypted
  providerCode: text('provider_code').notNull().unique(),
  photoUrl: text('photo_url').notNull(),
  commuteDistance: integer('commute_distance').notNull(), // in km, max 100
  phoneNumber: text('phone_number').notNull(),
  subscriptionStatus: text('subscription_status').notNull().default('expired'), // 'active' or 'expired'
  subscriptionExpiresAt: timestamp('subscription_expires_at'),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Provider Services table
export const providerServices = pgTable('provider_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  serviceCategory: text('service_category').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Provider Training table
export const providerTraining = pgTable('provider_training', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  trainingName: text('training_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Gigs table
export const gigs = pgTable('gigs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  serviceDate: timestamp('service_date').notNull(),
  serviceTime: text('service_time').notNull(),
  address: text('address').notNull(), // max 30 chars
  description: text('description').notNull(), // max 160 chars
  durationDays: integer('duration_days').notNull(),
  durationHours: integer('duration_hours').notNull(),
  preferredGender: text('preferred_gender'), // 'Male', 'Female', or null
  paymentOffer: integer('payment_offer').notNull(), // in KES
  status: text('status').notNull().default('open'), // 'open', 'accepted', 'completed', 'cancelled'
  acceptedProviderId: uuid('accepted_provider_id').references(() => serviceProviders.id, { onDelete: 'set null' }),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Reviews table
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  gigId: uuid('gig_id').notNull().references(() => gigs.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reviewText: text('review_text').notNull(), // max 80 chars
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Counties table (reference data)
export const counties = pgTable('counties', {
  id: integer('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  provider: one(serviceProviders, {
    fields: [users.id],
    references: [serviceProviders.userId],
  }),
  gigsAsClient: many(gigs),
  reviewsAsClient: many(reviews),
}));

export const serviceProvidersRelations = relations(serviceProviders, ({ one, many }) => ({
  user: one(users, {
    fields: [serviceProviders.userId],
    references: [users.id],
  }),
  services: many(providerServices),
  training: many(providerTraining),
  gigsAccepted: many(gigs),
  reviews: many(reviews),
}));

export const providerServicesRelations = relations(providerServices, ({ one }) => ({
  provider: one(serviceProviders, {
    fields: [providerServices.providerId],
    references: [serviceProviders.id],
  }),
}));

export const providerTrainingRelations = relations(providerTraining, ({ one }) => ({
  provider: one(serviceProviders, {
    fields: [providerTraining.providerId],
    references: [serviceProviders.id],
  }),
}));

export const gigsRelations = relations(gigs, ({ one, many }) => ({
  client: one(users, {
    fields: [gigs.clientId],
    references: [users.id],
  }),
  acceptedProvider: one(serviceProviders, {
    fields: [gigs.acceptedProviderId],
    references: [serviceProviders.id],
  }),
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  gig: one(gigs, {
    fields: [reviews.gigId],
    references: [gigs.id],
  }),
  provider: one(serviceProviders, {
    fields: [reviews.providerId],
    references: [serviceProviders.id],
  }),
  client: one(users, {
    fields: [reviews.clientId],
    references: [users.id],
  }),
}));
