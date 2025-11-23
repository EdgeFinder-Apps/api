import { CONFIG } from '../config.js';
import type { PaymentRequirements, Permit } from '../types.js';

function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function createDevBypassResponse(): PaymentRequirements {
  const nonce = generateNonce();
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  return {
    network: 'arbitrum',
    token: CONFIG.PAYMENT.USDC_ADDRESS,
    recipient: '0x0000000000000000000000000000000000000000',
    amount: CONFIG.PAYMENT.AMOUNT_USDC,
    nonce,
    deadline,
  };
}

export async function startPayment(
  walletAddress: string,
  devBypass?: string
): Promise<PaymentRequirements> {
  // Check for dev bypass
  if (
    CONFIG.NODE_ENV !== 'production' &&
    devBypass &&
    devBypass === CONFIG.DEV_BYPASS_SECRET
  ) {
    console.log('Using dev bypass mode');
    return createDevBypassResponse();
  }

  // Validate facilitator configuration
  if (!CONFIG.FACILITATOR_API_URL || !CONFIG.MERCHANT_ADDRESS) {
    throw new Error('Facilitator configuration not available');
  }

  // Calculate total amount including facilitator fees
  const merchantAmount = 900000n;
  const serviceFee = (merchantAmount * 50n) / 10000n;
  const gasFee = 100000n;
  const totalAmount = merchantAmount + serviceFee + gasFee;

  const facilitatorRequest = {
    amount: totalAmount.toString(),
    memo: 'EdgeFinder scan',
    network: 'arbitrum',
    token: 'USDC',
    extra: {
      merchantAddress: CONFIG.MERCHANT_ADDRESS,
    },
  };

  const response = await fetch(`${CONFIG.FACILITATOR_API_URL}/requirements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(facilitatorRequest),
  });

  if (!response.ok && response.status !== 402) {
    const errorText = await response.text();
    throw new Error(`Facilitator error: ${errorText}`);
  }

  const facilitatorData = await response.json();

  if (!facilitatorData.accepts || facilitatorData.accepts.length === 0) {
    throw new Error('Invalid response from payment facilitator');
  }

  const acceptsItem = facilitatorData.accepts[0];
  if (acceptsItem.network !== 'arbitrum') {
    throw new Error('Only Arbitrum network is supported');
  }

  return {
    network: acceptsItem.network,
    token: acceptsItem.asset,
    recipient: acceptsItem.payTo,
    amount: acceptsItem.maxAmountRequired,
    nonce: acceptsItem.extra?.nonce || '',
    deadline: acceptsItem.extra?.deadline || Date.now() + 3600000,
  };
}

export async function settlePayment(
  requirements: PaymentRequirements,
  permit: Permit,
  devBypass?: string
): Promise<{ success: boolean; txHash: string; facilitatorResponse?: any }> {
  // Check for dev bypass
  if (
    CONFIG.NODE_ENV !== 'production' &&
    devBypass &&
    devBypass === CONFIG.DEV_BYPASS_SECRET
  ) {
    console.log('Using dev bypass mode for settlement');
    return {
      success: true,
      txHash: 'dev-bypass',
      facilitatorResponse: null,
    };
  }

  // Validate facilitator configuration
  if (!CONFIG.FACILITATOR_API_URL || !CONFIG.FACILITATOR_API_KEY) {
    throw new Error('Facilitator configuration not available');
  }

  // Parse signature components
  const signature = permit.sig;
  const r = signature.slice(0, 66);
  const s = '0x' + signature.slice(66, 130);
  const v = parseInt(signature.slice(130, 132), 16);

  const facilitatorRequest = {
    network: requirements.network,
    token: requirements.token,
    recipient: requirements.recipient,
    amount: requirements.amount,
    nonce: permit.nonce,
    deadline: requirements.deadline,
    extra: {
      merchantAddress: CONFIG.MERCHANT_ADDRESS,
    },
    permit: {
      owner: permit.owner,
      spender: permit.spender,
      value: permit.value,
      deadline: permit.deadline,
      nonce: permit.nonce,
      sig: permit.sig,
    },
    paymentPayload: {
      scheme: 'exact',
      network: requirements.network,
      payload: {
        from: permit.owner,
        to: permit.spender,
        value: permit.value,
        validAfter: 0,
        validBefore: permit.deadline,
        nonce: permit.nonce,
        v,
        r,
        s,
      },
    },
    paymentRequirements: {
      scheme: 'exact',
      network: requirements.network,
      token: requirements.token,
      amount: requirements.amount,
      recipient: requirements.recipient,
      description: 'EdgeFinder scan',
      maxTimeoutSeconds: 3600,
    },
  };

  const maxRetries = 4;
  const baseRetryDelay = 1000;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${CONFIG.FACILITATOR_API_URL}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': CONFIG.FACILITATOR_API_KEY,
        },
        body: JSON.stringify(facilitatorRequest),
      });

      if (response.ok) {
        const data = await response.json();
        const txHash =
          data.txHash || data.transactionHash || data.meta?.incomingTxHash || 'unknown';
        return {
          success: true,
          txHash,
          facilitatorResponse: data,
        };
      }

      const errorText = await response.text();
      const statusCode = response.status;

      const isNonceError =
        errorText.includes('nonce uniqueness') || errorText.includes('checking nonce');
      const isDatabaseError =
        errorText.includes('database') || errorText.includes('Internal error');
      const isServerError = statusCode >= 500;
      const isRetryable = isServerError || isNonceError || isDatabaseError;

      if (!isRetryable || attempt === maxRetries) {
        throw new Error(`Payment settlement failed: ${errorText}`);
      }

      const retryDelay = baseRetryDelay * Math.pow(2, attempt - 1);
      console.log(`Retryable error, waiting ${retryDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } catch (error: any) {
      lastError = error;
      if (attempt === maxRetries) {
        throw new Error(`Payment settlement failed after ${maxRetries} attempts: ${error.message}`);
      }

      const retryDelay = baseRetryDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw lastError || new Error('Payment settlement failed');
}
