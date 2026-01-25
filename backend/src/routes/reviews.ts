import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerReviewRoutes(app: App, fastify: FastifyInstance) {
  // POST /api/reviews
  fastify.post('/api/reviews', {
    schema: {
      description: 'Create a review for a completed gig',
      tags: ['reviews'],
      body: {
        type: 'object',
        required: ['gigId', 'providerId', 'clientId', 'reviewText'],
        properties: {
          gigId: { type: 'string' },
          providerId: { type: 'string' },
          clientId: { type: 'string' },
          reviewText: { type: 'string', maxLength: 80 },
        },
      },
      response: {
        201: {
          description: 'Review created successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
            gigId: { type: 'string' },
            providerId: { type: 'string' },
            clientId: { type: 'string' },
            reviewText: { type: 'string' },
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
      Body: {
        gigId: string;
        providerId: string;
        clientId: string;
        reviewText: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { gigId, providerId, clientId, reviewText } = request.body;
    app.logger.info({ gigId, providerId }, 'Creating review');

    try {
      if (reviewText.length > 80) {
        app.logger.warn({ gigId }, 'Review text exceeds 80 characters');
        return reply.status(400).send({ error: 'Review text must not exceed 80 characters' });
      }

      // Check if gig exists and is completed
      const gig = await app.db
        .select()
        .from(schema.gigs)
        .where(eq(schema.gigs.id, gigId));

      if (gig.length === 0) {
        app.logger.warn({ gigId }, 'Gig not found');
        return reply.status(404).send({ error: 'Gig not found' });
      }

      if (gig[0].status !== 'completed') {
        app.logger.warn({ gigId, status: gig[0].status }, 'Gig is not completed');
        return reply.status(400).send({ error: 'Can only review completed gigs' });
      }

      // Check if review already exists for this gig
      const existingReview = await app.db
        .select()
        .from(schema.reviews)
        .where(eq(schema.reviews.gigId, gigId));

      if (existingReview.length > 0) {
        app.logger.warn({ gigId }, 'Review already exists for this gig');
        return reply.status(400).send({ error: 'Review already exists for this gig' });
      }

      const [review] = await app.db
        .insert(schema.reviews)
        .values({
          gigId,
          providerId,
          clientId,
          reviewText,
        })
        .returning();

      app.logger.info({ reviewId: review.id, gigId }, 'Review created successfully');

      return reply.status(201).send(review);
    } catch (error) {
      app.logger.error({ err: error, gigId }, 'Failed to create review');
      throw error;
    }
  });

  // GET /api/reviews/provider/:providerId
  fastify.get('/api/reviews/provider/:providerId', {
    schema: {
      description: 'Get reviews for a provider from the last 90 days',
      tags: ['reviews'],
      params: {
        type: 'object',
        required: ['providerId'],
        properties: {
          providerId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              gigId: { type: 'string' },
              providerId: { type: 'string' },
              clientId: { type: 'string' },
              reviewText: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { providerId: string } }>,
    reply: FastifyReply
  ) => {
    const { providerId } = request.params;
    app.logger.info({ providerId }, 'Fetching reviews for provider');

    try {
      // Calculate date 90 days ago
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const providerReviews = await app.db
        .select()
        .from(schema.reviews)
        .where(
          and(
            eq(schema.reviews.providerId, providerId),
            gte(schema.reviews.createdAt, ninetyDaysAgo)
          )
        );

      app.logger.info({ providerId, count: providerReviews.length }, 'Reviews fetched successfully');

      return providerReviews;
    } catch (error) {
      app.logger.error({ err: error, providerId }, 'Failed to fetch provider reviews');
      throw error;
    }
  });
}
