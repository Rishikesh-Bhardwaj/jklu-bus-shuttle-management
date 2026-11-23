import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbUser = process.env.DB_USER || process.env.MYSQLUSER;
const dbPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
const migrationUser = process.env.DB_MIGRATION_USER;

// 1. Mandatory Runtime Credentials: Require DB_USER and DB_PASSWORD across all environments
if (!dbUser || !dbPassword) {
  throw new Error(
    'CRITICAL SECURITY CONFIGURATION ERROR: DB_USER and DB_PASSWORD must be defined for application runtime connection. Fallback credentials are not permitted in any environment.'
  );
}

// 2. Reject MySQL root account across all environments
if (dbUser.toLowerCase() === 'root') {
  throw new Error(
    'CRITICAL SECURITY CONFIGURATION ERROR: Application runtime connection cannot use the MySQL root account in any environment. Configure a dedicated least-privilege DB_USER.'
  );
}

// 3. Reject dedicated migration administrator identity (jklu_migration_admin) across all environments
if (dbUser.toLowerCase() === 'jklu_migration_admin') {
  throw new Error(
    'CRITICAL SECURITY CONFIGURATION ERROR: Application runtime connection cannot use the dedicated migration administrator account (jklu_migration_admin). Enforce credential separation across all environments.'
  );
}

// 4. Reject configured DB_MIGRATION_USER across all environments
if (migrationUser && dbUser.toLowerCase() === migrationUser.toLowerCase()) {
  throw new Error(
    'CRITICAL SECURITY CONFIGURATION ERROR: Application runtime connection cannot use the configured migration administrator account (DB_MIGRATION_USER). Enforce credential separation across all environments.'
  );
}

const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306', 10),
  user: dbUser,
  password: dbPassword,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'jklu_bus_shuttle',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+05:30', // Asian/Kolkata timezone offset
};

// Create the connection pool
export const pool: Pool = mysql.createPool(dbConfig);

/**
 * Acquires a connection from the pool and enforces the IST (+05:30) session time zone.
 */
export async function getSessionConnection(): Promise<PoolConnection> {
  const connection = await pool.getConnection();
  await connection.query("SET time_zone = '+05:30'");
  return connection;
}

/**
 * Verifies active database connection and reports server version and timezone.
 * Never exposes passwords or internal credentials.
 */
export async function verifyDatabaseConnection(): Promise<{
  connected: boolean;
  version: string;
  timeZone: string;
  database: string;
  user: string;
}> {
  const connection = await getSessionConnection();
  try {
    const [versionRows]: any = await connection.query('SELECT VERSION() AS version');
    const [tzRows]: any = await connection.query('SELECT @@session.time_zone AS timeZone');
    const [dbRows]: any = await connection.query('SELECT DATABASE() AS dbName');
    const [userRows]: any = await connection.query('SELECT CURRENT_USER() AS currentUser');

    return {
      connected: true,
      version: versionRows[0]?.version || 'unknown',
      timeZone: tzRows[0]?.timeZone || 'unknown',
      database: dbRows[0]?.dbName || 'unknown',
      user: userRows[0]?.currentUser || 'unknown',
    };
  } finally {
    connection.release();
  }
}
