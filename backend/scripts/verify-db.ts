import mysql from 'mysql2/promise';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_MIGRATION_USER;
  const password = process.env.DB_MIGRATION_PASSWORD;
  const database = process.env.DB_NAME || 'jklu_bus_shuttle';

  if (!user || !password) {
    console.error(
      'CRITICAL CONFIGURATION ERROR: DB_MIGRATION_USER and DB_MIGRATION_PASSWORD must be defined for database verification.'
    );
    process.exit(1);
  }

  // Strict Migration Identity Enforcement: Only jklu_migration_admin is permitted
  if (user !== 'jklu_migration_admin') {
    console.error(
      `CRITICAL SECURITY CONFIGURATION ERROR: Unauthorized verification username '${user}'. Only 'jklu_migration_admin' is permitted to run database verification across all environments.`
    );
    process.exit(1);
  }

  if (process.env.DB_USER && user.toLowerCase() === process.env.DB_USER.toLowerCase()) {
    console.error(
      'CRITICAL CONFIGURATION ERROR: Database verification requires administrative credentials (DB_MIGRATION_USER) and cannot use application runtime credentials.'
    );
    process.exit(1);
  }

  console.log('====================================================');
  console.log('JKLU Bus Shuttle Management System - Database Verification');
  console.log('====================================================');

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    timezone: '+05:30',
  });

  const errors: string[] = [];

  try {
    await connection.query("SET time_zone = '+05:30'");

    const [vRows]: any = await connection.query('SELECT VERSION() AS ver, @@session.time_zone AS tz, DATABASE() AS db');
    console.log(`Connected to Database: ${vRows[0].db}`);
    console.log(`MySQL Server Version: ${vRows[0].ver}`);
    console.log(`Session Timezone:      ${vRows[0].tz}`);
    console.log('----------------------------------------------------');

    // 1. Check schema_migrations records
    console.log('Applied Migrations (schema_migrations):');
    const [migrations]: any = await connection.query(
      'SELECT migration_id, migration_name, applied_at FROM schema_migrations ORDER BY migration_id ASC;'
    );
    for (const m of migrations) {
      console.log(`  [ID: ${m.migration_id}] ${m.migration_name.padEnd(52)} | Applied: ${m.applied_at}`);
    }

    const appliedSet = new Set(migrations.map((m: any) => m.migration_name));
    for (let i = 1; i <= 9; i++) {
      const prefix = `00${i}_`;
      const found = Array.from(appliedSet).some((name: any) => name.startsWith(prefix));
      if (!found) {
        errors.push(`Expected migration ${prefix} is missing from schema_migrations`);
      }
    }
    console.log('----------------------------------------------------');

    // 2. Operational Tables & Zero-Row Check
    const operationalTables = [
      'users',
      'user_verification_audit',
      'buses',
      'seats',
      'drivers',
      'route_corridors',
      'routes',
      'stops',
      'route_stops',
      'trips',
      'bookings',
      'trip_seat_reservations',
      'check_ins',
      'feedback',
    ];

    console.log('Operational Table Inventory & Zero-Row Count Verification:');
    for (const tbl of operationalTables) {
      try {
        const [cntRows]: any = await connection.query(`SELECT COUNT(*) AS total FROM \`${tbl}\``);
        const count = cntRows[0].total;
        console.log(`  - Table: ${tbl.padEnd(25)} | Rows: ${count}`);
        if (count !== 0) {
          errors.push(`Table '${tbl}' violates Zero-Fake-Data policy: contains ${count} rows (expected 0)`);
        }
      } catch (err: any) {
        console.log(`  - Table: ${tbl.padEnd(25)} | MISSING`);
        errors.push(`Table '${tbl}' is missing: ${err.message}`);
      }
    }

    // Check schema_migrations row count
    try {
      const [migCnt]: any = await connection.query('SELECT COUNT(*) AS total FROM schema_migrations');
      console.log(`  - Table: ${'schema_migrations'.padEnd(25)} | Rows: ${migCnt[0].total} (Migration history ledger)`);
      if (migCnt[0].total === 0) {
        errors.push("Table 'schema_migrations' has 0 rows (expected applied migration records)");
      }
    } catch (err: any) {
      errors.push(`Table 'schema_migrations' is missing: ${err.message}`);
    }
    console.log('----------------------------------------------------');

    // 3. Deep Verification: users table columns & constraints
    console.log('Verifying `users` verification columns, index, and foreign key...');
    const [userCols]: any = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('verification_status', 'token_version', 'verification_reviewed_by_user_id', 'verification_reviewed_at', 'verification_notes')`,
      [database]
    );

    if (userCols.length !== 5) {
      errors.push(`Expected 5 verification columns on 'users', found ${userCols.length}`);
    }

    const userColMap = new Map<string, any>(userCols.map((c: any) => [c.COLUMN_NAME, c]));

    // verification_status
    const vStat = userColMap.get('verification_status');
    if (
      !vStat ||
      vStat.DATA_TYPE !== 'enum' ||
      vStat.COLUMN_TYPE !== "enum('PENDING','VERIFIED','REJECTED')" ||
      vStat.COLLATION_NAME !== 'utf8mb4_unicode_ci' ||
      vStat.IS_NULLABLE !== 'NO' ||
      vStat.COLUMN_DEFAULT !== 'PENDING'
    ) {
      errors.push(`Invalid users.verification_status definition: ${JSON.stringify(vStat)}`);
    }

    // token_version
    const tVer = userColMap.get('token_version');
    if (
      !tVer ||
      tVer.DATA_TYPE !== 'int' ||
      tVer.COLUMN_TYPE !== 'int' ||
      tVer.IS_NULLABLE !== 'NO' ||
      tVer.COLUMN_DEFAULT !== '1'
    ) {
      errors.push(`Invalid users.token_version definition: ${JSON.stringify(tVer)}`);
    }

    // verification_reviewed_by_user_id
    const rById = userColMap.get('verification_reviewed_by_user_id');
    if (
      !rById ||
      rById.DATA_TYPE !== 'int' ||
      rById.COLUMN_TYPE !== 'int' ||
      rById.IS_NULLABLE !== 'YES'
    ) {
      errors.push(`Invalid users.verification_reviewed_by_user_id definition: ${JSON.stringify(rById)}`);
    }

    // verification_reviewed_at
    const rAt = userColMap.get('verification_reviewed_at');
    if (
      !rAt ||
      rAt.DATA_TYPE !== 'timestamp' ||
      rAt.COLUMN_TYPE !== 'timestamp' ||
      rAt.IS_NULLABLE !== 'YES'
    ) {
      errors.push(`Invalid users.verification_reviewed_at definition: ${JSON.stringify(rAt)}`);
    }

    // verification_notes
    const vNotes = userColMap.get('verification_notes');
    if (
      !vNotes ||
      vNotes.DATA_TYPE !== 'varchar' ||
      vNotes.COLUMN_TYPE !== 'varchar(255)' ||
      vNotes.COLLATION_NAME !== 'utf8mb4_unicode_ci' ||
      vNotes.IS_NULLABLE !== 'YES'
    ) {
      errors.push(`Invalid users.verification_notes definition: ${JSON.stringify(vNotes)}`);
    }

    // Index: idx_user_verification
    const [uIdx]: any = await connection.query(
      `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_user_verification'`,
      [database]
    );
    if (uIdx.length !== 1 || uIdx[0].COLUMN_NAME !== 'verification_status' || uIdx[0].SEQ_IN_INDEX !== 1 || uIdx[0].NON_UNIQUE !== 1) {
      errors.push("Missing or invalid index 'idx_user_verification' on users.verification_status");
    }

    // FK: fk_user_reviewed_by (all 5 attributes)
    const [uFk]: any = await connection.query(
      `SELECT rc.CONSTRAINT_NAME, kcu.COLUMN_NAME, rc.DELETE_RULE, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
       FROM information_schema.REFERENTIAL_CONSTRAINTS rc
       JOIN information_schema.KEY_COLUMN_USAGE kcu 
         ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       WHERE rc.CONSTRAINT_SCHEMA = ? AND rc.TABLE_NAME = 'users' AND rc.CONSTRAINT_NAME = 'fk_user_reviewed_by'`,
      [database]
    );
    if (
      uFk.length !== 1 ||
      uFk[0].COLUMN_NAME !== 'verification_reviewed_by_user_id' ||
      uFk[0].REFERENCED_TABLE_NAME !== 'users' ||
      uFk[0].REFERENCED_COLUMN_NAME !== 'user_id' ||
      uFk[0].DELETE_RULE !== 'SET NULL'
    ) {
      errors.push("Missing or invalid FK 'fk_user_reviewed_by' on users (expected ON DELETE SET NULL to users.user_id)");
    }
    console.log('----------------------------------------------------');

    // 4. Deep Verification: user_verification_audit table
    console.log('Verifying `user_verification_audit` table structure, exact constraints, and exact indexes...');
    const [auditTbl]: any = await connection.query(
      `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_verification_audit'`,
      [database]
    );
    if (auditTbl.length !== 1) {
      errors.push("Table 'user_verification_audit' does not exist");
    } else {
      if ((auditTbl[0].ENGINE || '').toLowerCase() !== 'innodb') {
        errors.push(`Table 'user_verification_audit' engine is ${auditTbl[0].ENGINE} (expected InnoDB)`);
      }
      if (auditTbl[0].TABLE_COLLATION !== 'utf8mb4_unicode_ci') {
        errors.push(`Table 'user_verification_audit' collation is ${auditTbl[0].TABLE_COLLATION} (expected utf8mb4_unicode_ci)`);
      }

      // Exact 7 columns, reject unexpected columns
      const [auditCols]: any = await connection.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_verification_audit'
         ORDER BY ORDINAL_POSITION ASC`,
        [database]
      );

      const expectedAuditCols = ['audit_id', 'user_id', 'reviewed_by_user_id', 'previous_status', 'new_status', 'review_notes', 'reviewed_at'];
      if (auditCols.length !== 7) {
        errors.push(`Column inventory mismatch on user_verification_audit: expected exactly 7 columns [${expectedAuditCols.join(', ')}], found ${auditCols.length}`);
      }

      const aColMap = new Map<string, any>(auditCols.map((c: any) => [c.COLUMN_NAME, c]));

      // audit_id
      const aId = aColMap.get('audit_id');
      if (
        !aId ||
        aId.DATA_TYPE !== 'int' ||
        aId.COLUMN_TYPE !== 'int' ||
        aId.EXTRA !== 'auto_increment' ||
        aId.IS_NULLABLE !== 'NO'
      ) {
        errors.push(`Invalid audit_id on user_verification_audit: ${JSON.stringify(aId)}`);
      }

      // user_id
      const aUid = aColMap.get('user_id');
      if (
        !aUid ||
        aUid.DATA_TYPE !== 'int' ||
        aUid.COLUMN_TYPE !== 'int' ||
        aUid.IS_NULLABLE !== 'NO'
      ) {
        errors.push(`Invalid user_id on user_verification_audit: ${JSON.stringify(aUid)}`);
      }

      // reviewed_by_user_id
      const aRuid = aColMap.get('reviewed_by_user_id');
      if (
        !aRuid ||
        aRuid.DATA_TYPE !== 'int' ||
        aRuid.COLUMN_TYPE !== 'int' ||
        aRuid.IS_NULLABLE !== 'YES'
      ) {
        errors.push(`Invalid reviewed_by_user_id on user_verification_audit: ${JSON.stringify(aRuid)}`);
      }

      // previous_status & new_status
      for (const stCol of ['previous_status', 'new_status']) {
        const col = aColMap.get(stCol);
        if (
          !col ||
          col.DATA_TYPE !== 'enum' ||
          col.COLUMN_TYPE !== "enum('PENDING','VERIFIED','REJECTED')" ||
          col.COLLATION_NAME !== 'utf8mb4_unicode_ci' ||
          col.IS_NULLABLE !== 'NO'
        ) {
          errors.push(`Invalid ${stCol} on user_verification_audit: ${JSON.stringify(col)}`);
        }
      }

      // review_notes
      const aNotes = aColMap.get('review_notes');
      if (
        !aNotes ||
        aNotes.DATA_TYPE !== 'varchar' ||
        aNotes.COLUMN_TYPE !== 'varchar(255)' ||
        aNotes.COLLATION_NAME !== 'utf8mb4_unicode_ci' ||
        aNotes.IS_NULLABLE !== 'YES'
      ) {
        errors.push(`Invalid review_notes on user_verification_audit: ${JSON.stringify(aNotes)}`);
      }

      // reviewed_at
      const aAt = aColMap.get('reviewed_at');
      if (
        !aAt ||
        aAt.DATA_TYPE !== 'timestamp' ||
        aAt.COLUMN_TYPE !== 'timestamp' ||
        aAt.IS_NULLABLE !== 'NO' ||
        !aAt.COLUMN_DEFAULT ||
        !aAt.COLUMN_DEFAULT.toUpperCase().includes('CURRENT_TIMESTAMP')
      ) {
        errors.push(`Invalid reviewed_at on user_verification_audit: ${JSON.stringify(aAt)}`);
      }

      // Primary Key
      const [aPk]: any = await connection.query(
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
      if (aPk.length !== 1 || aPk[0].COLUMN_NAME !== 'audit_id') {
        errors.push("Missing or invalid Primary Key on user_verification_audit(audit_id)");
      }

      // Exact 2 Foreign Keys: fk_audit_user & fk_audit_reviewed_by (reject unexpected FKs)
      const [aFk]: any = await connection.query(
        `SELECT rc.CONSTRAINT_NAME, kcu.COLUMN_NAME, rc.DELETE_RULE, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
         FROM information_schema.REFERENTIAL_CONSTRAINTS rc
         JOIN information_schema.KEY_COLUMN_USAGE kcu
           ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
         WHERE rc.CONSTRAINT_SCHEMA = ? AND rc.TABLE_NAME = 'user_verification_audit'`,
        [database]
      );
      if (aFk.length !== 2) {
        errors.push(`Expected exactly 2 foreign keys on user_verification_audit, found ${aFk.length}`);
      }

      const aFkMap = new Map<string, any>(aFk.map((fk: any) => [fk.CONSTRAINT_NAME, fk]));

      const fkAuditUser = aFkMap.get('fk_audit_user');
      if (!fkAuditUser || fkAuditUser.COLUMN_NAME !== 'user_id' || fkAuditUser.REFERENCED_TABLE_NAME !== 'users' || fkAuditUser.REFERENCED_COLUMN_NAME !== 'user_id' || fkAuditUser.DELETE_RULE !== 'RESTRICT') {
        errors.push("Missing or invalid foreign key 'fk_audit_user' on user_verification_audit(user_id) ON DELETE RESTRICT");
      }

      const fkAuditRev = aFkMap.get('fk_audit_reviewed_by');
      if (!fkAuditRev || fkAuditRev.COLUMN_NAME !== 'reviewed_by_user_id' || fkAuditRev.REFERENCED_TABLE_NAME !== 'users' || fkAuditRev.REFERENCED_COLUMN_NAME !== 'user_id' || fkAuditRev.DELETE_RULE !== 'RESTRICT') {
        errors.push("Missing or invalid foreign key 'fk_audit_reviewed_by' on user_verification_audit(reviewed_by_user_id) ON DELETE RESTRICT");
      }

      // Exact 3 Secondary Indexes (reject unexpected indexes)
      const [aIdx]: any = await connection.query(
        `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_verification_audit' AND INDEX_NAME != 'PRIMARY'`,
        [database]
      );
      if (aIdx.length !== 3) {
        errors.push(`Expected exactly 3 secondary index entries on user_verification_audit, found ${aIdx.length}`);
      }

      const aIdxMap = new Map<string, any>();
      for (const i of aIdx) {
        aIdxMap.set(`${i.INDEX_NAME}:${i.COLUMN_NAME}`, i);
      }

      for (const exp of [
        { name: 'idx_audit_user', col: 'user_id' },
        { name: 'idx_audit_reviewed_by', col: 'reviewed_by_user_id' },
        { name: 'idx_audit_reviewed_at', col: 'reviewed_at' },
      ]) {
        const found = aIdxMap.get(`${exp.name}:${exp.col}`);
        if (!found || found.SEQ_IN_INDEX !== 1 || found.NON_UNIQUE !== 1) {
          errors.push(`Missing or invalid index '${exp.name}' on user_verification_audit(${exp.col})`);
        }
      }
    }
    console.log('----------------------------------------------------');

    // 5. Deep Verification: Triggers
    console.log('Verifying immutability triggers on `user_verification_audit`...');
    const [trgRows]: any = await connection.query(
      `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, ACTION_STATEMENT
       FROM information_schema.TRIGGERS 
       WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME IN ('trg_user_verification_audit_no_update', 'trg_user_verification_audit_no_delete')`,
      [database]
    );
    const trgMap = new Map<string, any>(trgRows.map((t: any) => [t.TRIGGER_NAME, t]));

    const trgUpdate = trgMap.get('trg_user_verification_audit_no_update');
    if (
      !trgUpdate ||
      trgUpdate.EVENT_OBJECT_TABLE !== 'user_verification_audit' ||
      trgUpdate.EVENT_MANIPULATION !== 'UPDATE' ||
      trgUpdate.ACTION_TIMING !== 'BEFORE' ||
      !trgUpdate.ACTION_STATEMENT.includes('45000') ||
      !trgUpdate.ACTION_STATEMENT.includes('immutable')
    ) {
      errors.push(`Missing or invalid trigger 'trg_user_verification_audit_no_update': ${JSON.stringify(trgUpdate)}`);
    }

    const trgDelete = trgMap.get('trg_user_verification_audit_no_delete');
    if (
      !trgDelete ||
      trgDelete.EVENT_OBJECT_TABLE !== 'user_verification_audit' ||
      trgDelete.EVENT_MANIPULATION !== 'DELETE' ||
      trgDelete.ACTION_TIMING !== 'BEFORE' ||
      !trgDelete.ACTION_STATEMENT.includes('45000') ||
      !trgDelete.ACTION_STATEMENT.includes('immutable')
    ) {
      errors.push(`Missing or invalid trigger 'trg_user_verification_audit_no_delete': ${JSON.stringify(trgDelete)}`);
    }

    console.log('====================================================');
    if (errors.length > 0) {
      console.error(`VERIFICATION FAILED: Detected ${errors.length} issue(s):`);
      for (const err of errors) {
        console.error(`  - [ERROR] ${err}`);
      }
      console.log('====================================================');
      process.exit(1);
    } else {
      console.log('VERIFICATION SUCCESSFUL: All tables, columns, constraints, indexes, triggers, and zero-data invariants verified.');
      console.log('====================================================');
    }
  } catch (error: any) {
    console.error('Verification script crashed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

verifyDatabase();
