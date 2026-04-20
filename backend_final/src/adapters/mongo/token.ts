import { randomBytes } from 'crypto';

// Generate access token (32 bytes -> ~43 chars base64url)
export function generateAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

// Generate refresh token (48 bytes -> ~64 chars base64url)
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}
