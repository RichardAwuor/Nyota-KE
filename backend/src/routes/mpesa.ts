import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

// M-Pesa C2B credentials (Production)
const CONSUMER_KEY = 'bZHFT3P37yZRT6W06xI6hbaqiR3n2A887tmi9T01ZwbjX2Ab';
const CONSUMER_SECRET = '5bBgJVgT6EO5pGuAHBG9FZxbaau7ky5LCkcYQFx8DxuFvmbOVOMAgynkZAsg6xhz';
const SHORTCODE = '6803513';
const SUBSCRIPTION_AMOUNT = 130;

// M-Pesa API URLs (Production - C2B)
const AUTH_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const C2B_REGISTER_URL = 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl';
const C2B_SIMULATE_URL = 'https://api.safaricom.co.ke/mpesa/c2b/v1/simulate';

// Get M-Pesa access token
async function getMpesaAccessToken(): Promise<string> {
  try {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(AUTH_URL, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    return response.data.access_token;
  } catch (error: any) {
    const errorMsg = error.response?.data || error.message;
    throw new Error(`Failed to get M-Pesa access token: ${JSON.stringify(errorMsg)}`);
  }
}

// Generate timestamp in format YYYYMMDDHHmmss
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${date}${hours}${minutes}${seconds}`;
}

// Generate password for M-Pesa
function generatePassword(shortcode: string, passkey: string, timestamp: string): string {
  const str = shortcode + passkey + timestamp;
  return Buffer.from(str).toString('base64');
}

export function registerMpesaRoutes(app: App, fastify: FastifyInstance) {
  // POST /api/mpesa/initiate
  fastify.post('/api/mpesa/initiate', {
    schema: {
      description: 'Initiate M-Pesa STK Push for subscription payment',
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
            message: { type: 'string' },
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
      Body: { providerId: string; phoneNumber: string };
    }>,
    reply: FastifyReply
  ) => {
    const { providerId, phoneNumber } = request.body;
    app.logger.info({ providerId, phoneNumber }, 'Initiating M-Pesa payment');

    try {
      // Verify provider exists
      const provider = await app.db
        .select()
        .from(schema.serviceProviders)
        .where(eq(schema.serviceProviders.id, providerId));

      if (provider.length === 0) {
        app.logger.warn({ providerId }, 'Provider not found');
        return reply.status(400).send({ error: 'Provider not found' });
      }

      // Format and validate phone number: must be exactly 12 digits starting with 254
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (!formattedPhone.startsWith('254')) {
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '254' + formattedPhone.substring(1);
        } else {
          formattedPhone = '254' + formattedPhone;
        }
      }

      // Validate phone number format: exactly 12 digits, starts with 254
      if (!/^254\d{9}$/.test(formattedPhone)) {
        app.logger.warn({ phoneNumber, formattedPhone }, 'Invalid phone number format');
        return reply.status(400).send({ error: 'Invalid phone number. Must be in format 254XXXXXXXXX' });
      }

      // Get M-Pesa access token
      let accessToken: string;
      try {
        accessToken = await getMpesaAccessToken();
      } catch (tokenError: any) {
        app.logger.error({ err: tokenError, providerId }, 'Failed to get M-Pesa access token');
        return reply.status(500).send({ error: 'Failed to authenticate with M-Pesa' });
      }

      const merchantRequestId = `MR-${Date.now()}-${providerId}`;
      const callbackUrl = process.env.MPESA_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/mpesa/callback`;

      // Build C2B Simulate request
      const c2bPayload = {
        ShortCode: SHORTCODE,
        CommandID: 'CustomerPayBillOnline',
        Amount: SUBSCRIPTION_AMOUNT.toString(),
        Msisdn: formattedPhone,
        BillRefNumber: `Collarless-${providerId}`,
      };

      app.logger.info(
        {
          shortCode: SHORTCODE,
          amount: SUBSCRIPTION_AMOUNT,
          msisdn: formattedPhone,
          commandId: 'CustomerPayBillOnline',
          billRefNumber: `Collarless-${providerId}`,
        },
        'M-Pesa C2B request prepared'
      );

      app.logger.debug(
        { payload: c2bPayload },
        'C2B full payload (for debugging)'
      );

      // Initiate C2B Simulate
      let c2bResponse;
      try {
        app.logger.info(
          {
            url: C2B_SIMULATE_URL,
            payloadKeys: Object.keys(c2bPayload),
            amount: c2bPayload.Amount,
          },
          'Sending C2B Simulate request to M-Pesa'
        );

        c2bResponse = await axios.post(C2B_SIMULATE_URL, c2bPayload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        app.logger.info(
          {
            status: c2bResponse.status,
            responseCode: c2bResponse.data?.ResponseCode,
            responseDescription: c2bResponse.data?.ResponseDescription,
            transactionId: c2bResponse.data?.TransactionID,
          },
          'M-Pesa C2B response received'
        );
      } catch (c2bError: any) {
        const errorStatus = c2bError.response?.status;
        const errorData = c2bError.response?.data;
        const errorMessage = errorData?.errorMessage || errorData?.message || errorData?.ResponseDescription || c2bError.message;

        app.logger.error(
          {
            err: c2bError,
            providerId,
            phoneNumber: formattedPhone,
            httpStatus: errorStatus,
            mpesaErrorCode: errorData?.requestId,
            mpesaErrorMessage: errorMessage,
            mpesaFullError: errorData,
            requestPayload: {
              ShortCode: c2bPayload.ShortCode,
              CommandID: c2bPayload.CommandID,
              Amount: c2bPayload.Amount,
              Msisdn: c2bPayload.Msisdn,
              BillRefNumber: c2bPayload.BillRefNumber,
            },
          },
          'M-Pesa C2B API request failed'
        );

        const errorDetail = errorMessage || JSON.stringify(errorData) || 'Unknown error';
        return reply.status(errorStatus || 400).send({
          error: `M-Pesa API Error: ${errorDetail}`,
          details: {
            requestId: errorData?.requestId,
            errorCode: errorData?.errorCode,
          },
        });
      }

      const transactionId = c2bResponse.data.TransactionID;

      if (!transactionId) {
        app.logger.error(
          { responseData: c2bResponse.data },
          'M-Pesa response missing TransactionID'
        );
        return reply.status(500).send({ error: 'Invalid response from M-Pesa: missing TransactionID' });
      }

      // Store transaction record
      await app.db.insert(schema.mpesaTransactions).values({
        providerId,
        merchantRequestId,
        checkoutRequestId: transactionId,
        phoneNumber: formattedPhone,
        amount: SUBSCRIPTION_AMOUNT,
        status: 'pending',
      });

      app.logger.info(
        { providerId, transactionId, phoneNumber: formattedPhone, amount: SUBSCRIPTION_AMOUNT },
        'C2B payment initiated successfully'
      );

      return {
        checkoutRequestId: transactionId,
        message: 'Payment request sent. Please complete the M-Pesa transaction on your phone.',
      };
    } catch (error: any) {
      app.logger.error(
        { err: error, providerId, errorMessage: error.message },
        'Unexpected error during M-Pesa payment initiation'
      );
      return reply.status(500).send({ error: 'Failed to initiate payment. Please try again.' });
    }
  });

  // POST /api/mpesa/callback
  fastify.post('/api/mpesa/callback', {
    schema: {
      description: 'M-Pesa payment callback',
      tags: ['mpesa'],
      body: {
        type: 'object',
      },
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
      const callbackData = body.Body?.stkCallback;

      if (!callbackData) {
        app.logger.warn({}, 'Invalid callback structure');
        return reply.status(200).send({
          ResultCode: 1,
          ResultDesc: 'Invalid callback',
        });
      }

      const {
        CheckoutRequestID,
        ResultCode,
        ResultDesc,
        CallbackMetadata,
      } = callbackData;

      // Find transaction
      const transaction = await app.db
        .select()
        .from(schema.mpesaTransactions)
        .where(eq(schema.mpesaTransactions.checkoutRequestId, CheckoutRequestID));

      if (transaction.length === 0) {
        app.logger.warn({ checkoutRequestId: CheckoutRequestID }, 'Transaction not found');
        return reply.status(200).send({
          ResultCode: 1,
          ResultDesc: 'Transaction not found',
        });
      }

      const txn = transaction[0];

      // Handle successful payment
      if (ResultCode === 0) {
        const mpesaReceiptNumber = CallbackMetadata?.Item?.find(
          (item: any) => item.Name === 'MpesaReceiptNumber'
        )?.Value;

        // Update transaction
        await app.db
          .update(schema.mpesaTransactions)
          .set({
            status: 'completed',
            mpesaReceiptNumber,
            resultDesc: ResultDesc,
          })
          .where(eq(schema.mpesaTransactions.id, txn.id));

        // Update provider subscription
        const subscriptionExpiresAt = new Date();
        subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 30);

        await app.db
          .update(schema.serviceProviders)
          .set({
            subscriptionStatus: 'active',
            subscriptionExpiresAt,
          })
          .where(eq(schema.serviceProviders.id, txn.providerId));

        app.logger.info(
          { providerId: txn.providerId, mpesaReceiptNumber, expiresAt: subscriptionExpiresAt },
          'Subscription activated successfully'
        );
      } else {
        // Payment failed
        await app.db
          .update(schema.mpesaTransactions)
          .set({
            status: 'failed',
            resultDesc: ResultDesc,
          })
          .where(eq(schema.mpesaTransactions.id, txn.id));

        app.logger.warn(
          { providerId: txn.providerId, resultCode: ResultCode, resultDesc: ResultDesc },
          'Payment failed'
        );
      }

      // Return success to M-Pesa
      return reply.status(200).send({
        ResultCode: 0,
        ResultDesc: 'Callback processed successfully',
      });
    } catch (error) {
      app.logger.error({ err: error }, 'Error processing M-Pesa callback');
      return reply.status(200).send({
        ResultCode: 1,
        ResultDesc: 'Error processing callback',
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
            id: { type: 'string' },
            checkoutRequestId: { type: 'string' },
            status: { type: 'string' },
            mpesaReceiptNumber: { type: 'string' },
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
    app.logger.info({ checkoutRequestId }, 'Fetching M-Pesa transaction status');

    try {
      const transaction = await app.db
        .select()
        .from(schema.mpesaTransactions)
        .where(eq(schema.mpesaTransactions.checkoutRequestId, checkoutRequestId));

      if (transaction.length === 0) {
        app.logger.warn({ checkoutRequestId }, 'Transaction not found');
        return reply.status(404).send({ error: 'Transaction not found' });
      }

      const txn = transaction[0];
      app.logger.info({ checkoutRequestId, status: txn.status }, 'Transaction status retrieved');

      return {
        id: txn.id,
        checkoutRequestId: txn.checkoutRequestId,
        status: txn.status,
        mpesaReceiptNumber: txn.mpesaReceiptNumber || null,
        resultDesc: txn.resultDesc || null,
      };
    } catch (error) {
      app.logger.error({ err: error, checkoutRequestId }, 'Failed to fetch transaction status');
      throw error;
    }
  });
}
