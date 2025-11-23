import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { startPayment, settlePayment } from '../services/payment.js';
import {
  getLatestSharedDataset,
  grantDatasetAccess,
  getPaymentStatus,
} from '../services/supabase.js';
import { successResponse, errorResponse, ErrorCodes } from '../utils/response.js';
import {
  validateWalletAddress,
  validatePermit,
  validateRequirements,
} from '../utils/validation.js';
import type { StartPaymentRequest, SettlePaymentRequest } from '../types.js';

interface StartPaymentRequestType extends FastifyRequest {
  body: StartPaymentRequest;
  query: { dev_bypass?: string };
}

interface SettlePaymentRequestType extends FastifyRequest {
  body: SettlePaymentRequest;
}

interface GetStatusRequest extends FastifyRequest {
  query: { walletAddress: string };
}

export async function paymentRoutes(fastify: FastifyInstance) {
  // Initiate payment flow
  fastify.post(
    '/payment/start',
    {
      schema: {
        description: 'Start x402 payment flow',
        tags: ['payment'],
        body: {
          type: 'object',
          required: ['walletAddress'],
          properties: {
            walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          },
        },
        response: {
          200: {
            description: 'Payment requirements',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  network: { type: 'string' },
                  token: { type: 'string' },
                  recipient: { type: 'string' },
                  amount: { type: 'string' },
                  nonce: { type: 'string' },
                  deadline: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request: StartPaymentRequestType, reply: FastifyReply) => {
      try {
        const { walletAddress } = request.body;

        if (!validateWalletAddress(walletAddress)) {
          return errorResponse(
            reply,
            ErrorCodes.INVALID_WALLET,
            'Invalid wallet address format'
          );
        }

        const devBypass = request.query.dev_bypass;
        const requirements = await startPayment(walletAddress, devBypass);

        return successResponse(reply, requirements);
      } catch (error: any) {
        fastify.log.error(error);
        return errorResponse(
          reply,
          ErrorCodes.PAYMENT_FAILED,
          'Failed to start payment flow',
          400,
          error.message
        );
      }
    }
  );

  // Complete payment and get dataset
  fastify.post(
    '/payment/settle',
    {
      schema: {
        description: 'Settle x402 payment and receive dataset access',
        tags: ['payment'],
        body: {
          type: 'object',
          required: ['walletAddress', 'requirements', 'permit'],
          properties: {
            walletAddress: { type: 'string' },
            requirements: { type: 'object' },
            permit: { type: 'object' },
            dev_bypass: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Settlement successful',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  dataset: { type: 'object' },
                  entitlement: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    async (request: SettlePaymentRequestType, reply: FastifyReply) => {
      try {
        const { walletAddress, requirements, permit, dev_bypass } = request.body;

        // Validate inputs
        if (!validateWalletAddress(walletAddress)) {
          return errorResponse(
            reply,
            ErrorCodes.INVALID_WALLET,
            'Invalid wallet address format'
          );
        }

        if (!validateRequirements(requirements)) {
          return errorResponse(
            reply,
            ErrorCodes.INVALID_REQUEST,
            'Invalid payment requirements'
          );
        }

        if (!validatePermit(permit)) {
          return errorResponse(
            reply,
            ErrorCodes.INVALID_SIGNATURE,
            'Invalid permit signature'
          );
        }

        // Settle payment with facilitator
        const settlementResult = await settlePayment(requirements, permit, dev_bypass);

        if (!settlementResult.success) {
          return errorResponse(
            reply,
            ErrorCodes.PAYMENT_FAILED,
            'Payment settlement failed'
          );
        }

        // Grant access to shared dataset
        const sharedDataset = await getLatestSharedDataset();
        const entitlement = await grantDatasetAccess(
          walletAddress,
          sharedDataset.id,
          settlementResult.txHash,
          settlementResult.facilitatorResponse
        );

        return successResponse(reply, {
          dataset: {
            items: sharedDataset.items,
            next_available_at: sharedDataset.expires_at,
          },
          entitlement: {
            id: entitlement.id,
            tx_hash: entitlement.tx_hash,
            valid_until: entitlement.valid_until,
            created_at: entitlement.created_at,
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return errorResponse(
          reply,
          ErrorCodes.PAYMENT_FAILED,
          'Failed to settle payment',
          400,
          error.message
        );
      }
    }
  );

  // Check payment and entitlement status
  fastify.get(
    '/payment/status',
    {
      schema: {
        description: 'Get payment status and entitlement for a wallet',
        tags: ['payment'],
        querystring: {
          type: 'object',
          required: ['walletAddress'],
          properties: {
            walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          },
        },
        response: {
          200: {
            description: 'Payment status',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: GetStatusRequest, reply: FastifyReply) => {
      try {
        const { walletAddress } = request.query;

        if (!validateWalletAddress(walletAddress)) {
          return errorResponse(
            reply,
            ErrorCodes.INVALID_WALLET,
            'Invalid wallet address format'
          );
        }

        const status = await getPaymentStatus(walletAddress);

        return successResponse(reply, status);
      } catch (error: any) {
        fastify.log.error(error);
        return errorResponse(
          reply,
          ErrorCodes.INTERNAL_ERROR,
          'Failed to fetch payment status',
          500,
          error.message
        );
      }
    }
  );
}
