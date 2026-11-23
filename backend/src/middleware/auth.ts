import { Request, Response, NextFunction } from 'express';
import { parseCookies, verifyJwtToken, verifyCsrfToken } from '../utils/crypto.js';
import { pool } from '../config/db.js';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'FACULTY' | 'MANAGER';
  studentCategory: 'HOSTELLER' | 'DAY_SCHOLAR' | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  tokenVersion: number;
}

// Extend Express Request declaration
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authentication Middleware:
 * - Extracts JWT from HTTP-only cookie `jklu_shuttle_token`.
 * - Validates JWT signature.
 * - Performs fresh database validation:
 *   1. User exists in database.
 *   2. Immediate suspension enforcement (`account_status === 'ACTIVE'`).
 *   3. Global session revocation check (`token_version === payload.tokenVersion`).
 * - Attaches fresh, validated user record to `req.user`.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['jklu_shuttle_token'];

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const payload = verifyJwtToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
    return;
  }

  try {
    const [rows]: any = await pool.query(
      `SELECT user_id, email, full_name, role, student_category, 
              COALESCE(verification_status, 'PENDING') AS verification_status, 
              COALESCE(token_version, 1) AS token_version, 
              account_status 
       FROM users 
       WHERE user_id = ?`,
      [payload.userId]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Account does not exist.' });
      return;
    }

    const userRecord = rows[0];

    // 1. Immediate Suspension Enforcement
    if (userRecord.account_status !== 'ACTIVE') {
      res.status(403).json({ error: 'Account is suspended. Access denied. Please contact transport management.' });
      return;
    }

    // 2. Global Session Invalidation / Token Version Mismatch
    if (userRecord.token_version !== payload.tokenVersion) {
      res.status(401).json({ error: 'Session has been revoked or signed out from another device. Please sign in again.' });
      return;
    }

    req.user = {
      userId: userRecord.user_id,
      email: userRecord.email,
      fullName: userRecord.full_name,
      role: userRecord.role,
      studentCategory: userRecord.student_category,
      verificationStatus: userRecord.verification_status,
      accountStatus: userRecord.account_status,
      tokenVersion: userRecord.token_version,
    };

    next();
  } catch (error: any) {
    res.status(500).json({ error: 'Authentication error: ' + error.message });
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware:
 * Validates that authenticated user has one of the authorized roles.
 */
export function requireRole(...allowedRoles: Array<'STUDENT' | 'FACULTY' | 'MANAGER'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Authorized roles: ${allowedRoles.join(', ')}. Your role is ${req.user.role}.`,
      });
      return;
    }

    next();
  };
}

/**
 * Affiliation Verification Enforcement Middleware:
 * Ensures student or faculty account has been approved by transport management before booking trips.
 */
export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  // Managers do not require student/faculty verification
  if (req.user.role === 'MANAGER') {
    next();
    return;
  }

  if (req.user.verificationStatus !== 'VERIFIED') {
    res.status(403).json({
      error: `Affiliation verification required. Current status: ${req.user.verificationStatus}. Please wait for manager approval or reapply.`,
      verificationStatus: req.user.verificationStatus,
    });
    return;
  }

  next();
}

/**
 * Cryptographically Signed CSRF Protection Middleware:
 * - Protects state-changing methods: POST, PUT, PATCH, DELETE.
 * - Compares request header `X-CSRF-Token` against signed cookie `jklu_csrf_token`.
 * - Uses constant-time signature verification.
 */
export function validateCsrf(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieCsrfToken = cookies['jklu_csrf_token'];
  const headerCsrfToken = req.headers['x-csrf-token'] as string;

  if (!cookieCsrfToken || !headerCsrfToken) {
    res.status(403).json({ error: 'CSRF token missing. Please refresh the page and try again.' });
    return;
  }

  if (cookieCsrfToken !== headerCsrfToken || !verifyCsrfToken(headerCsrfToken)) {
    res.status(403).json({ error: 'Invalid or expired CSRF token. Request blocked.' });
    return;
  }

  next();
}
