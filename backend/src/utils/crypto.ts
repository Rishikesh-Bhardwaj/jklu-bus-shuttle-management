import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'jklu_bus_shuttle_super_secure_jwt_secret_dev_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const CSRF_SECRET = process.env.CSRF_SECRET || 'jklu_bus_shuttle_csrf_signing_secret_dev_2026';

export interface TokenPayload {
  userId: number;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'MANAGER';
  tokenVersion: number;
}

/**
 * Hashes a plaintext password using bcrypt with 12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compares a candidate password against an existing bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates an encrypted/signed JSON Web Token for authenticated sessions.
 */
export function signJwtToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verifies a JWT and extracts the payload.
 */
export function verifyJwtToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically random, HMAC-signed CSRF token.
 * Format: `<randomHex>.<hmacSignature>`
 */
export function generateCsrfToken(): string {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const signature = crypto.createHmac('sha256', CSRF_SECRET).update(randomBytes).digest('hex');
  return `${randomBytes}.${signature}`;
}

/**
 * Verifies the integrity of a signed CSRF token using constant-time comparison.
 */
export function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [randomBytes, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', CSRF_SECRET).update(randomBytes).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Parses a standard HTTP Cookie header into key-value pairs without external dependencies.
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    const trimmedName = name?.trim();
    if (!trimmedName) return;
    const value = rest.join('=').trim();
    list[trimmedName] = decodeURIComponent(value);
  });

  return list;
}

