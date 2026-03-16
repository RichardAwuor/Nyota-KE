import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

// Build Nairobi timestamp in format YYYYMMDDHHmmss
function getNairobiTimestamp(): string {
  const nairobiOffset = 3 * 60 * 60 * 1000;
  const nairobiDate = new Date(Date.now() + nairobiOffset);

  const year = nairobiDate.getUTCFullYear();
  const month = String(nairobiDate.getUTCMonth() + 1).padStart(2, '0');
  const date = String(nairobiDate.getUTCDate()).padStart(2, '0');
  const hours = String(nairobiDate.getUTCHours()).padStart(2, '0');
  const minutes = String(nairobiDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(nairobiDate.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${date}${hours}${minutes}${seconds}`;
}

// Normalize phone number to 254XXXXXXXXX format
function normalizePhoneNumber(phoneNumber: string): string {
  // 1. Strip all spaces, dashes, and + characters
  let normalized = phoneNumber.replace(/[\s\-+]/g, '');

  // 2. If it starts with "0", replace the leading "0" with "254"
  if (normalized.startsWith('0')) {
    return '254' + normalized.substring(1);
  }

  // 3. If it already starts with "254", leave as-is
  if (normalized.startsWith('254')) {
    return normalized;
  }

  // 4. Otherwise, prepend "254"
  return '254' + normalized;
}

export function registerMpesaRoutes(app: App, fastify: FastifyInstance) {
  // POST /api/mpesa/initiate
  fastify.post('/api/mpesa/initiate', {
    schema: {
      description: 'Initiate M-Pesa STK Push payment',
      tags: ['mpesa'],
      body: {
        type: 'object',
        required: ['providerId', 'phoneNumber'],
        properties: {
          providerId: { type: 'string' },
          phoneNumber: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'STK Push initiated',
          type: 'object',
          properties: {
            checkoutRequestId: { type: 'string' },
            merchantRequestId: { type: 'string' },
            message: { type: 'string' },
          },
        },
        502: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        503: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Body: { providerId: string; phoneNumber: string };
    }>,
    reply: FastifyReply
  ) => {
    // Validate env vars
    const requiredEnvVars = [
      'MPESA_CONSUMER_KEY',
      'MPESA_CONSUMER_SECRET',
      'MPESA_PASSKEY',
      'MPESA_SHORTCODE',
      'MPESA_CALLBACK_URL',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        app.logger.warn({ missingEnv: envVar }, 'M-Pesa env var missing');
        return reply.status(503).send({
          error: 'M-Pesa payment service is not configured.',
        });
      }
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY!;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;
    const passKey = process.env.MPESA_PASSKEY!;
    const shortCode = process.env.MPESA_SHORTCODE!;
    const callbackUrl = process.env.MPESA_CALLBACK_URL!;

    const { providerId, phoneNumber } = request.body;

    app.logger.info(
      { providerId, phoneNumber },
      'M-Pesa initiate request received'
    );

    try {
      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      app.logger.info(
        { original: phoneNumber, normalized: normalizedPhone },
        'Phone number normalized'
      );

      // Get OAuth token
      app.logger.info(
        { url: 'https://api.safaricom.co.ke/oauth/v1/generate' },
        'Requesting M-Pesa OAuth token'
      );

      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      let tokenResponse;
      try {
        tokenResponse = await axios.get(
          'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
          {
            headers: {
              Authorization: `Basic ${auth}`,
            },
          }
        );
      } catch (error: any) {
        app.logger.error(
          { err: error, response: error.response?.data },
          'Failed to get M-Pesa OAuth token'
        );
        return reply.status(502).send({
          error: `M-Pesa error: Failed to authenticate`,
        });
      }

      const accessToken = tokenResponse.data.access_token;
      app.logger.info(
        { token: accessToken.substring(0, 20) + '...' },
        'OAuth token received'
      );

      // Build C2B Simulate payload
      const c2bPayload = {
        ShortCode: 8937121,
        CommandID: 'CustomerPayBillOnline',
        Amount: 130,
        Msisdn: normalizedPhone,
        BillRefNumber: 'null',
      };

      app.logger.info(
        {
          shortCode: 8937121,
          amount: 130,
          phone: normalizedPhone,
        },
        'C2B Simulate payload prepared'
      );
      app.logger.debug({ payload: c2bPayload }, 'Full C2B Simulate payload');

      // Send C2B Simulate request
      app.logger.info(
        { url: 'https://api.safaricom.co.ke/mpesa/c2b/v1/simulate' },
        'Sending C2B Simulate request'
      );

      let c2bResponse;
      try {
        c2bResponse = await axios.post(
          'https://api.safaricom.co.ke/mpesa/c2b/v1/simulate',
          c2bPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error: any) {
        const errorMsg =
          error.response?.data?.errorMessage ||
          error.response?.data?.ResponseDescription ||
          error.message;
        app.logger.error(
          {
            err: error,
            response: error.response?.data,
            status: error.response?.status,
          },
          'C2B Simulate request failed'
        );
        return reply.status(502).send({
          error: `M-Pesa error: ${errorMsg}`,
        });
      }

      app.logger.info(
        {
          status: c2bResponse.status,
          responseCode: c2bResponse.data?.ResponseCode,
          responseDesc: c2bResponse.data?.ResponseDescription,
          transactionId: c2bResponse.data?.TransactionID,
        },
        'C2B Simulate response received'
      );

      // Check response code
      if (c2bResponse.data?.ResponseCode !== '0') {
        const errorMsg = c2bResponse.data?.ResponseDescription || 'Unknown error';
        app.logger.warn(
          { responseCode: c2bResponse.data?.ResponseCode },
          'C2B Simulate returned error code'
        );
        return reply.status(502).send({
          error: `M-Pesa error: ${errorMsg}`,
        });
      }

      const transactionId = c2bResponse.data.TransactionID;
      const checkoutRequestId = transactionId;
      const merchantRequestId = `MR-${Date.now()}-${providerId}`;

      // Save transaction
      app.logger.info(
        { providerId, checkoutRequestId, merchantRequestId },
        'Saving transaction record'
      );

      await app.db.insert(schema.mpesaTransactions).values({
        providerId,
        phoneNumber: normalizedPhone,
        checkoutRequestId,
        merchantRequestId,
        amount: 130,
        status: 'pending',
      });

      app.logger.info(
        { checkoutRequestId, providerId },
        'Transaction saved successfully'
      );

      return reply.status(200).send({
        checkoutRequestId,
        merchantRequestId,
        message: 'Please check your phone for the M-Pesa prompt.',
      });
    } catch (error: any) {
      app.logger.error({ err: error }, 'Unexpected error in M-Pesa initiate');
      return reply.status(500).send({
        error: 'An unexpected error occurred',
      });
    }
  });

  // POST /api/mpesa/callback
  fastify.post('/api/mpesa/callback', {
    schema: {
      description: 'M-Pesa callback endpoint',
      tags: ['mpesa'],
      body: { type: 'object' },
      response: {
        200: {
          type: 'object',
          properties: {
            ResultCode: { type: 'integer' },
            ResultDesc: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: Record<string, any> }>,
    reply: FastifyReply
  ) => {
    const body = request.body as Record<string, any>;
    app.logger.info({ body }, 'M-Pesa callback received');

    try {
      const stkCallback = body.Body?.stkCallback;

      if (!stkCallback) {
        app.logger.warn({}, 'Invalid callback structure');
        return reply.status(200).send({
          ResultCode: 1,
          ResultDesc: 'Invalid callback',
        });
      }

      const {
        MerchantRequestID,
        CheckoutRequestID,
        ResultCode,
        ResultDesc,
        CallbackMetadata,
      } = stkCallback;

      app.logger.info(
        {
          checkoutRequestId: CheckoutRequestID,
          resultCode: ResultCode,
          resultDesc: ResultDesc,
        },
        'Callback data extracted'
      );

      if (ResultCode === 0) {
        // Success - extract receipt number
        const mpesaReceiptNumber = CallbackMetadata?.Item?.find(
          (item: any) => item.Name === 'MpesaReceiptNumber'
        )?.Value;

        app.logger.info(
          {
            checkoutRequestId: CheckoutRequestID,
            receiptNumber: mpesaReceiptNumber,
          },
          'Payment successful'
        );

        // Update transaction
        const updated = await app.db
          .update(schema.mpesaTransactions)
          .set({
            status: 'completed',
            mpesaReceiptNumber,
          })
          .where(
            eq(
              schema.mpesaTransactions.checkoutRequestId,
              CheckoutRequestID
            )
          )
          .returning();

        if (updated.length > 0) {
          const txn = updated[0];
          const providerId = txn.providerId;

          app.logger.info(
            { providerId },
            'Transaction updated, updating provider subscription'
          );

          // Update provider subscription
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

          await app.db
            .update(schema.serviceProviders)
            .set({
              subscriptionStatus: 'active',
              subscriptionExpiresAt: thirtyDaysFromNow,
            })
            .where(eq(schema.serviceProviders.id, providerId));

          app.logger.info(
            {
              providerId,
              expiresAt: thirtyDaysFromNow,
            },
            'Provider subscription activated'
          );
        }
      } else {
        // Failure
        app.logger.warn(
          {
            checkoutRequestId: CheckoutRequestID,
            resultCode: ResultCode,
          },
          'Payment failed'
        );

        await app.db
          .update(schema.mpesaTransactions)
          .set({
            status: 'failed',
            resultDesc: ResultDesc,
          })
          .where(
            eq(
              schema.mpesaTransactions.checkoutRequestId,
              CheckoutRequestID
            )
          );
      }

      // Always return success to Safaricom
      return reply.status(200).send({
        ResultCode: 0,
        ResultDesc: 'Accepted',
      });
    } catch (error: any) {
      app.logger.error({ err: error }, 'Error processing callback');
      return reply.status(200).send({
        ResultCode: 0,
        ResultDesc: 'Accepted',
      });
    }
  });

  // GET /api/mpesa/status/:checkoutRequestId
  fastify.get('/api/mpesa/status/:checkoutRequestId', {
    schema: {
      description: 'Get M-Pesa transaction status',
      tags: ['mpesa'],
      params: {
        type: 'object',
        required: ['checkoutRequestId'],
        properties: {
          checkoutRequestId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            resultDesc: { type: 'string' },
            receiptNumber: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { checkoutRequestId: string } }>,
    reply: FastifyReply
  ) => {
    const { checkoutRequestId } = request.params;

    app.logger.info({ checkoutRequestId }, 'Status query received');

    try {
      const transaction = await app.db
        .select()
        .from(schema.mpesaTransactions)
        .where(
          eq(
            schema.mpesaTransactions.checkoutRequestId,
            checkoutRequestId
          )
        );

      if (transaction.length === 0) {
        app.logger.warn({ checkoutRequestId }, 'Transaction not found');
        return reply.status(404).send({
          error: 'Transaction not found',
        });
      }

      const txn = transaction[0];
      app.logger.info(
        {
          checkoutRequestId,
          status: txn.status,
        },
        'Transaction status retrieved'
      );

      return reply.status(200).send({
        status: txn.status,
        resultDesc: txn.resultDesc || null,
        receiptNumber: txn.mpesaReceiptNumber || null,
      });
    } catch (error: any) {
      app.logger.error({ err: error }, 'Error fetching transaction status');
      throw error;
    }
  });
}
