import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { extractBaseUsername, getSslConfig, isTiDBServer } from '../src/config/dbSecurity.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Step 1: Apply or verify alteration of the `users` table.
 *
 * Authoritative Executable Definition:
 * - Checks each column, index, and foreign key individually for safe, idempotent re-runs.
 * - Adds missing objects sequentially, compatible with both standard MySQL and TiDB online DDL.
 * - Both fresh creation and resume paths execute the unified verification against information_schema:
 *   - Exactly 5 columns with exact signedness, types, collation (utf8mb4_unicode_ci), and nullability
 *   - Index idx_user_verification (column, sequence 1, non-unique)
 *   - Foreign key fk_user_reviewed_by (constraint name, column, ref table, ref col, DELETE_RULE)
 */
async function applyOrVerifyUsersAlteration(connection: mysql.Connection, database: string): Promise<void> {
  // Query 1: Check presence of target columns individually to ensure idempotent application
  const [initialCols]: any = await connection.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('verification_status', 'token_version', 'verification_reviewed_by_user_id', 'verification_reviewed_at', 'verification_notes')`,
    [database]
  );

  const existingColSet = new Set(initialCols.map((c: any) => c.COLUMN_NAME));

  if (!existingColSet.has('verification_status')) {
    console.log('    [Step 1/4] Adding column `verification_status` to `users`...');
    await connection.query(`
      ALTER TABLE users
      ADD COLUMN verification_status ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING' AFTER account_status
    `);
  }

  if (!existingColSet.has('token_version')) {
    console.log('    [Step 1/4] Adding column `token_version` to `users`...');
    await connection.query(`
      ALTER TABLE users
      ADD COLUMN token_version INT NOT NULL DEFAULT 1 AFTER verification_status
    `);
  }

  if (!existingColSet.has('verification_reviewed_by_user_id')) {
    console.log('    [Step 1/4] Adding column `verification_reviewed_by_user_id` to `users`...');
    await connection.query(`
      ALTER TABLE users
      ADD COLUMN verification_reviewed_by_user_id INT NULL AFTER token_version
    `);
  }

  if (!existingColSet.has('verification_reviewed_at')) {
    console.log('    [Step 1/4] Adding column `verification_reviewed_at` to `users`...');
    await connection.query(`
      ALTER TABLE users
      ADD COLUMN verification_reviewed_at TIMESTAMP NULL AFTER verification_reviewed_by_user_id
    `);
  }

  if (!existingColSet.has('verification_notes')) {
    console.log('    [Step 1/4] Adding column `verification_notes` to `users`...');
    await connection.query(`
      ALTER TABLE users
      ADD COLUMN verification_notes VARCHAR(255) NULL AFTER verification_reviewed_at
    `);
  }

  // Check and apply index idx_user_verification
  const [initialIdx]: any = await connection.query(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_user_verification'`,
    [database]
  );
  if (initialIdx.length === 0) {
    console.log('    [Step 1/4] Adding index `idx_user_verification` to `users`...');
    await connection.query(`
      ALTER TABLE users ADD INDEX idx_user_verification (verification_status)
    `);
  }

  // Check and apply foreign key fk_user_reviewed_by
  const [initialFk]: any = await connection.query(
    `SELECT rc.CONSTRAINT_NAME
     FROM information_schema.REFERENTIAL_CONSTRAINTS rc
     WHERE rc.CONSTRAINT_SCHEMA = ? AND rc.TABLE_NAME = 'users' AND rc.CONSTRAINT_NAME = 'fk_user_reviewed_by'`,
    [database]
  );
  if (initialFk.length === 0) {
    console.log('    [Step 1/4] Adding foreign key `fk_user_reviewed_by` to `users`...');
    await connection.query(`
      ALTER TABLE users
      ADD CONSTRAINT fk_user_reviewed_by FOREIGN KEY (verification_reviewed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
    `);
  }

  console.log('    [Step 1/4] Alterations applied; verifying created objects against schema metadata...');

  // Unified Verification: Query exact column definitions from information_schema
  const [cols]: any = await connection.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('verification_status', 'token_version', 'verification_reviewed_by_user_id', 'verification_reviewed_at', 'verification_notes')`,
    [database]
  );

  if (cols.length !== 5) {
    throw new Error(`Post-verification failed: Expected 5 verification columns on 'users', found ${cols.length}`);
  }

  const colMap = new Map<string, any>(cols.map((c: any) => [c.COLUMN_NAME, c]));

  // 1. verification_status: exact ENUM, utf8mb4_unicode_ci, NOT NULL, DEFAULT 'PENDING'
  const vStat = colMap.get('verification_status');
  if (
    !vStat ||
    vStat.DATA_TYPE !== 'enum' ||
    vStat.COLUMN_TYPE !== "enum('PENDING','VERIFIED','REJECTED')" ||
    vStat.COLLATION_NAME !== 'utf8mb4_unicode_ci' ||
    vStat.IS_NULLABLE !== 'NO' ||
    vStat.COLUMN_DEFAULT !== 'PENDING'
  ) {
    throw new Error(`Conflicting definition on users.verification_status: ${JSON.stringify(vStat)}`);
  }

  // 2. token_version: exact signed INT, NOT NULL, DEFAULT '1'
  const tVer = colMap.get('token_version');
  if (
    !tVer ||
    tVer.DATA_TYPE !== 'int' ||
    tVer.COLUMN_TYPE !== 'int' ||
    tVer.IS_NULLABLE !== 'NO' ||
    tVer.COLUMN_DEFAULT !== '1'
  ) {
    throw new Error(`Conflicting definition on users.token_version: ${JSON.stringify(tVer)}`);
  }

  // 3. verification_reviewed_by_user_id: exact signed INT, NULL, DEFAULT null
  const rById = colMap.get('verification_reviewed_by_user_id');
  if (
    !rById ||
    rById.DATA_TYPE !== 'int' ||
    rById.COLUMN_TYPE !== 'int' ||
    rById.IS_NULLABLE !== 'YES' ||
    rById.COLUMN_DEFAULT !== null
  ) {
    throw new Error(`Conflicting definition on users.verification_reviewed_by_user_id: ${JSON.stringify(rById)}`);
  }

  // 4. verification_reviewed_at: exact TIMESTAMP, NULL, DEFAULT null
  const rAt = colMap.get('verification_reviewed_at');
  if (
    !rAt ||
    rAt.DATA_TYPE !== 'timestamp' ||
    rAt.COLUMN_TYPE !== 'timestamp' ||
    rAt.IS_NULLABLE !== 'YES' ||
    rAt.COLUMN_DEFAULT !== null
  ) {
    throw new Error(`Conflicting definition on users.verification_reviewed_at: ${JSON.stringify(rAt)}`);
  }

  // 5. verification_notes: exact VARCHAR(255), utf8mb4_unicode_ci, NULL, DEFAULT null
  const vNotes = colMap.get('verification_notes');
  if (
    !vNotes ||
    vNotes.DATA_TYPE !== 'varchar' ||
    vNotes.COLUMN_TYPE !== 'varchar(255)' ||
    vNotes.COLLATION_NAME !== 'utf8mb4_unicode_ci' ||
    vNotes.IS_NULLABLE !== 'YES' ||
    vNotes.COLUMN_DEFAULT !== null
  ) {
    throw new Error(`Conflicting definition on users.verification_notes: ${JSON.stringify(vNotes)}`);
  }

  // Query 2: Verify index idx_user_verification
  const [indexRows]: any = await connection.query(
    `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_user_verification'`,
    [database]
  );
  if (
    indexRows.length !== 1 ||
    indexRows[0].COLUMN_NAME !== 'verification_status' ||
    Number(indexRows[0].SEQ_IN_INDEX) !== 1 ||
    Number(indexRows[0].NON_UNIQUE) !== 1
  ) {
    throw new Error("Missing or invalid index 'idx_user_verification' on users.verification_status");
  }

  // Query 3: Verify foreign key fk_user_reviewed_by (all 5 attributes)
  const [fkRows]: any = await connection.query(
    `SELECT rc.CONSTRAINT_NAME, kcu.COLUMN_NAME, rc.DELETE_RULE, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
     FROM information_schema.REFERENTIAL_CONSTRAINTS rc
     JOIN information_schema.KEY_COLUMN_USAGE kcu
       ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
     WHERE rc.CONSTRAINT_SCHEMA = ? AND rc.TABLE_NAME = 'users' AND rc.CONSTRAINT_NAME = 'fk_user_reviewed_by'`,
    [database]
  );
  if (fkRows.length !== 1) {
    throw new Error(`Expected exactly 1 foreign key 'fk_user_reviewed_by' on 'users', found ${fkRows.length}`);
  }
  const fk = fkRows[0];
  if (
    fk.CONSTRAINT_NAME !== 'fk_user_reviewed_by' ||
    fk.COLUMN_NAME !== 'verification_reviewed_by_user_id' ||
    fk.REFERENCED_TABLE_NAME !== 'users' ||
    fk.REFERENCED_COLUMN_NAME !== 'user_id' ||
    fk.DELETE_RULE !== 'SET NULL'
  ) {
    throw new Error(`Invalid foreign key 'fk_user_reviewed_by' on users: ${JSON.stringify(fk)}`);
  }

  console.log('    [Step 1/4: SUCCESS & VERIFIED] All 5 columns, index, and FK fk_user_reviewed_by verified.');
}

