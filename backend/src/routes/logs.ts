import { FastifyRequest, FastifyReply } from 'fastify';
import { eq, gte, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerLogRoutes(app: App, fastify: any) {
  // GET /api/logs/mpesa - Retrieve M-Pesa API logs and transaction history
  fastify.get<{ Querystring: { limit?: string; offset?: string; status?: string } }>('/api/logs/mpesa', async (
    request: FastifyRequest<{
      Querystring: { limit?: string; offset?: string; status?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const limit = Math.min(parseInt(request.query.limit || '100'), 500);
      const offset = parseInt(request.query.offset || '0');
      const status = request.query.status;

      let query = app.db
        .select()
        .from(schema.mpesaTransactions)
        .orderBy(desc(schema.mpesaTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      if (status) {
        query = app.db
          .select()
          .from(schema.mpesaTransactions)
          .where(eq(schema.mpesaTransactions.status, status))
          .orderBy(desc(schema.mpesaTransactions.createdAt))
          .limit(limit)
          .offset(offset);
      }

      const transactions = await query;

      app.logger.info(
        { count: transactions.length, limit, offset },
        'M-Pesa logs retrieved'
      );

      return {
        success: true,
        data: transactions,
        pagination: { limit, offset, count: transactions.length },
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to retrieve M-Pesa logs');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve M-Pesa logs',
      });
    }
  });

  // GET /api/logs/mpesa/stats - Get M-Pesa transaction statistics
  fastify.get('/api/logs/mpesa/stats', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const allTransactions = await app.db
        .select()
        .from(schema.mpesaTransactions);

      const stats = {
        total: allTransactions.length,
        completed: allTransactions.filter(t => t.status === 'completed').length,
        pending: allTransactions.filter(t => t.status === 'pending').length,
        failed: allTransactions.filter(t => t.status === 'failed').length,
        totalAmount: allTransactions.reduce((sum, t) => sum + t.amount, 0),
        averageAmount: allTransactions.length > 0 
          ? Math.round(allTransactions.reduce((sum, t) => sum + t.amount, 0) / allTransactions.length)
          : 0,
        successRate: allTransactions.length > 0
          ? Math.round((allTransactions.filter(t => t.status === 'completed').length / allTransactions.length) * 100)
          : 0,
      };

      app.logger.info(stats, 'M-Pesa statistics retrieved');

      return {
        success: true,
        stats,
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to retrieve M-Pesa statistics');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve M-Pesa statistics',
      });
    }
  });

  // GET /api/logs/mpesa/:id - Get specific transaction details
  fastify.get<{ Params: { id: string } }>(
    '/api/logs/mpesa/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;

        const transaction = await app.db
          .select()
          .from(schema.mpesaTransactions)
          .where(eq(schema.mpesaTransactions.id, id))
          .limit(1);

        if (!transaction.length) {
          return reply.status(404).send({
            success: false,
            error: 'Transaction not found',
          });
        }

        app.logger.info({ transactionId: id }, 'Transaction details retrieved');

        return {
          success: true,
          data: transaction[0],
        };
      } catch (error) {
        app.logger.error({ err: error }, 'Failed to retrieve transaction details');
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve transaction details',
        });
      }
    }
  );
}