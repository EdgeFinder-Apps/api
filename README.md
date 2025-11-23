# EdgeFinder API

REST API for discovering arbitrage opportunities between Polymarket and Kalshi prediction markets with x402 payment integration.

## Quick Start

### Prerequisites

- Node.js
- pnpm
- x402 payment facilitator credentials

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Health Check

**GET** `/health`

Check API server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Get Arbitrage Opportunities

**GET** `/opportunities`

Fetch current arbitrage opportunities between Polymarket and Kalshi. Returns top 50 opportunities ordered by spread (highest first).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "unique-event-id",
      "title": "Will X happen by Y date?",
      "category": "Politics",
      "endDateISO": "2025-12-31T23:59:59Z",
      "polymarket": {
        "marketId": "poly-market-id",
        "yesPrice": 0.55,
        "noPrice": 0.45,
        "url": "https://polymarket.com/market/...",
        "liquidityUSD": 50000
      },
      "kalshi": {
        "ticker": "KXEVENT-25",
        "yesPrice": 0.60,
        "noPrice": 0.40,
        "url": "https://kalshi.com/markets/...",
        "liquidityUSD": 30000
      },
      "spreadPercent": 5.2,
      "hint": "BUY_YES_PM_BUY_NO_KALSHI"
    }
  ],
  "meta": {
    "timestamp": "2025-11-15T10:30:00.000Z",
    "requestId": "req-123"
  }
}
```

## x402 Payment Flow

### Start Payment

**POST** `/payment/start`

Initiate the x402 payment flow to unlock data access.

**Request Body:**
```json
{
  "walletAddress": "0x0000000000000000000000000000000000000000"
}
```

**Query Parameters (Development Only):**
- `dev_bypass`: Secret key to bypass real payments in development

**Response:**
```json
{
  "success": true,
  "data": {
    "network": "arbitrum",
    "token": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "recipient": "0x...",
    "amount": "1004500",
    "nonce": "0x...",
    "deadline": 1763218800
  },
  "meta": {
    "timestamp": "2025-11-15T10:30:00.000Z",
    "requestId": "req-124"
  }
}
```

### Settle Payment

**POST** `/payment/settle`

Complete the payment and receive dataset access.

**Request Body:**
```json
{
  "walletAddress": "0x0000000000000000000000000000000000000000",
  "requirements": {
    "network": "arbitrum",
    "token": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "recipient": "0x...",
    "amount": "1004500",
    "nonce": "0x...",
    "deadline": 1763218800
  },
  "permit": {
    "owner": "0x0000000000000000000000000000000000000000",
    "spender": "0x...",
    "value": "1004500",
    "deadline": 1763218800,
    "nonce": "0x...",
    "sig": "0x..."
  },
  "dev_bypass": "optional-dev-secret"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dataset": {
      "items": [...],
      "next_available_at": "2025-11-15T11:30:00.000Z"
    },
    "entitlement": {
      "id": "ent-123",
      "tx_hash": "0x...",
      "valid_until": "2025-11-15T11:30:00.000Z",
      "created_at": "2025-11-15T10:30:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2025-11-15T10:30:00.000Z",
    "requestId": "req-125"
  }
}
```

### Check Payment Status

**GET** `/payment/status?walletAddress=0x...`

Check current payment status and entitlement for a wallet address.

**Query Parameters:**
- `walletAddress` (required): wallet address

**Response:**
```json
{
  "success": true,
  "data": {
    "dataset": {
      "items": [...],
      "next_available_at": "2025-11-15T11:30:00.000Z"
    },
    "entitlement": {
      "id": "ent-123",
      "tx_hash": "0x...",
      "valid_until": "2025-11-15T11:30:00.000Z",
      "created_at": "2025-11-15T10:30:00.000Z",
      "is_valid": true
    },
    "now": "2025-11-15T10:35:00.000Z",
    "valid_until": "2025-11-15T11:30:00.000Z"
  },
  "meta": {
    "timestamp": "2025-11-15T10:35:00.000Z"
  }
}
```

## Error Responses

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details (optional)"
  },
  "meta": {
    "timestamp": "2025-11-15T10:30:00.000Z",
    "requestId": "req-126"
  }
}
```

### Error Codes

- `INVALID_REQUEST` - Malformed request data
- `INVALID_WALLET` - Invalid wallet address format
- `INVALID_SIGNATURE` - Invalid permit signature
- `PAYMENT_REQUIRED` - Payment needed for access
- `PAYMENT_FAILED` - Payment processing failed
- `ENTITLEMENT_EXPIRED` - Access has expired
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `NO_DATA_AVAILABLE` - No data in database
- `INTERNAL_ERROR` - Server error

## Configuration

### Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

Optional:
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Environment mode (development/production)

Payment (Production):
- `FACILITATOR_API_URL` - x402 facilitator API endpoint
- `FACILITATOR_API_KEY` - Facilitator authentication key
- `MERCHANT_ADDRESS` - Your merchant wallet address

Development:
- `DEV_BYPASS_SECRET` - Secret to bypass payments in dev mode

## Development

### Running Locally

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run development server with hot reload
pnpm dev
```

### Development Bypass

For testing without real payments, use the dev bypass:

1. Set `DEV_BYPASS_SECRET` in your `.env`
2. Include `?dev_bypass=your-secret` in payment start requests
3. Include `dev_bypass: "your-secret"` in settle request body

### Building

```bash
# Compile TypeScript
pnpm build

# Output will be in ./dist directory
```

### Testing

```bash
# Run tests
pnpm test
```

## Production Deployment

### Prerequisites

1. Set up Supabase database with required tables
2. Configure x402 payment facilitator
3. Set all required environment variables
4. Build the application

### Deployment Steps

```bash
# Install production dependencies
pnpm install --production

# Build application
pnpm build

# Start server
pnpm start
```

## Architecture

```
api/
├── src/
│   ├── config.ts           # Configuration management
│   ├── types.ts            # TypeScript type definitions
│   ├── index.ts            # Server entry point
│   ├── routes/
│   │   ├── opportunities.ts # Arbitrage data routes
│   │   └── payment.ts       # x402 payment routes
│   ├── services/
│   │   ├── supabase.ts      # Database operations
│   │   └── payment.ts       # Payment facilitator
│   └── utils/
│       ├── response.ts      # Response helpers
│       └── validation.ts    # Input validation
└── package.json
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

This API is for informational purposes only. Always do your own research before making any trades. Prediction markets involve risk.
