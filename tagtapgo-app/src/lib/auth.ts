/**
 * Authentication Utilities
 * JWKS-based JWT verification for Supabase authentication
 */

import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

// Create JWKS instance for Supabase
// This fetches the public keys from Supabase's JWKS endpoint
const JWKS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

/**
 * Verify JWT token using Supabase JWKS endpoint
 * Uses ES256 algorithm (ECDSA SHA-256) as required by Supabase
 * 
 * @param token - JWT token to verify
 * @returns Decoded JWT payload
 * @throws Error if token is invalid or expired
 */
export async function verifyJwt(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['ES256'], // Supabase uses ECDSA SHA-256
    });
    
    return payload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Extract JWT token from request headers or cookies
 * Checks Authorization header first, then falls back to cookies
 * 
 * @param req - Request object
 * @returns JWT token or null if not found
 */
export function getTokenFromRequest(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookies
  const cookies = req.headers.get('cookie');
  if (cookies) {
    const tokenMatch = cookies.match(/sb-access-token=([^;]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
  }
  
  return null;
}

/**
 * Check if user is authenticated by verifying their JWT token
 * 
 * @param req - Request object
 * @returns Object with authentication status and user payload
 */
export async function isAuthenticated(req: Request): Promise<{
  authenticated: boolean;
  user: JWTPayload | null;
}> {
  try {
    const token = getTokenFromRequest(req);
    
    if (!token) {
      return { authenticated: false, user: null };
    }
    
    const payload = await verifyJwt(token);
    
    return { authenticated: true, user: payload };
  } catch {
    return { authenticated: false, user: null };
  }
}

/**
 * Get user ID from JWT token
 * 
 * @param req - Request object
 * @returns User ID or null if not authenticated
 */
export async function getUserId(req: Request): Promise<string | null> {
  const { authenticated, user } = await isAuthenticated(req);
  
  if (!authenticated || !user) {
    return null;
  }
  
  return user.sub || null;
}