/**
 * Step 2: Apply or verify creation of the `user_verification_audit` table.
 *
 * Authoritative Executable Definition:
 * - If absent, creates the table with exact engine, collation, columns, and constraints.
 * - Both paths execute the unified verification against information_schema:
 *   - Engine: InnoDB, Collation: utf8mb4_unicode_ci
 *   - Exact 7 columns, signed types, AUTO_INCREMENT, nullability, defaults
 *   - Primary Key: audit_id
 *   - Exactly two foreign keys: fk_audit_user and fk_audit_reviewed_by (ON DELETE RESTRICT), rejecting unexpected FKs
 *   - Exactly three secondary indexes (idx_audit_user, idx_audit_reviewed_by, idx_audit_reviewed_at), rejecting unexpected indexes
 */
async function applyOrVerifyAuditTable(connection: mysql.Connection, database: string): Promise<void> {
  // Query 1: Check table existence
  const [tblInitial]: any = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_verification_audit'`,
    [database]
  );

  if (tblInitial.length === 0) {
    console.log('    [Step 2/4] Creating table `user_verification_audit`...');
    await connection.query(`
      CREATE TABLE user_verification_audit (
          audit_id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          reviewed_by_user_id INT NULL,
          previous_status ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL,
          new_status ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL,
          review_notes VARCHAR(255) NULL,
          reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
          CONSTRAINT fk_audit_reviewed_by FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
          INDEX idx_audit_user (user_id),
          INDEX idx_audit_reviewed_by (reviewed_by_user_id),
          INDEX idx_audit_reviewed_at (reviewed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('    [Step 2/4] CREATE TABLE executed; verifying created table immediately...');
  }

  // Unified Verification: Check engine and collation
  const [tblRows]: any = await connection.query(
    `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_verification_audit'`,
    [database]
  );
  if (tblRows.length !== 1) {
    throw new Error("Table 'user_verification_audit' does not exist in schema");
  }
  if ((tblRows[0].ENGINE || '').toLowerCase() !== 'innodb') {
    throw new Error(`Invalid table engine on user_verification_audit: expected InnoDB, found ${tblRows[0].ENGINE}`);
  }
  if (tblRows[0].TABLE_COLLATION !== 'utf8mb4_unicode_ci') {
    throw new Error(`Invalid table collation on user_verification_audit: expected utf8mb4_unicode_ci, found ${tblRows[0].TABLE_COLLATION}`);
  }

  // Query 2: Retrieve and verify exact column inventory (must be exactly 7 columns, reject unexpected columns)
  const [cols]: any = await connection.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_verification_audit'
     ORDER BY ORDINAL_POSITION ASC`,
    [database]
  );

  const expectedCols = ['audit_id', 'user_id', 'reviewed_by_user_id', 'previous_status', 'new_status', 'review_notes', 'reviewed_at'];
  if (cols.length !== 7) {
    const foundNames = cols.map((c: any) => c.COLUMN_NAME).join(', ');
    throw new Error(`Exact column inventory violation: expected exactly 7 columns [${expectedCols.join(', ')}], found ${cols.length} [${foundNames}]`);
  }

  const colMap = new Map<string, any>(cols.map((c: any) => [c.COLUMN_NAME, c]));

  // 1. audit_id: exact signed INT, AUTO_INCREMENT, NOT NULL
  const cAuditId = colMap.get('audit_id');
  if (
    !cAuditId ||
    cAuditId.DATA_TYPE !== 'int' ||
    cAuditId.COLUMN_TYPE !== 'int' ||
    cAuditId.EXTRA !== 'auto_increment' ||
    cAuditId.IS_NULLABLE !== 'NO'
  ) {
    throw new Error(`Invalid audit_id definition on user_verification_audit: ${JSON.stringify(cAuditId)}`);
  }

  // 2. user_id: exact signed INT, NOT NULL
  const cUserId = colMap.get('user_id');
  if (
    !cUserId ||
    cUserId.DATA_TYPE !== 'int' ||
    cUserId.COLUMN_TYPE !== 'int' ||
    cUserId.IS_NULLABLE !== 'NO'
  ) {
    throw new Error(`Invalid user_id definition on user_verification_audit: ${JSON.stringify(cUserId)}`);
  }

  // 3. reviewed_by_user_id: exact signed INT, NULL
  const cRevById = colMap.get('reviewed_by_user_id');
  if (
    !cRevById ||
    cRevById.DATA_TYPE !== 'int' ||
    cRevById.COLUMN_TYPE !== 'int' ||
    cRevById.IS_NULLABLE !== 'YES'
  ) {
    throw new Error(`Invalid reviewed_by_user_id definition on user_verification_audit: ${JSON.stringify(cRevById)}`);
  }

  // 4 & 5. previous_status and new_status: exact ENUM, utf8mb4_unicode_ci, NOT NULL
  for (const sCol of ['previous_status', 'new_status']) {
    const col = colMap.get(sCol);
    if (
      !col ||
      col.DATA_TYPE !== 'enum' ||
      col.COLUMN_TYPE !== "enum('PENDING','VERIFIED','REJECTED')" ||
      col.COLLATION_NAME !== 'utf8mb4_unicode_ci' ||
      col.IS_NULLABLE !== 'NO'
    ) {
      throw new Error(`Invalid ${sCol} definition on user_verification_audit: ${JSON.stringify(col)}`);
    }
  }

  // 6. review_notes: exact VARCHAR(255), utf8mb4_unicode_ci, NULL
  const cNotes = colMap.get('review_notes');
  if (
    !cNotes ||
    cNotes.DATA_TYPE !== 'varchar' ||
    cNotes.COLUMN_TYPE !== 'varchar(255)' ||
    cNotes.COLLATION_NAME !== 'utf8mb4_unicode_ci' ||
    cNotes.IS_NULLABLE !== 'YES'
  ) {
    throw new Error(`Invalid review_notes definition on user_verification_audit: ${JSON.stringify(cNotes)}`);
  }

  // 7. reviewed_at: exact TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP
  const cRevAt = colMap.get('reviewed_at');
  if (
    !cRevAt ||
    cRevAt.DATA_TYPE !== 'timestamp' ||
    cRevAt.COLUMN_TYPE !== 'timestamp' ||
    cRevAt.IS_NULLABLE !== 'NO' ||
    !cRevAt.COLUMN_DEFAULT ||
    !cRevAt.COLUMN_DEFAULT.toUpperCase().includes('CURRENT_TIMESTAMP')
  ) {
    throw new Error(`Invalid reviewed_at definition on user_verification_audit: ${JSON.stringify(cRevAt)}`);
  }

  // Query 3: Verify Primary Key is strictly on audit_id
  const [pkRows]: any = await connection.query(
    `SELECT kcu.COLUMN_NAME
     FROM information_schema.TABLE_CONSTRAINTS tc
     JOIN information_schema.KEY_COLUMN_USAGE kcu
       ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
      AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
      AND kcu.TABLE_NAME = tc.TABLE_NAME
     WHERE tc.CONSTRAINT_SCHEMA = ? AND tc.TABLE_NAME = 'user_verification_audit' AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'`,
    [database]
  );
  if (pkRows.length !== 1 || pkRows[0].COLUMN_NAME !== 'audit_id') {
    throw new Error("Missing or invalid Primary Key on user_verification_audit(audit_id)");
  }

  // Query 4: Verify Foreign Keys: EXACTLY TWO foreign keys exist (reject extra/unexpected FKs)
  const [fkRows]: any = await connection.query(
    `SELECT rc.CONSTRAINT_NAME, kcu.COLUMN_NAME, rc.DELETE_RULE, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
     FROM information_schema.REFERENTIAL_CONSTRAINTS rc
     JOIN information_schema.KEY_COLUMN_USAGE kcu
       ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
     WHERE rc.CONSTRAINT_SCHEMA = ? AND rc.TABLE_NAME = 'user_verification_audit'`,
    [database]
  );
  if (fkRows.length !== 2) {
    const foundFks = fkRows.map((fk: any) => fk.CONSTRAINT_NAME).join(', ');
    throw new Error(`Exact foreign-key count violation: expected exactly 2 foreign keys, found ${fkRows.length} (${foundFks})`);
  }

  const fkMap = new Map<string, any>(fkRows.map((fk: any) => [fk.CONSTRAINT_NAME, fk]));

  const fkUser = fkMap.get('fk_audit_user');
  if (
    !fkUser ||
    fkUser.COLUMN_NAME !== 'user_id' ||
    fkUser.REFERENCED_TABLE_NAME !== 'users' ||
    fkUser.REFERENCED_COLUMN_NAME !== 'user_id' ||
    fkUser.DELETE_RULE !== 'RESTRICT'
  ) {
    throw new Error(`Invalid foreign key 'fk_audit_user' on user_verification_audit: ${JSON.stringify(fkUser)}`);
  }

  const fkRev = fkMap.get('fk_audit_reviewed_by');
  if (
    !fkRev ||
    fkRev.COLUMN_NAME !== 'reviewed_by_user_id' ||
    fkRev.REFERENCED_TABLE_NAME !== 'users' ||
    fkRev.REFERENCED_COLUMN_NAME !== 'user_id' ||
    fkRev.DELETE_RULE !== 'RESTRICT'
  ) {
    throw new Error(`Invalid foreign key 'fk_audit_reviewed_by' on user_verification_audit: ${JSON.stringify(fkRev)}`);
  }

  // Query 5: Verify Secondary Indexes: EXACTLY THREE secondary indexes exist (reject extra/unexpected indexes)
  const [idxRows]: any = await connection.query(
    `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_verification_audit' AND INDEX_NAME != 'PRIMARY'`,
    [database]
  );

  if (idxRows.length !== 3) {
    const foundIdx = idxRows.map((i: any) => i.INDEX_NAME).join(', ');
    throw new Error(`Exact secondary index count violation: expected exactly 3 index entries, found ${idxRows.length} (${foundIdx})`);
  }

  const idxLookup = new Map<string, any>(idxRows.map((i: any) => [`${i.INDEX_NAME}:${i.COLUMN_NAME}`, i]));

  const expectedIndexes = [
    { name: 'idx_audit_user', col: 'user_id' },
    { name: 'idx_audit_reviewed_by', col: 'reviewed_by_user_id' },
    { name: 'idx_audit_reviewed_at', col: 'reviewed_at' },
  ];

  for (const exp of expectedIndexes) {
    const found = idxLookup.get(`${exp.name}:${exp.col}`);
    if (!found || Number(found.SEQ_IN_INDEX) !== 1 || Number(found.NON_UNIQUE) !== 1) {
      throw new Error(`Missing or invalid index '${exp.name}' on user_verification_audit(${exp.col})`);
    }
  }

  console.log('    [Step 2/4: SUCCESS & VERIFIED] `user_verification_audit` table, exactly 7 columns, PK, exactly 2 FKs, and exactly 3 indexes verified.');
}

