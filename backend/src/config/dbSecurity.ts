import fs from 'fs';
import path from 'path';
import type mysql from 'mysql2/promise';

/**
 * Extracts the normalized base username from a potentially tenant-prefixed username.
 * Supports both standard local accounts ('jklu_app_user', 'root') and TiDB Cloud Serverless
 * prefixed accounts ('<prefix>.jklu_app_user', '<prefix>.root').
 *
 * Example:
 *   extractBaseUsername('jklu_app_user') -> 'jklu_app_user'
 *   extractBaseUsername('44Kz3Lonut.jklu_app_user') -> 'jklu_app_user'
 *   extractBaseUsername('44Kz3Lonut.root') -> 'root'
 */
export function extractBaseUsername(username?: string | null): string {
  if (!username) return '';
  const trimmed = username.trim().toLowerCase();
  const parts = trimmed.split('.');
  return parts[parts.length - 1];
}

/**
 * Determines whether the MySQL server version string indicates a TiDB database engine.
 * TiDB returns version strings containing 'TiDB' (e.g. '8.0.11-TiDB-v8.5.0').
 */
export function isTiDBServer(versionString?: string | null): boolean {
  return (versionString || '').toLowerCase().includes('tidb');
}

/**
 * Configures secure TLS connection settings for mysql2.
 * - Always enforces rejectUnauthorized: true (never false).
 * - Enforces minimum TLS version TLSv1.2.
 * - Fails clearly if a custom CA certificate path is defined in environment but does not exist.
 * - Returns undefined for local development connections without SSL.
 */
export function getSslConfig(host: string): mysql.SslOptions | undefined {
  const isTiDBCloudHost = host.toLowerCase().includes('tidbcloud.com') || host.toLowerCase().includes('gateway');
  const isSslRequested = process.env.DB_SSL === 'true';

  if (!isTiDBCloudHost && !isSslRequested) {
    return undefined;
  }

  const caPath = process.env.DB_CA_CERT || process.env.DB_SSL_CA;
  let caContent: Buffer | undefined;

  if (caPath) {
    const resolvedCaPath = path.resolve(process.cwd(), caPath);
    if (!fs.existsSync(resolvedCaPath)) {
      throw new Error(
        `CRITICAL DATABASE TLS CONFIGURATION ERROR: The specified CA certificate file does not exist at '${resolvedCaPath}'. Ensure the file path is correct or omit DB_CA_CERT to use default system CAs.`
      );
    }
    caContent = fs.readFileSync(resolvedCaPath);
  }

  return {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true, // Strict certificate validation - NEVER false
    ...(caContent ? { ca: caContent } : {}),
  };
}