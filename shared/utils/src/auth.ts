/**
 * JWT Authentication Utilities
 * Compatible with existing LearningAI365 JWT tokens
 */

import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: number;
  iat: number;
  exp: number;
}

/**
 * Verify JWT token and extract user ID
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string, secret: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value
 * @returns Token string without "Bearer " prefix
 */
export function extractBearerToken(authHeader?: string): string {
  if (!authHeader) {
    throw new Error('Authorization header missing');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header format');
  }

  return authHeader.substring(7);
}

/**
 * Verify authorization header and return user ID
 */
export function verifyAuthHeader(authHeader: string | undefined, secret: string): number {
  const token = extractBearerToken(authHeader);
  const payload = verifyToken(token, secret);
  return payload.id;
}