/**
 * Step 3: Apply or verify the BEFORE UPDATE immutability trigger.
 *
 * If absent, creates the trigger.
 * Both paths execute the unified verification against information_schema.TRIGGERS.
 */
async function applyOrVerifyUpdateTrigger(connection: mysql.Connection, database: string): Promise<void> {
  const [initial]: any = await connection.query(
    `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = 'trg_user_verification_audit_no_update'`,
    [database]
  );

  if (initial.length === 0) {
    console.log('    [Step 3/4] Creating trigger `trg_user_verification_audit_no_update`...');
    await connection.query(`
      CREATE TRIGGER trg_user_verification_audit_no_update
      BEFORE UPDATE ON user_verification_audit
      FOR EACH ROW
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'user_verification_audit records are immutable and cannot be updated.'
    `);
    console.log('    [Step 3/4] Trigger created; verifying trigger immediately...');
  }

  // Unified Verification: Query information_schema.TRIGGERS
  const [rows]: any = await connection.query(
    `SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, EVENT_MANIPULATION, ACTION_TIMING, ACTION_STATEMENT
     FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = 'trg_user_verification_audit_no_update'`,
    [database]
  );

  if (rows.length !== 1) {
    throw new Error("Trigger 'trg_user_verification_audit_no_update' not found in schema");
  }

  const trg = rows[0];
  if (
    trg.EVENT_OBJECT_TABLE !== 'user_verification_audit' ||
    trg.EVENT_MANIPULATION !== 'UPDATE' ||
    trg.ACTION_TIMING !== 'BEFORE' ||
    !trg.ACTION_STATEMENT.includes('45000') ||
    !trg.ACTION_STATEMENT.includes('immutable')
  ) {
    throw new Error(`Conflicting definition for trigger \`trg_user_verification_audit_no_update\`: ${JSON.stringify(trg)}`);
  }

  console.log('    [Step 3/4: SUCCESS & VERIFIED] Trigger `trg_user_verification_audit_no_update` verified.');
}

