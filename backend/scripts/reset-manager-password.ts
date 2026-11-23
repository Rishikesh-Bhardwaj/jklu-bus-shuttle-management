import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TARGET_USER_ID = 2;
const TARGET_EMAIL = 'rishikeshbhardwaj437@gmail.com';

async function resetManagerPassword(): Promise<void> {
  const newPassword = process.env.RESET_MANAGER_PASSWORD;

  // 1. Validate Password Input
  if (!newPassword || typeof newPassword !== 'string') {
    console.error('[VALIDATION ERROR] Password must be supplied via RESET_MANAGER_PASSWORD.');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('[VALIDATION ERROR] Password must be at least 8 characters long.');
    process.exit(1);
  }

  // 2. Strict Database Identity Enforcement: Only jklu_app_user is permitted
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'jklu_bus_shuttle';

  if (!user || !dbPassword) {
    console.error('[SECURITY ERROR] DB_USER and DB_PASSWORD must be defined.');
    process.exit(1);
  }

  if (user !== 'jklu_app_user') {
    console.error(`[SECURITY ERROR] Unauthorized database user '${user}'. Exactly 'jklu_app_user' is required across all environments.`);
    process.exit(1);
  }

  // 3. Strict Database Schema Enforcement: Only jklu_bus_shuttle is permitted
  if (database !== 'jklu_bus_shuttle') {
    console.error(`[SECURITY ERROR] Unauthorized database '${database}'. Exactly 'jklu_bus_shuttle' is required.`);
    process.exit(1);
  }

  // 4. Pre-Save Cryptographic Verification
  console.log('Generating bcrypt hash (12 salt rounds)...');
  const newHash = await bcrypt.hash(newPassword, 12);

  const verificationMatch = await bcrypt.compare(newPassword, newHash);
  if (!verificationMatch) {
    console.error('[CRYPTOGRAPHIC ERROR] Pre-save verification failed: hash does not match input password.');
    process.exit(1);
  }
  console.log('Pre-save cryptographic verification passed.');

  // 5. Connect to database
  let connection: mysql.Connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password: dbPassword,
      database,
      timezone: '+05:30',
    });
  } catch (connErr: any) {
    console.error('[CONNECTION ERROR] Failed to connect to MySQL:', connErr.message);
    process.exit(1);
  }

  let transactionActive = false;
  try {
    await connection.query("SET time_zone = '+05:30'");
    await connection.beginTransaction();
    transactionActive = true;

    // Verify Target User Record with Row Lock
    const [rows]: any = await connection.query(
      `SELECT user_id, email, role, account_status, verification_status
       FROM users
       WHERE user_id = ? FOR UPDATE`,
      [TARGET_USER_ID]
    );

    if (rows.length === 0) {
      throw new Error(`User ID ${TARGET_USER_ID} does not exist in schema.`);
    }

    const targetUser = rows[0];

    if (targetUser.role !== 'MANAGER') {
      throw new Error(`User ID ${TARGET_USER_ID} has role '${targetUser.role}', expected 'MANAGER'. Access denied.`);
    }

    if (targetUser.email.toLowerCase() !== TARGET_EMAIL.toLowerCase()) {
      throw new Error(`Email mismatch for User ID ${TARGET_USER_ID}. Expected '${TARGET_EMAIL}', found '${targetUser.email}'.`);
    }

    // Execute Scoped Update (password_hash ONLY)
    const [updateResult]: any = await connection.query(
      `UPDATE users
       SET password_hash = ?
       WHERE user_id = ? AND role = 'MANAGER'`,
      [newHash, TARGET_USER_ID]
    );

    if (updateResult.affectedRows !== 1) {
      throw new Error(`Update anomaly: expected exactly 1 affected row, but ${updateResult.affectedRows} rows were affected.`);
    }

    await connection.commit();
    transactionActive = false;

    console.log('====================================================');
    console.log('[SUCCESS] Manager password reset successfully.');
    console.log(`  User ID:       ${targetUser.user_id}`);
    console.log(`  Email:         ${targetUser.email}`);
    console.log(`  Role:          ${targetUser.role}`);
    console.log(`  Account:       ${targetUser.account_status}`);
    console.log(`  Verification:  ${targetUser.verification_status}`);
    console.log(`  Hash Prefix:   ${newHash.substring(0, 7)} (Cost 12)`);
    console.log(`  Hash Length:   ${newHash.length} characters`);
    console.log('  Password:      [PROTECTED / NOT DISPLAYED]');
    console.log('====================================================');
  } catch (error: any) {
    if (transactionActive) {
      try {
        await connection.rollback();
        console.log('[NOTICE] Database transaction rolled back safely.');
      } catch (rollbackErr: any) {
        console.error('[ROLLBACK ERROR]', rollbackErr.message);
      }
    }
    console.error('[OPERATION FAILED]', error.message);
    process.exitCode = 1;
  } finally {
    try {
      await connection.end();
    } catch (closeErr: any) {
      console.error('[CONNECTION CLOSE ERROR]', closeErr.message);
    }
  }
}

resetManagerPassword();

