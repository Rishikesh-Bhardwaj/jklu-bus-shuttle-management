import { Request, Response } from 'express';
import { pool } from '../config/db.js';
import {
  hashPassword,
  verifyPassword,
  signJwtToken,
  generateCsrfToken,
} from '../utils/crypto.js';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * GET /api/auth/csrf
 * Issues pre-authentication cryptographically signed CSRF token.
 */
export async function getCsrfToken(req: Request, res: Response): Promise<void> {
  const token = generateCsrfToken();

  res.cookie('jklu_csrf_token', token, {
    httpOnly: false, // Accessible to frontend JavaScript to send in X-CSRF-Token header
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({ csrfToken: token });
}

/**
 * POST /api/auth/register
 * Student & Faculty registration.
 * Explicitly prohibits self-registration as MANAGER.
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, fullName, role, studentCategory, phoneNumber } = req.body;

    // 1. Mandatory Fields Validation
    if (!email || !password || !fullName || !role) {
      res.status(400).json({ error: 'Email, password, full name, and role are required.' });
      return;
    }

    // 2. Strict Role Policy: Prohibit self-registering as MANAGER
    if (role === 'MANAGER') {
      res.status(403).json({
        error: 'Registration as MANAGER is strictly prohibited. Manager accounts must be created using the secure setup script.',
      });
      return;
    }

    if (role !== 'STUDENT' && role !== 'FACULTY') {
      res.status(400).json({ error: "Invalid role. Role must be 'STUDENT' or 'FACULTY'." });
      return;
    }

    // 3. Email Format Normalization & Validation
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    // 4. Role & Student Category Consistency Enforcement
    let sanitizedCategory: 'HOSTELLER' | 'DAY_SCHOLAR' | null = null;
    if (role === 'STUDENT') {
      if (!studentCategory || (studentCategory !== 'HOSTELLER' && studentCategory !== 'DAY_SCHOLAR')) {
        res.status(400).json({ error: "Students must specify student_category as either 'HOSTELLER' or 'DAY_SCHOLAR'." });
        return;
      }
      sanitizedCategory = studentCategory;
    } else {
      sanitizedCategory = null; // Faculty must not have student category
    }

    // 5. Password Complexity Validation
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    // 6. Check for duplicate email
    const [existing]: any = await pool.query('SELECT user_id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
      return;
    }

    // 7. Secure Password Hashing
    const passwordHash = await hashPassword(password);

    // 8. Insert new user with PENDING verification status
    const [result]: any = await pool.query(
      `INSERT INTO users (
        email, password_hash, full_name, role, student_category, phone_number,
        account_status, verification_status, token_version
      ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 'PENDING', 1)`,
      [normalizedEmail, passwordHash, fullName.trim(), role, sanitizedCategory, phoneNumber ? phoneNumber.trim() : null]
    );

    const newUserId = result.insertId;

    // 9. Issue HTTP-Only Session Cookie
    const token = signJwtToken({
      userId: newUserId,
      email: normalizedEmail,
      role,
      tokenVersion: 1,
    });

    res.cookie('jklu_shuttle_token', token, {
      httpOnly: true, // Secure against XSS token extraction
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'Account successfully registered. Affiliation verification is PENDING manager review.',
      user: {
        userId: newUserId,
        email: normalizedEmail,
        fullName: fullName.trim(),
        role,
        studentCategory: sanitizedCategory,
        verificationStatus: 'PENDING',
        accountStatus: 'ACTIVE',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
}

/**
 * POST /api/auth/login
 * Authenticates email and password, enforces active status, and sets HTTP-only cookie.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Fetch user from database
    const [rows]: any = await pool.query(
      `SELECT user_id, email, password_hash, full_name, role, student_category,
              COALESCE(verification_status, 'PENDING') AS verification_status,
              COALESCE(token_version, 1) AS token_version,
              account_status
       FROM users
       WHERE email = ?`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user = rows[0];

    // 2. Immediate Suspended Account Enforcement
    if (user.account_status !== 'ACTIVE') {
      res.status(403).json({ error: 'This account has been suspended. Please contact transport management.' });
      return;
    }

    // 3. Constant-time bcrypt password comparison
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // 4. Issue HTTP-Only JWT Cookie
    const token = signJwtToken({
      userId: user.user_id,
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version,
    });

    res.cookie('jklu_shuttle_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Signed in successfully.',
      user: {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        studentCategory: user.student_category,
        verificationStatus: user.verification_status,
        accountStatus: user.account_status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
}

/**
 * POST /api/auth/logout
 * Clears session cookie and increments token_version for global session invalidation.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    if (req.user) {
      // Invalidate all active tokens globally by bumping token_version in database
      await pool.query('UPDATE users SET token_version = token_version + 1 WHERE user_id = ?', [req.user.userId]);
    }

    res.clearCookie('jklu_shuttle_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    res.json({ message: 'Successfully signed out from all sessions.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Logout failed: ' + error.message });
  }
}

/**
 * GET /api/auth/me
 * Returns authenticated user profile with real-time verification and role state.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  res.json({ user: req.user });
}

