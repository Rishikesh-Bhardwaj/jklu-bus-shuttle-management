
import { Request, Response, NextFunction } from 'express';
import { parseCookies, verifyJwtToken, verifyCsrfToken } from '../utils/crypto.js';
import { pool } from '../config/db.js';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  fullName: string;
  identificationNumber?: string | null;
  role: 'STUDENT' | 'FACULTY' | 'MANAGER';
  studentCategory: 'HOSTELLER' | 'DAY_SCHOLAR' | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authentication Middleware
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['jklu_shuttle_token'];

  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Please sign in.',
    });
    return;
  }

  const payload = verifyJwtToken(token);

  if (!payload) {
    res.status(401).json({
      error: 'Session expired or invalid token. Please sign in again.',
    });
    return;
  }

  try {
    const [rows]: any = await pool.query(
      `SELECT user_id, email, full_name, identification_number, role, student_category,
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

    if (userRecord.account_status !== 'ACTIVE') {
      res.status(403).json({
        error: 'Account is suspended. Access denied. Please contact transport management.',
      });
      return;
    }

    if (userRecord.token_version !== payload.tokenVersion) {
      res.status(401).json({
        error: 'Session has been revoked or signed out from another device. Please sign in again.',
      });
      return;
    }

    req.user = {
      userId: userRecord.user_id,
      email: userRecord.email,
      fullName: userRecord.full_name,
      identificationNumber: userRecord.identification_number || null,
      role: userRecord.role,
      studentCategory: userRecord.student_category,
      verificationStatus: userRecord.verification_status,
      accountStatus: userRecord.account_status,
      tokenVersion: userRecord.token_version,
    };

    next();
  } catch (error: any) {
    res.status(500).json({
      error: 'Authentication error: ' + error.message,
    });
  }
}

/**
 * Role-Based Access Control
 */
export function requireRole(
  ...allowedRoles: Array<'STUDENT' | 'FACULTY' | 'MANAGER'>
) {
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
 * Affiliation Verification Enforcement
 */
export function requireVerified(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

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
 * CSRF Protection
 * - Allows only configured frontend origins.
 * - Requires a cryptographically signed CSRF token in the request header.
 * - Does not depend on third-party cookies.
 */
export function validateCsrf(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  if (safeMethods.includes(req.method)) {
    next();
    return;
  }

  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const localDevOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  const allowedOrigins = [
    ...configuredOrigins,
    ...(process.env.NODE_ENV !== 'production' ? localDevOrigins : []),
  ];

  const requestOrigin = req.headers.origin;

  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    res.status(403).json({
      error: 'Request origin not allowed.',
    });
    return;
  }

  const headerCsrfToken = req.headers['x-csrf-token'] as string;

  if (!headerCsrfToken || !verifyCsrfToken(headerCsrfToken)) {
    res.status(403).json({
      error: 'Invalid or missing CSRF token. Please refresh the page and try again.',
    });
    return;
  }

  next();
}
