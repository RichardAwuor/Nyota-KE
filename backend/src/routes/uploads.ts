import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerUploadRoutes(app: App, fastify: FastifyInstance) {
  // POST /api/upload/provider-photo
  fastify.post('/api/upload/provider-photo', {
    schema: {
      description: 'Upload provider profile photo',
      tags: ['uploads'],
      response: {
        200: {
          type: 'object',
          properties: {
            url: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<{ url: string } | void> => {
    app.logger.info({}, 'Uploading provider photo');

    try {
      const data = await request.file();
      if (!data) {
        app.logger.warn({}, 'No file provided in upload');
        return reply.status(400).send({ error: 'No file provided' });
      }

      const buffer = await data.toBuffer();
      const timestamp = Date.now();
      const filename = `provider-photos/${timestamp}-${data.filename}`;

      const key = await app.storage.upload(filename, buffer);
      const { url } = await app.storage.getSignedUrl(key);

      app.logger.info({ key, filename }, 'Provider photo uploaded successfully');

      return { url };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to upload provider photo');
      throw error;
    }
  });
}
