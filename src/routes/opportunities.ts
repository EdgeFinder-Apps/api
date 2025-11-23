import type { FastifyInstance, FastifyReply } from 'fastify';
import { fetchOpportunities } from '../services/supabase.js';
import { successResponse, errorResponse, ErrorCodes } from '../utils/response.js';

export async function opportunitiesRoutes(fastify: FastifyInstance) {
  // Fetch current arbitrage opportunities
  fastify.get(
    '/opportunities',
    {
      schema: {
        description: 'Get current arbitrage opportunities (top 50 by spread)',
        tags: ['opportunities'],
        response: {
          200: {
            description: 'Successful response',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    async (_request, reply: FastifyReply) => {
      try {
        const opportunities = await fetchOpportunities();

        return successResponse(reply, opportunities);
      } catch (error: any) {
        fastify.log.error(error);
        return errorResponse(
          reply,
          ErrorCodes.INTERNAL_ERROR,
          'Failed to fetch opportunities',
          500,
          error.message
        );
      }
    }
  );
}
