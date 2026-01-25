import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerProfileRoutes(app: App, fastify: FastifyInstance) {
  // GET /api/users/:userId
  fastify.get('/api/users/:userId', {
    schema: {
      description: 'Get user profile with provider details if applicable',
      tags: ['users'],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            userType: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            county: { type: 'string' },
            provider: {
              type: 'object',
              nullable: true,
            },
          },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    app.logger.info({ userId }, 'Fetching user profile');

    try {
      const user = await app.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));

      if (user.length === 0) {
        app.logger.warn({ userId }, 'User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      const userData = user[0];

      // If user is a provider, fetch provider details
      let provider = null;
      if (userData.userType === 'provider') {
        const providerData = await app.db
          .select()
          .from(schema.serviceProviders)
          .where(eq(schema.serviceProviders.userId, userId));

        if (providerData.length > 0) {
          provider = providerData[0];
        }
      }

      app.logger.info({ userId, userType: userData.userType }, 'User profile fetched successfully');

      return {
        ...userData,
        provider,
      };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch user profile');
      throw error;
    }
  });

  // PUT /api/users/:userId
  fastify.put('/api/users/:userId', {
    schema: {
      description: 'Update user profile',
      tags: ['users'],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          county: { type: 'string' },
          organizationName: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            userType: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            county: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { userId: string };
      Body: {
        firstName?: string;
        lastName?: string;
        county?: string;
        organizationName?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.params;
    const { firstName, lastName, county, organizationName } = request.body;
    app.logger.info({ userId }, 'Updating user profile');

    try {
      const user = await app.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));

      if (user.length === 0) {
        app.logger.warn({ userId }, 'User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      const updates: Record<string, any> = {};
      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (county) updates.county = county;
      if (organizationName) updates.organizationName = organizationName;

      const [updatedUser] = await app.db
        .update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, userId))
        .returning();

      app.logger.info({ userId }, 'User profile updated successfully');

      return updatedUser;
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to update user profile');
      throw error;
    }
  });

  // GET /api/counties
  fastify.get('/api/counties', {
    schema: {
      description: 'Get all counties',
      tags: ['counties'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              code: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    app.logger.info({}, 'Fetching all counties');

    try {
      const allCounties = await app.db
        .select()
        .from(schema.counties);

      app.logger.info({ count: allCounties.length }, 'Counties fetched successfully');

      return allCounties;
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to fetch counties');
      throw error;
    }
  });
}
