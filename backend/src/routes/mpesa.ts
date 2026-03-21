import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

// Build UTC timestamp in format YYYYMMDDHHmmss
function getUtcTimestamp(): string {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const date = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${date}${hours}${minutes}${seconds}`;
}

// Normalize phone number to 254XXXXXXXXX format
function normalizePhoneNumber(phoneNumber: string): string {
  // Strip all spaces, dashes, and + characters
  let normalized = phoneNumber.replace(/[\s\-+]/g, '');

  // If it starts with "0", replace the leading "0" with "254"
  if (normalized.startsWith('0')) {
    return '254' + normalized.substring(1);
  }

  // If it already starts with "254", leave as-is
  if (normalized.startsWith('254')) {
    return normalized;
  }

  // Otherwise, prepend "254"
  return '254' + normalized;
}

export function registerMpesaRoutes(app: App, fastify: FastifyInstance) {
  // POST /api/mpesa/initiate
  fastify.post('/api/mpesa/initiate', {
    schema: {
      description: 'Initiate M-Pesa STK Push (Lipa Na M-Pesa Online) payment',
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
          description: 'STK Push initiated successfully',
          type: 'object',
          properties: {
            checkoutRequestId: { type: 'string' },
            merchantRequestId: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } },
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
      Body: { providerId?: string; phoneNumber?: string };
    }>,
    reply: FastifyReply
  ) => {
    const { providerId, phoneNumber } = request.body;

    // Validate required fields
    if (!providerId) {
      app.logger.warn({}, 'M-Pesa initiate: missing providerId');
      return reply.status(400).send({
        error: 'providerId is required',
      });
    }

    if (!phoneNumber) {
      app.logger.warn({}, 'M-Pesa initiate: missing phoneNumber');
      return reply.status(400).send({
        error: 'phoneNumber is required',
      });
    }

    // Validate env vars
    const requiredEnvVars = [
      'MPESA_CONSUMER_KEY',
      'MPESA_CONSUMER_SECRET',
      'MPESA_PASSKEY',
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
    const callbackUrl = process.env.MPESA_CALLBACK_URL!;
    const businessShortCode = '8937121';

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

      // Validate phone format
      if (!/^254\d{9}$/.test(normalizedPhone)) {
        app.logger.warn(
          { normalized: normalizedPhone },
          'Invalid phone number format after normalization'
        );
        return reply.status(400).send({
          error: 'Invalid phone number format',
        });
      }

      // Get OAuth token
      app.logger.info(
        { url: 'https://api.safaricom.co.ke/oauth/v1/generate' },
        'Requesting M-Pesa OAuth token from production'
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
        console.log('Safaricom OAuth response status:', tokenResponse.status);
        app.logger.info(
          { status: tokenResponse.status },
          'OAuth token received successfully'
        );
      } catch (error: any) {
        const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
        console.log('Safaricom OAuth error response:', JSON.stringify(error.response?.data));
        app.logger.error(
          {
            err: error,
            status: error.response?.status,
            errorMessage: errorMsg,
            response: error.response?.data,
          },
          'Failed to get M-Pesa OAuth token'
        );
        return reply.status(502).send({
          error: `Failed to get M-Pesa access token: ${errorMsg}`,
          safaricomResponse: error.response?.data,
        });
      }

      const accessToken = tokenResponse.data.access_token;
      app.logger.info(
        { tokenPrefix: accessToken.substring(0, 20) + '...' },
        'OAuth token received'
      );

      // Build UTC timestamp
      const timestamp = getUtcTimestamp();
      app.logger.info({ timestamp }, 'UTC timestamp built');

      // Build password: base64(BusinessShortCode + PASSKEY + Timestamp)
      const passwordString = `${businessShortCode}${passKey}${timestamp}`;
      const password = Buffer.from(passwordString).toString('base64');
      app.logger.debug({ passwordString, password }, 'STK Push password generated');

      // Build STK Push payload
      const stkPushPayload = {
        BusinessShortCode: businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: 130,
        PartyA: normalizedPhone,
        PartyB: businessShortCode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: 'NyotaKE',
        TransactionDesc: 'Subscription Payment',
      };

      app.logger.info(
        {
          businessShortCode,
          amount: 130,
          phoneNumber: normalizedPhone,
          callbackUrl,
        },
        'STK Push payload prepared'
      );
      app.logger.debug({ payload: stkPushPayload }, 'Full STK Push payload for debugging');

      // Send STK Push request
      app.logger.info(
        { url: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest' },
        'Sending STK Push request to Safaricom'
      );

      let stkResponse;
      try {
        stkResponse = await axios.post(
          'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
          stkPushPayload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('Safaricom STK Push full response:', JSON.stringify(stkResponse.data));
        app.logger.info(
          {
            status: stkResponse.status,
            resultCode: stkResponse.data?.ResultCode,
            resultDesc: stkResponse.data?.ResponseDescription,
            checkoutRequestId: stkResponse.data?.CheckoutRequestID,
            merchantRequestId: stkResponse.data?.MerchantRequestID,
          },
          'STK Push response received from Safaricom'
        );
      } catch (error: any) {
        const errorMsg =
          error.response?.data?.errorMessage ||
          error.response?.data?.ResponseDescription ||
          error.response?.data?.error ||
          error.message;
        console.log('Safaricom STK Push error response:', JSON.stringify(error.response?.data));
        app.logger.error(
          {
            err: error,
            status: error.response?.status,
            errorMessage: errorMsg,
            response: error.response?.data,
          },
          'STK Push request failed'
        );
        return reply.status(502).send({
          error: `M-Pesa STK Push failed: ${errorMsg}`,
          safaricomResponse: error.response?.data,
        });
      }

      // Check result code for non-zero responses
      const responseCode = stkResponse.data?.ResultCode;
      if (responseCode !== '0') {
        const errorMsg = stkResponse.data?.ResponseDescription || `Safaricom error code: ${responseCode}`;
        app.logger.warn(
          { resultCode: responseCode, description: stkResponse.data?.ResponseDescription },
          'STK Push returned non-zero result code'
        );
        return reply.status(502).send({
          error: `M-Pesa error: ${errorMsg}`,
          safaricomResponse: stkResponse.data,
        });
      }

      const checkoutRequestId = stkResponse.data.CheckoutRequestID;
      const merchantRequestId = stkResponse.data.MerchantRequestID;

      if (!checkoutRequestId || !merchantRequestId) {
        app.logger.error(
          { response: stkResponse.data },
          'STK Push response missing required fields'
        );
        return reply.status(502).send({
          error: 'Invalid response from M-Pesa',
        });
      }

      // Save transaction record
      app.logger.info(
        {
          providerId,
          checkoutRequestId,
          merchantRequestId,
          phoneNumber: normalizedPhone,
        },
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
        'Transaction record saved successfully'
      );

      return reply.status(200).send({
        checkoutRequestId,
        merchantRequestId,
        message: 'STK Push sent. Check your phone for the M-Pesa prompt.',
      });
    } catch (error: any) {
      app.logger.error(
        { err: error, providerId },
        'Unexpected error in M-Pesa initiate'
      );
      return reply.status(502).send({
        error: 'An unexpected error occurred',
      });
    }
  });

  // POST /api/mpesa/callback
  fastify.post('/api/mpesa/callback', {
    schema: {
      description: 'M-Pesa STK Push callback from Safaricom',
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
    app.logger.info({ body }, 'M-Pesa callback received from Safaricom');

    try {
      const stkCallback = body.Body?.stkCallback;

      if (!stkCallback) {
        app.logger.warn({}, 'Invalid callback structure: missing stkCallback');
        return reply.status(200).send({
          ResultCode: 1,
          ResultDesc: 'Invalid callback structure',
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
          merchantRequestId: MerchantRequestID,
          resultCode: ResultCode,
          resultDesc: ResultDesc,
        },
        'Callback data extracted'
      );

      if (ResultCode === 0) {
        // Payment successful
        app.logger.info(
          { checkoutRequestId: CheckoutRequestID },
          'Payment successful (ResultCode = 0)'
        );

        // Extract MpesaReceiptNumber from CallbackMetadata
        const mpesaReceiptNumber = CallbackMetadata?.Item?.find(
          (item: any) => item.Name === 'MpesaReceiptNumber'
        )?.Value;

        app.logger.info(
          {
            checkoutRequestId: CheckoutRequestID,
            mpesaReceiptNumber,
          },
          'Extracted M-Pesa receipt number'
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
            { providerId, checkoutRequestId: CheckoutRequestID },
            'Transaction updated to completed, now updating provider subscription'
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
            'Provider subscription activated for 30 days'
          );
        } else {
          app.logger.warn(
            { checkoutRequestId: CheckoutRequestID },
            'Transaction not found for update'
          );
        }
      } else {
        // Payment failed or cancelled
        app.logger.warn(
          {
            checkoutRequestId: CheckoutRequestID,
            resultCode: ResultCode,
            resultDesc: ResultDesc,
          },
          'Payment failed or cancelled'
        );

        // Update transaction status to failed
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

        app.logger.info(
          { checkoutRequestId: CheckoutRequestID },
          'Transaction updated to failed'
        );
      }

      // Always return success to Safaricom (required)
      return reply.status(200).send({
        ResultCode: 0,
        ResultDesc: 'Accepted',
      });
    } catch (error: any) {
      app.logger.error(
        { err: error },
        'Error processing M-Pesa callback'
      );
      // Return success to Safaricom even on error (prevents Safaricom from retrying)
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

    app.logger.info(
      { checkoutRequestId },
      'Transaction status query received'
    );

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
        app.logger.warn(
          { checkoutRequestId },
          'Transaction not found'
        );
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
      });
    } catch (error: any) {
      app.logger.error(
        { err: error, checkoutRequestId },
        'Error fetching transaction status'
      );
      throw error;
    }
  });
}
