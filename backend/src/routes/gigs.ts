import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, ne, isNull, or } from 'drizzle-orm';
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

      // Get client location for matching
      const client = await app.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, clientId));

      if (client.length === 0) {
        app.logger.warn({ clientId }, 'Client not found');
        return reply.status(404).send({ error: 'Client not found' });
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
          selectionExpiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes from now
        })
        .returning();

      // Find matched providers (3-5 providers)
      const allProviders = await app.db
        .select()
        .from(schema.serviceProviders)
        .where(eq(schema.serviceProviders.subscriptionStatus, 'active'));

      app.logger.debug({ gigId: gig.id, totalProviders: allProviders.length }, 'Fetching matched providers');

      // Filter and score providers
      const scoredProviders = allProviders
        .map((provider) => {
          let score = 0;

          // Check if provider has this service category
          if (!provider.latitude || !provider.longitude || !gig.latitude || !gig.longitude) {
            return null; // Skip providers without location
          }

          const gigLat = parseFloat(gig.latitude as any);
          const gigLon = parseFloat(gig.longitude as any);
          const providerLat = parseFloat(provider.latitude as any);
          const providerLon = parseFloat(provider.longitude as any);

          const distance = calculateDistance(providerLat, providerLon, gigLat, gigLon);

          // Distance scoring: closer is better
          if (distance <= provider.commuteDistance) {
            score += Math.max(0, 100 - distance * 10);
          } else {
            return null; // Provider's commute distance doesn't allow this gig
          }

          // Gender preference scoring
          if (!gig.preferredGender || gig.preferredGender === provider.gender) {
            score += 50;
          }

          return { provider, score, distance };
        })
        .filter((entry): entry is { provider: typeof allProviders[0]; score: number; distance: number } => entry !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Take top 5 matches

      // Ensure minimum 3 providers
      if (scoredProviders.length < 3) {
        app.logger.warn({ gigId: gig.id, matched: scoredProviders.length }, 'Less than 3 matched providers found');
      }

      const matchedProviders = scoredProviders.slice(0, 5).map((entry) => ({
        id: entry.provider.id,
        firstName: entry.provider.userId, // We'll get the actual name via relation in client
        gender: entry.provider.gender,
        commuteDistance: entry.provider.commuteDistance,
        distance: entry.distance,
      }));

      app.logger.info(
        { gigId: gig.id, category, matchedCount: matchedProviders.length, selectionExpiresAt: gig.selectionExpiresAt },
        'Gig created successfully with matched providers'
      );

      return reply.status(201).send({
        ...gig,
        matchedProviders,
      });
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

  // GET /api/gigs/:gigId/matched-providers
  fastify.get('/api/gigs/:gigId/matched-providers', {
    schema: {
      description: 'Get matched providers for a gig',
      tags: ['gigs'],
      params: {
        type: 'object',
        required: ['gigId'],
        properties: {
          gigId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              gender: { type: 'string' },
              photoUrl: { type: 'string' },
              distance: { type: 'number' },
            },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { gigId: string } }>,
    reply: FastifyReply
  ) => {
    const { gigId } = request.params;
    app.logger.info({ gigId }, 'Fetching matched providers for gig');

    try {
      const gig = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, gigId));

      if (gig.length === 0) {
        app.logger.warn({ gigId }, 'Gig not found');
        return reply.status(404).send({ error: 'Gig not found' });
      }

      const gigData = gig[0];

      // Get all active providers
      const allProviders = await app.db
        .select()
        .from(schema.serviceProviders)
        .where(eq(schema.serviceProviders.subscriptionStatus, 'active'));

      // Filter and score providers
      const scoredProviders = allProviders
        .map((provider) => {
          if (!provider.latitude || !provider.longitude || !gigData.latitude || !gigData.longitude) {
            return null;
          }

          const gigLat = parseFloat(gigData.latitude as any);
          const gigLon = parseFloat(gigData.longitude as any);
          const providerLat = parseFloat(provider.latitude as any);
          const providerLon = parseFloat(provider.longitude as any);

          const distance = calculateDistance(providerLat, providerLon, gigLat, gigLon);

          if (distance > provider.commuteDistance) {
            return null;
          }

          let score = Math.max(0, 100 - distance * 10);
          if (!gigData.preferredGender || gigData.preferredGender === provider.gender) {
            score += 50;
          }

          return { provider, score, distance };
        })
        .filter((entry): entry is { provider: typeof allProviders[0]; score: number; distance: number } => entry !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // Get provider user details and format response
      const matchedProvidersWithDetails = await Promise.all(
        scoredProviders.map(async (entry) => {
          const user = await app.db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, entry.provider.userId));

          return {
            id: entry.provider.id,
            firstName: user[0]?.firstName || '',
            lastName: user[0]?.lastName || '',
            gender: entry.provider.gender,
            photoUrl: entry.provider.photoUrl,
            distance: parseFloat(entry.distance.toFixed(2)),
          };
        })
      );

      app.logger.info({ gigId, count: matchedProvidersWithDetails.length }, 'Matched providers fetched successfully');

      return matchedProvidersWithDetails;
    } catch (error) {
      app.logger.error({ err: error, gigId }, 'Failed to fetch matched providers');
      throw error;
    }
  });

  // POST /api/gigs/:gigId/select-provider
  fastify.post('/api/gigs/:gigId/select-provider', {
    schema: {
      description: 'Client selects a provider for a gig',
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
            message: { type: 'string' },
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
    app.logger.info({ gigId, providerId }, 'Client selecting provider for gig');

    try {
      const gig = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, gigId));

      if (gig.length === 0) {
        app.logger.warn({ gigId }, 'Gig not found');
        return reply.status(404).send({ error: 'Gig not found' });
      }

      const gigData = gig[0];

      // Check if selection period has expired
      if (gigData.selectionExpiresAt && new Date() > gigData.selectionExpiresAt) {
        app.logger.warn({ gigId }, 'Selection period has expired');
        return reply.status(400).send({ error: 'Selection period has expired. Gig has been broadcast to providers.' });
      }

      // Update gig with selected provider
      await app.db
        .update(schema.gigs)
        .set({
          selectedProviderId: providerId,
          directOfferSentAt: new Date(),
        })
        .where(eq(schema.gigs.id, gigId));

      // In production, send USSD notification to provider here
      // app.sendUSSDNotification(providerId, gig);

      app.logger.info({ gigId, providerId, expiresAt: new Date(Date.now() + 3 * 60 * 1000) }, 'Provider selected for gig');

      return {
        success: true,
        message: 'Provider selected. Provider has 3 minutes to accept or decline.',
      };
    } catch (error) {
      app.logger.error({ err: error, gigId }, 'Failed to select provider');
      throw error;
    }
  });

  // POST /api/gigs/:gigId/accept-direct-offer
  fastify.post('/api/gigs/:gigId/accept-direct-offer', {
    schema: {
      description: 'Provider accepts direct offer from client',
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
            clientPhoneNumber: { type: 'string' },
            clientName: { type: 'string' },
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
    app.logger.info({ gigId, providerId }, 'Provider accepting direct offer');

    try {
      const gig = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, gigId));

      if (gig.length === 0) {
        app.logger.warn({ gigId }, 'Gig not found');
        return reply.status(404).send({ error: 'Gig not found' });
      }

      const gigData = gig[0];

      // Verify this provider was selected
      if (gigData.selectedProviderId !== providerId) {
        app.logger.warn({ gigId, providerId }, 'Provider was not selected for this gig');
        return reply.status(403).send({ error: 'This provider was not selected for this gig' });
      }

      // Check if offer has expired (3 minutes)
      if (gigData.directOfferSentAt) {
        const offerAge = Date.now() - gigData.directOfferSentAt.getTime();
        if (offerAge > 3 * 60 * 1000) {
          app.logger.warn({ gigId, providerId }, 'Direct offer has expired');
          return reply.status(400).send({ error: 'Direct offer has expired' });
        }
      }

      // Update gig status to accepted
      await app.db
        .update(schema.gigs)
        .set({
          status: 'accepted',
          acceptedProviderId: providerId,
          selectedProviderId: null, // Clear selected provider once accepted
        })
        .where(eq(schema.gigs.id, gigId));

      // Get client phone and name for provider
      const client = await app.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, gigData.clientId));

      app.logger.info(
        { gigId, providerId, clientId: gigData.clientId },
        'Provider accepted direct offer - gig assigned'
      );

      return {
        success: true,
        clientPhoneNumber: client[0]?.email || 'Contact via app', // Using email as phone placeholder
        clientName: `${client[0]?.firstName} ${client[0]?.lastName}`,
      };
    } catch (error) {
      app.logger.error({ err: error, gigId }, 'Failed to accept direct offer');
      throw error;
    }
  });

  // POST /api/gigs/:gigId/decline-direct-offer
  fastify.post('/api/gigs/:gigId/decline-direct-offer', {
    schema: {
      description: 'Provider declines direct offer from client',
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
            message: { type: 'string' },
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
    app.logger.info({ gigId, providerId }, 'Provider declining direct offer');

    try {
      const gig = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, gigId));

      if (gig.length === 0) {
        app.logger.warn({ gigId }, 'Gig not found');
        return reply.status(404).send({ error: 'Gig not found' });
      }

      const gigData = gig[0];

      // Verify this provider was selected
      if (gigData.selectedProviderId !== providerId) {
        app.logger.warn({ gigId, providerId }, 'Provider was not selected for this gig');
        return reply.status(403).send({ error: 'This provider was not selected for this gig' });
      }

      // Clear selected provider and broadcast to universe
      await app.db
        .update(schema.gigs)
        .set({
          selectedProviderId: null,
          broadcastAt: new Date(),
        })
        .where(eq(schema.gigs.id, gigId));

      app.logger.info({ gigId, providerId }, 'Provider declined - gig broadcast to providers');

      return {
        success: true,
        message: 'Gig has been broadcast to all available providers',
      };
    } catch (error) {
      app.logger.error({ err: error, gigId }, 'Failed to decline direct offer');
      throw error;
    }
  });

  // POST /api/gigs/:gigId/broadcast
  fastify.post('/api/gigs/:gigId/broadcast', {
    schema: {
      description: 'Broadcast gig to provider universe after 3 minutes',
      tags: ['gigs'],
      params: {
        type: 'object',
        required: ['gigId'],
        properties: {
          gigId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            broadcastCount: { type: 'integer' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { gigId: string } }>,
    reply: FastifyReply
  ) => {
    const { gigId } = request.params;
    app.logger.info({ gigId }, 'Broadcasting gig to provider universe');

    try {
      const gig = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, gigId));

      if (gig.length === 0) {
        app.logger.warn({ gigId }, 'Gig not found');
        return reply.status(404).send({ error: 'Gig not found' });
      }

      const gigData = gig[0];

      // Check if already broadcast
      if (gigData.broadcastAt) {
        app.logger.warn({ gigId }, 'Gig already broadcast');
        return reply.status(400).send({ error: 'Gig has already been broadcast' });
      }

      // Get all active providers
      const activeProviders = await app.db
        .select()
        .from(schema.serviceProviders)
        .where(eq(schema.serviceProviders.subscriptionStatus, 'active'));

      // Filter to relevant providers based on location and category
      const relevantProviders = activeProviders.filter((provider) => {
        if (!provider.latitude || !provider.longitude || !gigData.latitude || !gigData.longitude) {
          return false;
        }

        const gigLat = parseFloat(gigData.latitude as any);
        const gigLon = parseFloat(gigData.longitude as any);
        const providerLat = parseFloat(provider.latitude as any);
        const providerLon = parseFloat(provider.longitude as any);

        const distance = calculateDistance(providerLat, providerLon, gigLat, gigLon);

        // Must be within commute distance and satisfy gender preference
        return (
          distance <= provider.commuteDistance &&
          (!gigData.preferredGender || gigData.preferredGender === provider.gender)
        );
      });

      // Create broadcast records
      for (const provider of relevantProviders) {
        await app.db.insert(schema.gigBroadcasts).values({
          gigId,
          providerId: provider.id,
          status: 'pending',
        });
      }

      // Update gig broadcast timestamp
      await app.db
        .update(schema.gigs)
        .set({
          broadcastAt: new Date(),
          selectedProviderId: null, // Clear selected provider
        })
        .where(eq(schema.gigs.id, gigId));

      app.logger.info({ gigId, broadcastCount: relevantProviders.length }, 'Gig broadcast successfully');

      return {
        success: true,
        broadcastCount: relevantProviders.length,
      };
    } catch (error) {
      app.logger.error({ err: error, gigId }, 'Failed to broadcast gig');
      throw error;
    }
  });

  // GET /api/gigs/:gigId/status
  fastify.get('/api/gigs/:gigId/status', {
    schema: {
      description: 'Get gig status with time remaining for selection/broadcast',
      tags: ['gigs'],
      params: {
        type: 'object',
        required: ['gigId'],
        properties: {
          gigId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            selectedProviderId: { type: 'string' },
            broadcastAt: { type: 'string' },
            selectionTimeRemainingSeconds: { type: 'integer' },
            acceptOfferTimeRemainingSeconds: { type: 'integer' },
            isBroadcast: { type: 'boolean' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { gigId: string } }>,
    reply: FastifyReply
  ) => {
    const { gigId } = request.params;
    app.logger.info({ gigId }, 'Fetching gig status');

    try {
      const gig = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, gigId));

      if (gig.length === 0) {
        app.logger.warn({ gigId }, 'Gig not found');
        return reply.status(404).send({ error: 'Gig not found' });
      }

      const gigData = gig[0];
      const now = Date.now();

      // Calculate time remaining for selection (3 minutes from creation)
      let selectionTimeRemaining = 0;
      if (gigData.selectionExpiresAt) {
        selectionTimeRemaining = Math.max(
          0,
          Math.floor((gigData.selectionExpiresAt.getTime() - now) / 1000)
        );
      }

      // Calculate time remaining for offer acceptance (3 minutes from direct offer sent)
      let acceptOfferTimeRemaining = 0;
      if (gigData.directOfferSentAt) {
        acceptOfferTimeRemaining = Math.max(
          0,
          Math.floor((gigData.directOfferSentAt.getTime() + 3 * 60 * 1000 - now) / 1000)
        );
      }

      const response = {
        id: gigData.id,
        status: gigData.status,
        selectedProviderId: gigData.selectedProviderId || null,
        broadcastAt: gigData.broadcastAt?.toISOString() || null,
        selectionTimeRemainingSeconds: selectionTimeRemaining,
        acceptOfferTimeRemainingSeconds: acceptOfferTimeRemaining,
        isBroadcast: !!gigData.broadcastAt,
      };

      app.logger.info(
        { gigId, status: gigData.status, isBroadcast: !!gigData.broadcastAt },
        'Gig status retrieved'
      );

      return response;
    } catch (error) {
      app.logger.error({ err: error, gigId }, 'Failed to fetch gig status');
      throw error;
    }
  });
}