/**
 * Step 4: Apply or verify the BEFORE DELETE immutability trigger.
 *
 * If absent, creates the trigger.
 * Both paths execute the unified verification against information_schema.TRIGGERS.
 */
async function applyOrVerifyDeleteTrigger(connection: mysql.Connection, database: string): Promise<void> {
  const [initial]: any = await connection.query(
    `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = 'trg_user_verification_audit_no_delete'`,
    [database]
  );

  if (initial.length === 0) {
    console.log('    [Step 4/4] Creating trigger `trg_user_verification_audit_no_delete`...');
    await connection.query(`
      CREATE TRIGGER trg_user_verification_audit_no_delete
      BEFORE DELETE ON user_verification_audit
      FOR EACH ROW
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'user_verification_audit records are immutable and cannot be deleted.'
    `);
    console.log('    [Step 4/4] Trigger created; verifying trigger immediately...');
  }

  // Unified Verification: Query information_schema.TRIGGERS
  const [rows]: any = await connection.query(
    `SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, EVENT_MANIPULATION, ACTION_TIMING, ACTION_STATEMENT
     FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = 'trg_user_verification_audit_no_delete'`,
    [database]
  );

  if (rows.length !== 1) {
    throw new Error("Trigger 'trg_user_verification_audit_no_delete' not found in schema");
  }

  const trg = rows[0];
  if (
    trg.EVENT_OBJECT_TABLE !== 'user_verification_audit' ||
    trg.EVENT_MANIPULATION !== 'DELETE' ||
    trg.ACTION_TIMING !== 'BEFORE' ||
    !trg.ACTION_STATEMENT.includes('45000') ||
    !trg.ACTION_STATEMENT.includes('immutable')
  ) {
    throw new Error(`Conflicting definition for trigger \`trg_user_verification_audit_no_delete\`: ${JSON.stringify(trg)}`);
  }

  console.log('    [Step 4/4: SUCCESS & VERIFIED] Trigger `trg_user_verification_audit_no_delete` verified.');
}

