import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CONFIG, validateConfig } from './config.js';
import { opportunitiesRoutes } from './routes/opportunities.js';
import { paymentRoutes } from './routes/payment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// validate configuration on startup
try {
  validateConfig();
} catch (error: any) {
  console.error('Configuration error:', error.message);
  process.exit(1);
}

// Fastify with logging
const fastify = Fastify({
  logger: {
    level: CONFIG.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      CONFIG.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              colorize: true,
            },
          }
        : undefined,
  },
  requestIdLogLabel: 'reqId',
  requestIdHeader: 'x-request-id',
  disableRequestLogging: false,
  trustProxy: true,
});

// Register CORS
await fastify.register(cors, {
  origin: CONFIG.NODE_ENV === 'production' 
    ? ['https://edgefinder-4f0e.onrender.com'] 
    : true,
  credentials: true,
});

// Register rate limiting
await fastify.register(rateLimit, {
  max: CONFIG.RATE_LIMIT.max,
  timeWindow: CONFIG.RATE_LIMIT.timeWindow,
  errorResponseBuilder: function (request, context) {
    return {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Try again in ${context.after}`,
      },
    };
  },
});

// Health check endpoint
fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Root endpoint
fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.send({
    name: 'EdgeFinder API',
    version: '1.0.0',
    description: 'REST API for prediction markets arbitrage with x402 payment integration',
    endpoints: {
      opportunities: '/opportunities',
      payment: {
        start: '/payment/start',
        settle: '/payment/settle',
        status: '/payment/status'
      },
      health: '/health',
      llms: '/llms.txt'
    }
  });
});

// LLMs.txt endpoint
fastify.get('/llms.txt', async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    const llmsPath = join(__dirname, '..', 'llms.txt');
    const content = readFileSync(llmsPath, 'utf-8');
    return reply
      .header('Content-Type', 'text/plain; charset=utf-8')
      .send(content);
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(404).send('llms.txt not found');
  }
});

// Register route modules
await fastify.register(opportunitiesRoutes, { prefix: '' });
await fastify.register(paymentRoutes, { prefix: '' });

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  // Handle Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation,
      },
    });
  }

  // Handle rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: error.message,
      },
    });
  }

  // Generic error response
  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: CONFIG.NODE_ENV === 'production' 
        ? 'An internal error occurred' 
        : error.message,
    },
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: CONFIG.PORT,
      host: CONFIG.HOST,
    });

    fastify.log.info(
      `EdgeFinder API server listening on ${CONFIG.HOST}:${CONFIG.PORT}`
    );
    fastify.log.info(`Environment: ${CONFIG.NODE_ENV}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server...`);
    await fastify.close();
    process.exit(0);
  });
});

start();
