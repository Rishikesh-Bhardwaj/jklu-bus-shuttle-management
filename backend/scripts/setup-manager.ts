import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function setupManager() {
  const args = process.argv.slice(2);
  const email = process.env.BOOTSTRAP_MANAGER_EMAIL || args[0];
  const password = process.env.BOOTSTRAP_MANAGER_PASSWORD || args[1];
  const fullName = process.env.BOOTSTRAP_MANAGER_NAME || args[2] || 'Transport Manager';
  const phoneNumber = process.env.BOOTSTRAP_MANAGER_PHONE || args[3] || '9999999999';

  if (!email || !password) {
    console.log('Usage: npx tsx scripts/setup-manager.ts <email> <password> [fullName] [phoneNumber]');
    console.log('Or set BOOTSTRAP_MANAGER_EMAIL and BOOTSTRAP_MANAGER_PASSWORD in environment.');
    process.exit(1);
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'jklu_bus_shuttle';

  if (!user || !dbPassword) {
    console.error('[SECURITY ERROR] DB_USER and DB_PASSWORD must be configured in environment.');
    process.exit(1);
  }

  if (user === 'root') {
    console.error('[SECURITY ERROR] Using MySQL root account is strictly prohibited.');
    process.exit(1);
  }

  console.log(`Connecting to database '${database}' to configure initial manager...`);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password: dbPassword,
    database,
    timezone: '+05:30',
  });

  try {
    await connection.query("SET time_zone = '+05:30'");

    // Check if email already exists
    const [existing]: any = await connection.query('SELECT user_id, email, role FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log(`[NOTICE] User with email '${email}' already exists with role '${existing[0].role}'.`);
      process.exit(0);
    }

    console.log('Hashing password securely using bcrypt (12 rounds)...');
    const passwordHash = await bcrypt.hash(password, 12);

    console.log(`Creating initial manager account for '${email}'...`);
    const [result]: any = await connection.query(
      `INSERT INTO users (email, password_hash, full_name, role, student_category, phone_number, account_status, verification_status, token_version, verification_notes)
       VALUES (?, ?, ?, 'MANAGER', NULL, ?, 'ACTIVE', 'VERIFIED', 1, 'Initial bootstrap administrator')`,
      [email, passwordHash, fullName, phoneNumber]
    );

    console.log('====================================================');
    console.log('[SUCCESS] Manager account created successfully.');
    console.log(`  User ID:   ${result.insertId}`);
    console.log(`  Email:     ${email}`);
    console.log(`  Full Name: ${fullName}`);
    console.log(`  Role:      MANAGER`);
    console.log('  Password:  [PROTECTED / NOT DISPLAYED]');
    console.log('====================================================');
  } catch (error: any) {
    console.error('[ERROR] Failed to setup manager:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

setupManager();

