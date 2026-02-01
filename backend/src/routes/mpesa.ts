import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

// M-Pesa credentials (Production)
const CONSUMER_KEY = 'I3ffKPoz27FVGzQYeM5cp74HeGkVb9ctfdsxwIg1JBwz661r';
const CONSUMER_SECRET = 'Ad5sWMAoXWycUAAZmThAPTxOqyqpVdgOj4HgA9sVh5JvquHF95B3e6UiCAXO434a';
const SHORTCODE = '6803513';
const SUBSCRIPTION_AMOUNT = 130;

// M-Pesa API URLs (Production)
const AUTH_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const STK_PUSH_URL = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
const QUERY_URL = 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query';

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
  } catch (error) {
    throw new Error('Failed to get M-Pesa access token');
  }
}

// Generate timestamp
function getTimestamp(): string {
  return new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
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

      // Get M-Pesa access token
      const accessToken = await getMpesaAccessToken();

      const timestamp = getTimestamp();
      // Production passkey from Safaricom M-Pesa portal
      // TODO: Update with the production passkey provided by Safaricom
      const passkey = 'bfb279f9aa9bdbcf158e97dd1a503b6064e3ea09955a6db5d8fd72e22f5d76e8';
      const password = generatePassword(SHORTCODE, passkey, timestamp);

      // Format phone number: remove + if present and ensure it starts with country code
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (!formattedPhone.startsWith('254')) {
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '254' + formattedPhone.substring(1);
        } else {
          formattedPhone = '254' + formattedPhone;
        }
      }

      const merchantRequestId = `MR-${Date.now()}-${providerId}`;

      // Initiate STK Push
      const stkResponse = await axios.post(
        STK_PUSH_URL,
        {
          BusinessShortCode: SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: SUBSCRIPTION_AMOUNT,
          PartyA: formattedPhone,
          PartyB: SHORTCODE,
          PhoneNumber: formattedPhone,
          CallBackURL: `${process.env.CALLBACK_URL || 'http://localhost:3000'}/api/mpesa/callback`,
          AccountReference: `Collarless-${providerId}`,
          TransactionDesc: 'Collarless Monthly Subscription',
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const checkoutRequestId = stkResponse.data.CheckoutRequestID;

      // Store transaction record
      await app.db.insert(schema.mpesaTransactions).values({
        providerId,
        merchantRequestId,
        checkoutRequestId,
        phoneNumber: formattedPhone,
        amount: SUBSCRIPTION_AMOUNT,
        status: 'pending',
      });

      app.logger.info({ providerId, checkoutRequestId }, 'STK Push initiated successfully');

      return {
        checkoutRequestId,
        message: 'STK Push sent successfully. Please enter your M-Pesa PIN on your phone.',
      };
    } catch (error: any) {
      app.logger.error(
        { err: error, providerId, errorMessage: error.response?.data || error.message },
        'Failed to initiate M-Pesa payment'
      );
      throw error;
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
