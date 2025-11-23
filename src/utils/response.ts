import type { FastifyReply } from 'fastify';
import type { APIResponse, PaginatedResponse } from '../types.js';

export function successResponse<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200
): FastifyReply {
  const response: APIResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: reply.request.id,
    },
  };

  return reply.code(statusCode).send(response);
}

export function paginatedResponse<T>(
  reply: FastifyReply,
  data: T[],
  page: number,
  limit: number,
  total: number
): FastifyReply {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  return reply.code(200).send(response);
}

export function errorResponse(
  reply: FastifyReply,
  code: string,
  message: string,
  statusCode = 400,
  details?: any
): FastifyReply {
  const response: APIResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: reply.request.id,
    },
  };

  return reply.code(statusCode).send(response);
}

// Common error responses
export const ErrorCodes = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_WALLET: 'INVALID_WALLET',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  ENTITLEMENT_EXPIRED: 'ENTITLEMENT_EXPIRED',
  NO_DATA_AVAILABLE: 'NO_DATA_AVAILABLE',
} as const;
