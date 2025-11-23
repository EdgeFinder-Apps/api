import { config } from 'dotenv';

config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',

  // x402 Payment
  FACILITATOR_API_URL: process.env.FACILITATOR_API_URL || '',
  FACILITATOR_API_KEY: process.env.FACILITATOR_API_KEY || '',
  MERCHANT_ADDRESS: process.env.MERCHANT_ADDRESS || '',

  // Development
  DEV_BYPASS_SECRET: process.env.DEV_BYPASS_SECRET || '',

  // API Settings
  RATE_LIMIT: {
    max: 100,
    timeWindow: '15 minutes',
  },
  
  // Payment Settings
  PAYMENT: {
    AMOUNT_USDC: '1000000', 
    ENTITLEMENT_DURATION_HOURS: 1,
    NETWORK: 'arbitrum',
    USDC_ADDRESS: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
  },
} as const;

export function validateConfig(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter(key => !CONFIG[key as keyof typeof CONFIG]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about payment config in production
  if (CONFIG.NODE_ENV === 'production') {
    const paymentRequired = [
      'FACILITATOR_API_URL',
      'FACILITATOR_API_KEY',
      'MERCHANT_ADDRESS',
    ];

    const missingPayment = paymentRequired.filter(
      key => !CONFIG[key as keyof typeof CONFIG]
    );

    if (missingPayment.length > 0) {
      console.warn(
        `Warning: Missing payment configuration: ${missingPayment.join(', ')}`
      );
    }
  }
}
