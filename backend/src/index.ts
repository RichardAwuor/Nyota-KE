import { createApplication } from "@specific-dev/framework";
import * as schema from './db/schema.js';
import { registerUserRoutes } from './routes/users.js';
import { registerUploadRoutes } from './routes/uploads.js';
import { registerGigRoutes } from './routes/gigs.js';
import { registerReviewRoutes } from './routes/reviews.js';
import { registerProviderRoutes } from './routes/providers.js';
import { registerProfileRoutes } from './routes/profile.js';

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Enable storage for file uploads
app.withStorage();

// Export App type for use in route files
export type App = typeof app;

// Register all route modules
registerUserRoutes(app, app.fastify);
registerUploadRoutes(app, app.fastify);
registerGigRoutes(app, app.fastify);
registerReviewRoutes(app, app.fastify);
registerProviderRoutes(app, app.fastify);
registerProfileRoutes(app, app.fastify);

// Seed counties data on startup
await seedCounties();

await app.run();
app.logger.info('Application running');

async function seedCounties() {
  const countiesData = [
    { id: 1, code: 'MSA', name: 'Mombasa' },
    { id: 2, code: 'KWL', name: 'Kwale' },
    { id: 3, code: 'KLF', name: 'Kilifi' },
    { id: 4, code: 'TRV', name: 'Tana River' },
    { id: 5, code: 'LMU', name: 'Lamu' },
    { id: 6, code: 'TVT', name: 'Taita/Taveta' },
    { id: 7, code: 'GRS', name: 'Garissa' },
    { id: 8, code: 'WJR', name: 'Wajir' },
    { id: 9, code: 'MDR', name: 'Mandera' },
    { id: 10, code: 'MST', name: 'Marsabit' },
    { id: 11, code: 'ISO', name: 'Isiolo' },
    { id: 12, code: 'MRU', name: 'Meru' },
    { id: 13, code: 'TKN', name: 'Tharaka-Nithi' },
    { id: 14, code: 'EMB', name: 'Embu' },
    { id: 15, code: 'KTI', name: 'Kitui' },
    { id: 16, code: 'MCK', name: 'Machakos' },
    { id: 17, code: 'MKN', name: 'Makueni' },
    { id: 18, code: 'NRA', name: 'Nyandarua' },
    { id: 19, code: 'NYR', name: 'Nyeri' },
    { id: 20, code: 'KRG', name: 'Kirinyaga' },
    { id: 21, code: 'MRA', name: 'Murang\'a' },
    { id: 22, code: 'KBU', name: 'Kiambu' },
    { id: 23, code: 'TKN', name: 'Turkana' },
    { id: 24, code: 'WPT', name: 'West Pokot' },
    { id: 25, code: 'SMR', name: 'Samburu' },
    { id: 26, code: 'TNR', name: 'Trans Nzoia' },
    { id: 27, code: 'UGU', name: 'Uasin Gishu' },
    { id: 28, code: 'ELM', name: 'Elgeyo/Marakwet' },
    { id: 29, code: 'NDI', name: 'Nandi' },
    { id: 30, code: 'BRO', name: 'Baringo' },
    { id: 31, code: 'LKP', name: 'Laikipia' },
    { id: 32, code: 'NRU', name: 'Nakuru' },
    { id: 33, code: 'NRK', name: 'Narok' },
    { id: 34, code: 'KJO', name: 'Kajiado' },
    { id: 35, code: 'KRC', name: 'Kericho' },
    { id: 36, code: 'BOM', name: 'Bomet' },
    { id: 37, code: 'KKG', name: 'Kakamega' },
    { id: 38, code: 'VHG', name: 'Vihiga' },
    { id: 39, code: 'BGA', name: 'Bungoma' },
    { id: 40, code: 'BSA', name: 'Busia' },
    { id: 41, code: 'SYA', name: 'Siaya' },
    { id: 42, code: 'KSM', name: 'Kisumu' },
    { id: 43, code: 'HBY', name: 'Homa Bay' },
    { id: 44, code: 'MGR', name: 'Migori' },
    { id: 45, code: 'KSI', name: 'Kisii' },
    { id: 46, code: 'NYM', name: 'Nyamira' },
    { id: 47, code: 'NBI', name: 'Nairobi City' },
  ];

  try {
    // Check if counties already exist
    const existing = await app.db.select().from(schema.counties).limit(1);
    if (existing.length > 0) {
      app.logger.info({}, 'Counties already seeded');
      return;
    }

    await app.db.insert(schema.counties).values(countiesData);
    app.logger.info({ count: countiesData.length }, 'Counties seeded successfully');
  } catch (error) {
    app.logger.error({ err: error }, 'Failed to seed counties');
  }
}
