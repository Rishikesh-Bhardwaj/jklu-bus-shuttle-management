import { CookieOptions, Request, Response } from 'express';
import { pool } from '../config/db.js';
import {
  hashPassword,
  verifyPassword,
  signJwtToken,
  generateCsrfToken,
} from '../utils/crypto.js';

const isProduction = process.env.NODE_ENV === 'production';
const cookieSameSite: 'none' | 'lax' = isProduction ? 'none' : 'lax';

const authCookieOptions: CookieOptions = {
  httpOnly: true, // Secure against XSS token extraction
  secure: isProduction,
  sameSite: cookieSameSite,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const csrfCookieOptions: CookieOptions = {
  httpOnly: false, // Accessible to frontend JavaScript to send in X-CSRF-Token header
  secure: isProduction,
  sameSite: cookieSameSite,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const clearAuthCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: cookieSameSite,
  path: '/',
};

/**
 * GET /api/auth/csrf
 * Issues pre-authentication cryptographically signed CSRF token.
 */
export async function getCsrfToken(req: Request, res: Response): Promise<void> {
  const token = generateCsrfToken();

  res.cookie('jklu_csrf_token', token, csrfCookieOptions);

  res.json({ csrfToken: token });
}

/**
 * POST /api/auth/register
 * Student & Faculty registration.
 * Explicitly prohibits self-registration as MANAGER.
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const {
      email,
      password,
      fullName,
      role,
      studentCategory,
      phoneNumber,
      identificationNumber,
      rollNumber,
      facultyId,
    } = req.body;

    // 1. Mandatory Fields Validation
    if (!email || !password || !fullName || !role) {
      res.status(400).json({ error: 'Email, password, full name, and role are required.' });
      return;
    }

    const idNumber = (identificationNumber || rollNumber || facultyId || '').trim();
    if (role === 'STUDENT' && !idNumber) {
      res.status(400).json({ error: 'Roll Number is required for student registration.' });
      return;
    }
    if (role === 'FACULTY' && !idNumber) {
      res.status(400).json({ error: 'Faculty ID is required for faculty registration.' });
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
    const [existingEmail]: any = await pool.query('SELECT user_id FROM users WHERE email = ?', [normalizedEmail]);
    if (existingEmail.length > 0) {
      res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
      return;
    }

    // 7. Check for duplicate Roll Number or Faculty ID within their respective role
    if (idNumber) {
      const [existingId]: any = await pool.query(
        'SELECT user_id FROM users WHERE role = ? AND LOWER(identification_number) = ?',
        [role, idNumber.toLowerCase()]
      );
      if (existingId.length > 0) {
        const idLabel = role === 'STUDENT' ? 'Roll Number' : 'Faculty ID';
        res.status(409).json({ error: `An account with this ${idLabel} already exists.` });
        return;
      }
    }

    // 8. Secure Password Hashing
    const passwordHash = await hashPassword(password);

    // 9. Insert new user with PENDING verification status
    const [result]: any = await pool.query(
      `INSERT INTO users (
        email, password_hash, full_name, identification_number, role, student_category, phone_number,
        account_status, verification_status, token_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'PENDING', 1)`,
      [
        normalizedEmail,
        passwordHash,
        fullName.trim(),
        idNumber || null,
        role,
        sanitizedCategory,
        phoneNumber ? phoneNumber.trim() : null,
      ]
    );

    const newUserId = result.insertId;

    // 10. Issue HTTP-Only Session Cookie
    const token = signJwtToken({
      userId: newUserId,
      email: normalizedEmail,
      role,
      tokenVersion: 1,
    });

    res.cookie('jklu_shuttle_token', token, authCookieOptions);

    res.status(201).json({
      message: 'Account successfully registered. Affiliation verification is PENDING manager review.',
      user: {
        userId: newUserId,
        email: normalizedEmail,
        fullName: fullName.trim(),
        identificationNumber: idNumber || null,
        role,
        studentCategory: sanitizedCategory,
        verificationStatus: 'PENDING',
        accountStatus: 'ACTIVE',
      },
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      const idLabel = req.body?.role === 'STUDENT' ? 'Roll Number' : 'Faculty ID';
      res.status(409).json({ error: `An account with this ${idLabel} or email already exists.` });
      return;
    }
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
      `SELECT user_id, email, password_hash, full_name, identification_number, role, student_category,
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

    res.cookie('jklu_shuttle_token', token, authCookieOptions);

    res.json({
      message: 'Signed in successfully.',
      user: {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        identificationNumber: user.identification_number || null,
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

    res.clearCookie('jklu_shuttle_token', clearAuthCookieOptions);

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