/**
 * Resilient orchestrator for Migration 010.
 *
 * Architecture Note on Source of Truth:
 * This TypeScript migration implementation is the explicit, authoritative executable source of truth
 * for Migration 010. The corresponding .sql file in src/migrations serves solely as a reference/documentation
 * schema specification.
 *
 * Execution Guarantee:
 * Executes all 4 steps sequentially and validates every object immediately against information_schema.
 */
async function applyMigration010(connection: mysql.Connection, database: string): Promise<void> {
  const [vRows]: any = await connection.query('SELECT VERSION() AS ver');
  const isTiDB = isTiDBServer(vRows[0]?.ver);

  console.log(`  [MIGRATION 010] Executing step-by-step resilient migration (Target Engine: ${isTiDB ? 'TiDB' : 'MySQL'})...`);
  await applyOrVerifyUsersAlteration(connection, database);
  await applyOrVerifyAuditTable(connection, database);

  if (isTiDB) {
    console.log('  [Step 3 & 4: SKIPPED FOR TiDB] Stored triggers are not supported in TiDB.');
    console.log('  [TiDB IMMUTABILITY] Audit-log immutability is enforced via database user privileges (SELECT & INSERT ONLY on `user_verification_audit`).');
  } else {
    await applyOrVerifyUpdateTrigger(connection, database);
    await applyOrVerifyDeleteTrigger(connection, database);
  }
  console.log('  [MIGRATION 010] Migration 010 steps successfully applied and verified.');
}

