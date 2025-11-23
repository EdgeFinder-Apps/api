import { isAddress } from 'viem';

export function validateWalletAddress(address: string): boolean {
  return isAddress(address);
}

export function validatePermit(permit: any): boolean {
  if (!permit || typeof permit !== 'object') return false;

  const requiredFields = ['owner', 'spender', 'value', 'deadline', 'nonce', 'sig'];
  
  for (const field of requiredFields) {
    if (!permit[field]) return false;
  }

  // Validate addresses
  if (!validateWalletAddress(permit.owner)) return false;
  if (!validateWalletAddress(permit.spender)) return false;

  // Validate signature format (0x + 130 hex chars)
  if (!/^0x[a-fA-F0-9]{130}$/.test(permit.sig)) return false;

  // Validate nonce format (0x + 64 hex chars)
  if (!/^0x[a-fA-F0-9]{64}$/.test(permit.nonce)) return false;

  // Validate deadline is in the future
  const now = Math.floor(Date.now() / 1000);
  if (permit.deadline <= now) return false;

  return true;
}

export function validateRequirements(requirements: any): boolean {
  if (!requirements || typeof requirements !== 'object') return false;

  const requiredFields = ['network', 'token', 'recipient', 'amount', 'nonce', 'deadline'];
  
  for (const field of requiredFields) {
    if (!requirements[field]) return false;
  }

  // Validate network
  if (requirements.network !== 'arbitrum') return false;

  // Validate recipient address
  if (!validateWalletAddress(requirements.recipient)) return false;

  // Validate token address
  if (!validateWalletAddress(requirements.token)) return false;

  return true;
}
