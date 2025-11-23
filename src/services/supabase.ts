import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '../config.js';
import type {
  MatchedEvent,
  ArbitrageOpportunity,
  SharedDataset,
  Entitlement,
  PaymentStatus,
} from '../types.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseClient;
}

// Transform Supabase data to MatchedEvent format
function transformOpportunityToEvent(opp: ArbitrageOpportunity): MatchedEvent {
  const polyPriceCents = parseFloat(opp.poly_price_cents);
  const kalshiPriceCents = parseFloat(opp.kalshi_price_cents);
  const spreadCents = parseFloat(opp.price_diff_cents);

  const polyYesPrice = polyPriceCents / 100;
  const kalshiYesPrice = kalshiPriceCents / 100;

  let hint: 'BUY_YES_PM_BUY_NO_KALSHI' | 'BUY_YES_KALSHI_BUY_NO_PM' | 'NONE' = 'NONE';
  if (polyYesPrice < kalshiYesPrice) {
    hint = 'BUY_YES_PM_BUY_NO_KALSHI';
  } else if (kalshiYesPrice < polyYesPrice) {
    hint = 'BUY_YES_KALSHI_BUY_NO_PM';
  }

  return {
    id: `${opp.poly_slug}-${opp.kalshi_ticker}`,
    title: opp.polymarket_question,
    category: 'Politics',
    endDateISO: opp.poly_end_date || opp.kalshi_expiration_time,
    polymarket: {
      marketId: opp.poly_slug,
      yesPrice: polyYesPrice,
      noPrice: 1 - polyYesPrice,
      url: (() => {
        const slug = (opp.polymarket_question || opp.poly_slug || '')
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '');
        return `https://polymarket.com/market/${slug}`;
      })(),
      liquidityUSD: 10000,
    },
    kalshi: {
      ticker: opp.kalshi_ticker,
      yesPrice: kalshiYesPrice,
      noPrice: 1 - kalshiYesPrice,
      url: (() => {
        const t = opp.kalshi_ticker || '';
        const segments = t.split('-');
        const baseTicker = segments.length > 1 ? segments[0] : t;
        const shortSlug = baseTicker.replace(/^kx/i, '').toLowerCase();
        const finalTicker = segments.length > 1 ? `${segments[0]}-${segments[1]}` : t;
        return `https://kalshi.com/markets/${baseTicker.toLowerCase()}/${shortSlug}/${finalTicker.toLowerCase()}`;
      })(),
      liquidityUSD: 10000,
    },
    spreadPercent: spreadCents,
    hint,
  };
}

export async function fetchOpportunities(): Promise<MatchedEvent[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('verified_arbitrage_opportunities')
    .select('*')
    .order('price_diff_cents', { ascending: false })
    .limit(50);

  if (error) throw error;
  if (!data) return [];

  return data.map(transformOpportunityToEvent);
}

export async function getLatestSharedDataset(): Promise<SharedDataset> {
  const supabase = getSupabaseClient();

  // First try to get an unexpired dataset
  const { data: activeData, error: activeError } = await supabase
    .from('shared_datasets')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (activeError) {
    throw new Error(`Failed to fetch shared dataset: ${activeError.message}`);
  }

  if (activeData && activeData.length > 0) {
    return activeData[0];
  }

  // Fall back to most recent expired dataset
  const { data: expiredData, error: expiredError } = await supabase
    .from('shared_datasets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (expiredError) {
    throw new Error(`Failed to fetch shared dataset: ${expiredError.message}`);
  }

  if (!expiredData || expiredData.length === 0) {
    throw new Error('No shared dataset available. Pipeline may not have run yet.');
  }

  return expiredData[0];
}

export async function grantDatasetAccess(
  walletAddress: string,
  sharedDatasetId: string,
  txHash: string,
  facilitatorResponse?: any
): Promise<Entitlement> {
  const supabase = getSupabaseClient();

  // Get the shared dataset to determine expiration
  const { data: sharedDatasetData, error: datasetError } = await supabase
    .from('shared_datasets')
    .select('expires_at')
    .eq('id', sharedDatasetId)
    .limit(1);

  if (datasetError || !sharedDatasetData || sharedDatasetData.length === 0) {
    throw new Error('Failed to get shared dataset expiration');
  }

  const sharedDataset = sharedDatasetData[0];

  const { data: entitlement, error: entitlementError } = await supabase
    .from('entitlements')
    .insert({
      wallet_address: walletAddress,
      shared_dataset_id: sharedDatasetId,
      tx_hash: txHash,
      facilitator_response: facilitatorResponse,
      valid_until: sharedDataset.expires_at,
    })
    .select()
    .single();

  if (entitlementError) {
    throw new Error(`Failed to create entitlement: ${entitlementError.message}`);
  }

  return entitlement;
}

export async function getPaymentStatus(walletAddress: string): Promise<PaymentStatus> {
  const supabase = getSupabaseClient();

  const { data: entitlement, error: entitlementError } = await supabase
    .from('entitlements')
    .select(
      `
      *,
      shared_dataset:shared_datasets(*)
    `
    )
    .eq('wallet_address', walletAddress)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (entitlementError && entitlementError.code !== 'PGRST116') {
    throw new Error('Failed to fetch entitlement status');
  }

  if (!entitlement) {
    return {
      dataset: null,
      entitlement: null,
      now: new Date().toISOString(),
      valid_until: null,
    };
  }

  const now = new Date();
  const validUntil = new Date(entitlement.valid_until);
  const isValid = now < validUntil;

  return {
    dataset: entitlement.shared_dataset
      ? {
          items: entitlement.shared_dataset.items,
          next_available_at: entitlement.shared_dataset.expires_at,
        }
      : null,
    entitlement: {
      id: entitlement.id,
      tx_hash: entitlement.tx_hash,
      valid_until: entitlement.valid_until,
      created_at: entitlement.created_at,
      is_valid: isValid,
    },
    now: now.toISOString(),
    valid_until: entitlement.valid_until,
  };
}