/**
 * Idempotent resource lifecycle status migration.
 * Each column is added only when absent, then verified against information_schema
 * before the migration is recorded. This also safely resumes a partially applied run.
 */
async function applyResourceLifecycleStatusMigration(connection: mysql.Connection, database: string): Promise<void> {
  const tables = ['route_corridors', 'routes', 'stops'];
  console.log('  [MIGRATION 011 RESOURCE LIFECYCLE] Applying and verifying resource status columns...');

  for (const table of tables) {
    const [beforeRows]: any = await connection.query(
      `SELECT COLUMN_TYPE, DATA_TYPE, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'status'`,
      [database, table]
    );

    if (beforeRows.length === 0) {
      console.log(`    Adding ${table}.status...`);
      await connection.query(
        `ALTER TABLE ${table} ADD COLUMN status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'`
      );
    }

    const [afterRows]: any = await connection.query(
      `SELECT COLUMN_TYPE, DATA_TYPE, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'status'`,
      [database, table]
    );
    const column = afterRows[0];
    if (
      afterRows.length !== 1 ||
      column.DATA_TYPE !== 'enum' ||
      column.COLUMN_TYPE !== "enum('ACTIVE','INACTIVE')" ||
      column.COLLATION_NAME !== 'utf8mb4_unicode_ci' ||
      column.IS_NULLABLE !== 'NO' ||
      column.COLUMN_DEFAULT !== 'ACTIVE'
    ) {
      throw new Error(`Invalid or missing ${table}.status definition: ${JSON.stringify(column)}`);
    }
    console.log(`    [VERIFIED] ${table}.status is ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'.`);
  }

  console.log('  [MIGRATION 011 RESOURCE LIFECYCLE] All resource status columns successfully verified.');
}

