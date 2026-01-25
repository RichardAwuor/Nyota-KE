import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerProviderRoutes(app: App, fastify: FastifyInstance) {
  // GET /api/providers/:providerId
  fastify.get('/api/providers/:providerId', {
    schema: {
      description: 'Get provider details with reviews from last 90 days',
      tags: ['providers'],
      params: {
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
            userId: { type: 'string' },
            gender: { type: 'string' },
            providerCode: { type: 'string' },
            commuteDistance: { type: 'integer' },
            subscriptionStatus: { type: 'string' },
            reviews: { type: 'array' },
          },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { providerId: string } }>,
    reply: FastifyReply
  ) => {
    const { providerId } = request.params;
    app.logger.info({ providerId }, 'Fetching provider details');

    try {
      const provider = await app.db
        .select()
        .from(schema.serviceProviders)
        .where(eq(schema.serviceProviders.id, providerId));

      if (provider.length === 0) {
        app.logger.warn({ providerId }, 'Provider not found');
        return reply.status(404).send({ error: 'Provider not found' });
      }

      // Get reviews from last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const reviews = await app.db
        .select()
        .from(schema.reviews)
        .where(
          and(
            eq(schema.reviews.providerId, providerId),
            gte(schema.reviews.createdAt, ninetyDaysAgo)
          )
        );

      const providerData = provider[0];
      app.logger.info({ providerId, reviewCount: reviews.length }, 'Provider details fetched successfully');

      return {
        ...providerData,
        reviews,
      };
    } catch (error) {
      app.logger.error({ err: error, providerId }, 'Failed to fetch provider details');
      throw error;
    }
  });

  // PUT /api/providers/:providerId/subscription
  fastify.put('/api/providers/:providerId/subscription', {
    schema: {
      description: 'Update provider subscription with M-Pesa payment',
      tags: ['providers'],
      params: {
        type: 'object',
        required: ['providerId'],
        properties: {
          providerId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['mpesaTransactionId', 'amount'],
        properties: {
          mpesaTransactionId: { type: 'string' },
          amount: { type: 'integer' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            subscriptionStatus: { type: 'string' },
            subscriptionExpiresAt: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { providerId: string };
      Body: { mpesaTransactionId: string; amount: number };
    }>,
    reply: FastifyReply
  ) => {
    const { providerId } = request.params;
    const { mpesaTransactionId, amount } = request.body;
    app.logger.info({ providerId, mpesaTransactionId, amount }, 'Processing subscription payment');

    try {
      // Validate amount (KES 130 monthly subscription)
      const SUBSCRIPTION_FEE = 130;
      if (amount !== SUBSCRIPTION_FEE) {
        app.logger.warn({ providerId, amount, expected: SUBSCRIPTION_FEE }, 'Invalid subscription amount');
        return reply.status(400).send({ error: `Subscription fee must be KES ${SUBSCRIPTION_FEE}` });
      }

      // In a real app, verify the M-Pesa transaction with safaricom
      // For now, we'll assume the transaction is valid
      app.logger.debug({ mpesaTransactionId }, 'M-Pesa transaction verified (mock)');

      // Calculate expiration date (30 days from now)
      const subscriptionExpiresAt = new Date();
      subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 30);

      // Update provider subscription
      const [updatedProvider] = await app.db
        .update(schema.serviceProviders)
        .set({
          subscriptionStatus: 'active',
          subscriptionExpiresAt,
        })
        .where(eq(schema.serviceProviders.id, providerId))
        .returning();

      app.logger.info({ providerId, expiresAt: subscriptionExpiresAt }, 'Subscription activated successfully');

      return {
        subscriptionStatus: updatedProvider.subscriptionStatus,
        subscriptionExpiresAt,
      };
    } catch (error) {
      app.logger.error({ err: error, providerId }, 'Failed to process subscription payment');
      throw error;
    }
  });
}
