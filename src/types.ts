// Core type definitions for EdgeFinder API

export interface MatchedEvent {
  id: string;
  title: string;
  category: string;
  endDateISO: string;
  polymarket: {
    marketId: string;
    yesPrice: number; // 0..1
    noPrice: number; // 0..1
    url: string;
    liquidityUSD: number;
  };
  kalshi: {
    ticker: string;
    yesPrice: number; // 0..1
    noPrice: number; // 0..1
    url: string;
    liquidityUSD: number;
  };
  spreadPercent: number;
  hint: 'BUY_YES_PM_BUY_NO_KALSHI' | 'BUY_YES_KALSHI_BUY_NO_PM' | 'NONE';
  isStale?: boolean;
  lastRefreshed?: string;
}

export interface UserDataset {
  fetchedAtISO: string;
  nextAvailableAtISO: string;
  items: MatchedEvent[];
}

// x402 Payment Types
export interface PaymentRequirements {
  network: string;
  token: string;
  recipient: string;
  amount: string;
  nonce: string;
  deadline: number;
}

export interface Permit {
  owner: string;
  spender: string;
  value: string;
  deadline: number;
  nonce: string;
  sig: string;
}

export interface Dataset {
  id: string;
  wallet_address: string;
  items: MatchedEvent[];
  created_at: string;
  next_available_at: string;
}

export interface Entitlement {
  id: string;
  wallet_address: string;
  shared_dataset_id?: string;
  dataset_id?: string;
  tx_hash: string;
  facilitator_response?: any;
  valid_until: string;
  created_at: string;
}

export interface PaymentStatus {
  dataset: {
    items: MatchedEvent[];
    next_available_at: string;
  } | null;
  entitlement: {
    id: string;
    tx_hash: string;
    valid_until: string;
    created_at: string;
    is_valid: boolean;
  } | null;
  now: string;
  valid_until: string | null;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  meta: {
    timestamp: string;
  };
}

// Supabase Database Types
export interface ArbitrageOpportunity {
  polymarket_question: string;
  kalshi_title: string;
  similarity_score: number;
  poly_price_cents: string;
  kalshi_price_cents: string;
  price_diff_cents: string;
  direction_aligned: boolean;
  direction_confidence: number;
  direction_notes: string;
  poly_slug: string;
  kalshi_ticker: string;
  poly_end_date: string | null;
  kalshi_expiration_time: string;
}

export interface SharedDataset {
  id: string;
  items: MatchedEvent[];
  created_at: string;
  expires_at: string;
}

// API Request Types
export interface StartPaymentRequest {
  walletAddress: string;
}

export interface SettlePaymentRequest {
  walletAddress: string;
  requirements: PaymentRequirements;
  permit: Permit;
  dev_bypass?: string;
}