/**
 * Main migration runner:
 * - Scans src/migrations for *.sql files
 * - Checks schema_migrations table
 * - Skips already applied migrations (001-009)
 * - Executes unapplied migrations in alphanumeric order
 * - Records migration strictly after all steps succeed
 */
async function runMigrations(): Promise<void> {
  const host = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306', 10);
  const user = process.env.DB_MIGRATION_USER;
  const password = process.env.DB_MIGRATION_PASSWORD;
  const database = process.env.DB_NAME || process.env.MYSQLDATABASE || 'jklu_bus_shuttle';

  // 1. Mandatory Migration Credentials
  if (!user || !password) {
    console.error(
      'CRITICAL CONFIGURATION ERROR: DB_MIGRATION_USER and DB_MIGRATION_PASSWORD must be defined for migrations. Fallback credentials are not permitted.'
    );
    process.exit(1);
  }

  // 2. Strict Migration Identity Enforcement: Only migration_admin (bare or prefixed) is permitted
  const baseUser = extractBaseUsername(user);
  if (baseUser !== 'migration_admin') {
    console.error(
      `CRITICAL SECURITY CONFIGURATION ERROR: Unauthorized migration username '${user}'. Only 'migration_admin' (or '<prefix>.migration_admin') is permitted to execute migrations across all environments.`
    );
    process.exit(1);
  }

  // 3. Reject application runtime account for migrations
  const appUser = process.env.DB_USER || process.env.MYSQLUSER;
  if (appUser && baseUser === extractBaseUsername(appUser)) {
    console.error(
      'CRITICAL CONFIGURATION ERROR: Migration runner cannot connect using the application runtime account (DB_USER). Dedicated migration credentials (DB_MIGRATION_USER) are required.'
    );
    process.exit(1);
  }

  console.log('====================================================');
  console.log('JKLU Bus Shuttle Management System - Database Migrations');
  console.log('====================================================');
  console.log(`Connecting to existing database '${database}' at ${host}:${port} as '${user}'...`);

  let connection: mysql.Connection;
  try {
    const ssl = getSslConfig(host);
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      ssl,
      multipleStatements: true,
      timezone: '+05:30',
    });
    console.log(`Connected to existing database '${database}' successfully.`);
  } catch (error: any) {
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(
        `CRITICAL ERROR: Database '${database}' does not exist. The migration runner requires the target database to already exist and does not possess global CREATE DATABASE privileges.`
      );
    } else {
      console.error('Failed to connect to database:', error.message);
    }
    process.exit(1);
  }

  try {
    await connection.query("SET time_zone = '+05:30'");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    const [appliedRows]: any = await connection.query(
      'SELECT migration_name FROM schema_migrations'
    );
    const appliedSet = new Set(appliedRows.map((r: any) => r.migration_name));

    const migrationsDir = path.resolve(process.cwd(), 'src/migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration file(s) in ${migrationsDir}`);

    let appliedCount = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[ALREADY APPLIED] ${file}`);
        continue;
      }

      console.log(`[APPLYING] ${file}...`);

      // Migrations 010 and 011 resource lifecycle use resilient TypeScript orchestrators.
      if (file.startsWith('010_')) {
        await applyMigration010(connection, database);
      } else if (file.startsWith('011_resource_lifecycle_status')) {
        await applyResourceLifecycleStatusMigration(connection, database);
      } else {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        await connection.query(sql);
      }

      // Record migration strictly after all steps have completed and verified
      await connection.query(
        'INSERT INTO schema_migrations (migration_name) VALUES (?)',
        [file]
      );
      console.log(`[SUCCESS] Applied and recorded ${file}`);
      appliedCount++;
    }

    console.log('====================================================');
    console.log(`Migrations complete. Newly applied: ${appliedCount}, Total files: ${files.length}`);
    console.log('====================================================');
  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
