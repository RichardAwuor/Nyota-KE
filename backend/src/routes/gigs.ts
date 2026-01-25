import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, ne, isNull } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function registerGigRoutes(app: App, fastify: FastifyInstance) {
  // POST /api/gigs
  fastify.post('/api/gigs', {
    schema: {
      description: 'Create a new gig',
      tags: ['gigs'],
      body: {
        type: 'object',
        required: ['clientId', 'category', 'serviceDate', 'serviceTime', 'address', 'description', 'durationDays', 'durationHours', 'paymentOffer'],
        properties: {
          clientId: { type: 'string' },
          category: { type: 'string' },
          serviceDate: { type: 'string', format: 'date-time' },
          serviceTime: { type: 'string' },
          address: { type: 'string', maxLength: 30 },
          description: { type: 'string', maxLength: 160 },
          durationDays: { type: 'integer' },
          durationHours: { type: 'integer' },
          preferredGender: { type: 'string', enum: ['Male', 'Female'] },
          paymentOffer: { type: 'integer' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
        },
      },
      response: {
        201: {
          description: 'Gig created successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
            clientId: { type: 'string' },
            category: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Body: {
        clientId: string;
        category: string;
        serviceDate: string;
        serviceTime: string;
        address: string;
        description: string;
        durationDays: number;
        durationHours: number;
        preferredGender?: 'Male' | 'Female';
        paymentOffer: number;
        latitude?: number;
        longitude?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { clientId, category, serviceDate, serviceTime, address, description, durationDays, durationHours, preferredGender, paymentOffer, latitude, longitude } = request.body;
    app.logger.info({ clientId, category, paymentOffer }, 'Creating gig');

    try {
      if (address.length > 30) {
        app.logger.warn({ clientId }, 'Address exceeds 30 characters');
        return reply.status(400).send({ error: 'Address must not exceed 30 characters' });
      }

      if (description.length > 160) {
        app.logger.warn({ clientId }, 'Description exceeds 160 characters');
        return reply.status(400).send({ error: 'Description must not exceed 160 characters' });
      }

      const [gig] = await app.db
        .insert(schema.gigs)
        .values({
          clientId,
          category,
          serviceDate: new Date(serviceDate),
          serviceTime,
          address,
          description,
          durationDays,
          durationHours,
          preferredGender,
          paymentOffer,
          latitude: latitude ? String(latitude) : null,
          longitude: longitude ? String(longitude) : null,
          status: 'open',
        })
        .returning();

      app.logger.info({ gigId: gig.id, category }, 'Gig created successfully');

      return reply.status(201).send(gig);
    } catch (error) {
      app.logger.error({ err: error, clientId }, 'Failed to create gig');
      throw error;
    }
  });

  // GET /api/gigs/client/:clientId
  fastify.get('/api/gigs/client/:clientId', {
    schema: {
      description: 'Get all gigs for a client',
      tags: ['gigs'],
      params: {
        type: 'object',
        required: ['clientId'],
        properties: {
          clientId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              clientId: { type: 'string' },
              category: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { clientId: string } }>,
    reply: FastifyReply
  ) => {
    const { clientId } = request.params;
    app.logger.info({ clientId }, 'Fetching gigs for client');

    try {
      const clientGigs = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.clientId, clientId))
        .orderBy(desc(schema.gigs.createdAt));

      app.logger.info({ clientId, count: clientGigs.length }, 'Gigs fetched successfully');

      return clientGigs;
    } catch (error) {
      app.logger.error({ err: error, clientId }, 'Failed to fetch client gigs');
      throw error;
    }
  });

  // GET /api/gigs/matches/:providerId
  fastify.get('/api/gigs/matches/:providerId', {
    schema: {
      description: 'Get matching gigs for a provider',
      tags: ['gigs'],
      params: {
        type: 'object',
        required: ['providerId'],
        properties: {
          providerId: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          maxDistance: { type: 'integer' },
          gender: { type: 'string', enum: ['Male', 'Female'] },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              clientId: { type: 'string' },
              category: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { providerId: string };
      Querystring: { category?: string; maxDistance?: string; gender?: string };
    }>,
    reply: FastifyReply
  ) => {
    const { providerId } = request.params;
    const { category, maxDistance, gender } = request.query as { category?: string; maxDistance?: string; gender?: string };
    app.logger.info({ providerId, category }, 'Fetching matching gigs for provider');

    try {
      // Check subscription status
      const provider = await app.db
        .select()
        .from(schema.serviceProviders)
        .where(eq(schema.serviceProviders.id, providerId));

      if (provider.length === 0) {
        app.logger.warn({ providerId }, 'Provider not found');
        return reply.status(404).send({ error: 'Provider not found' });
      }

      const providerData = provider[0];

      // Check if subscription is active
      if (providerData.subscriptionStatus !== 'active') {
        app.logger.warn({ providerId }, 'Provider subscription not active');
        return reply.status(403).send({ error: 'Provider subscription is not active' });
      }

      // Get provider services
      const providerServices = await app.db
        .select()
        .from(schema.providerServices)
        .where(eq(schema.providerServices.providerId, providerId));

      const serviceCategories = providerServices.map((s) => s.serviceCategory);

      // Query open gigs that match provider's services
      let matchingGigs = await app.db
        .select()
        .from(schema.gigs)
        .where(
          and(
            eq(schema.gigs.status, 'open'),
            serviceCategories.length > 0 ? undefined : eq(schema.gigs.category, category || '')
          )
        )
        .orderBy(desc(schema.gigs.createdAt));

      // Filter by service category if provider has services
      if (serviceCategories.length > 0) {
        matchingGigs = matchingGigs.filter((gig) => serviceCategories.includes(gig.category));
      }

      // Filter by category from query param
      if (category) {
        matchingGigs = matchingGigs.filter((gig) => gig.category === category);
      }

      // Filter by gender preference
      if (providerData.latitude && providerData.longitude) {
        matchingGigs = matchingGigs.filter((gig) => {
          if (gig.preferredGender && gig.preferredGender !== providerData.gender) {
            return false;
          }

          // Filter by distance if both locations are available
          if (gig.latitude && gig.longitude) {
            const gigLat = parseFloat(gig.latitude as any);
            const gigLon = parseFloat(gig.longitude as any);
            const providerLat = parseFloat(providerData.latitude as any);
            const providerLon = parseFloat(providerData.longitude as any);

            const distance = calculateDistance(providerLat, providerLon, gigLat, gigLon);

            // Check against provider's commute distance limit
            if (distance > providerData.commuteDistance) {
              return false;
            }

            // Check against query maxDistance if provided
            if (maxDistance && distance > parseInt(maxDistance)) {
              return false;
            }
          }

          return true;
        });
      }

      // Filter by preferred gender
      if (gender) {
        matchingGigs = matchingGigs.filter((gig) => !gig.preferredGender || gig.preferredGender === gender);
      }

      app.logger.info({ providerId, count: matchingGigs.length }, 'Matching gigs fetched successfully');

      return matchingGigs;
    } catch (error) {
      app.logger.error({ err: error, providerId }, 'Failed to fetch matching gigs');
      throw error;
    }
  });

  // PUT /api/gigs/:gigId/accept
  fastify.put('/api/gigs/:gigId/accept', {
    schema: {
      description: 'Accept a gig as a provider',
      tags: ['gigs'],
      params: {
        type: 'object',
        required: ['gigId'],
        properties: {
          gigId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['providerId'],
        properties: {
          providerId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            acceptedProviderId: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { gigId: string };
      Body: { providerId: string };
    }>,
    reply: FastifyReply
  ) => {
    const { gigId } = request.params;
    const { providerId } = request.body;
    app.logger.info({ gigId, providerId }, 'Provider accepting gig');

    try {
      const gig = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, gigId));

      if (gig.length === 0) {
        app.logger.warn({ gigId }, 'Gig not found');
        return reply.status(404).send({ error: 'Gig not found' });
      }

      if (gig[0].status !== 'open') {
        app.logger.warn({ gigId, status: gig[0].status }, 'Gig is not open');
        return reply.status(400).send({ error: 'Gig is not available for acceptance' });
      }

      const [updatedGig] = await app.db
        .update(schema.gigs)
        .set({
          status: 'accepted',
          acceptedProviderId: providerId,
        })
        .where(eq(schema.gigs.id, gigId))
        .returning();

      app.logger.info({ gigId, providerId, status: 'accepted' }, 'Gig accepted successfully');

      return updatedGig;
    } catch (error) {
      app.logger.error({ err: error, gigId }, 'Failed to accept gig');
      throw error;
    }
  });

  // PUT /api/gigs/:gigId/decline
  fastify.put('/api/gigs/:gigId/decline', {
    schema: {
      description: 'Decline a gig',
      tags: ['gigs'],
      params: {
        type: 'object',
        required: ['gigId'],
        properties: {
          gigId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['providerId'],
        properties: {
          providerId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { gigId: string };
      Body: { providerId: string };
    }>,
    reply: FastifyReply
  ) => {
    const { gigId } = request.params;
    const { providerId } = request.body;
    app.logger.info({ gigId, providerId }, 'Provider declining gig');

    try {
      const gig = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, gigId));

      if (gig.length === 0) {
        app.logger.warn({ gigId }, 'Gig not found');
        return reply.status(404).send({ error: 'Gig not found' });
      }

      // Update gig status back to open if it was accepted by this provider
      if (gig[0].acceptedProviderId === providerId && gig[0].status === 'accepted') {
        await app.db
          .update(schema.gigs)
          .set({
            status: 'open',
            acceptedProviderId: null,
          })
          .where(eq(schema.gigs.id, gigId));
      }

      app.logger.info({ gigId, providerId }, 'Gig declined successfully');

      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, gigId }, 'Failed to decline gig');
      throw error;
    }
  });
}
