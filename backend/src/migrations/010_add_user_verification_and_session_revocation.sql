-- ====================================================================================
-- Migration 010: Add Affiliation Verification, Token Versioning, and Immutable Audit Trail
-- ====================================================================================
-- REFERENCE SPECIFICATION & ARCHITECTURAL DOCUMENTATION:
--
-- 1. Executable Source of Truth:
--    The authoritative executable source of truth for Migration 010 is the TypeScript
--    implementation in `backend/scripts/migrate.ts` (`applyMigration010()`).
--    This SQL file is maintained as a declarative schema reference and documentation artifact.
--    It is NOT executed directly by the migration runner.
--
-- 2. Audit Trail Protection & Database Privilege Separation:
--    - The triggers below (`trg_user_verification_audit_no_update` and
--      `trg_user_verification_audit_no_delete`) enforce database-level immutability against
--      ordinary DML operations (UPDATE and DELETE) from the application layer.
--    - Application Runtime Database Account: Must be granted only the minimum required DML
--      privileges (SELECT, INSERT, UPDATE on permitted operational tables; SELECT and INSERT
--      ONLY on `user_verification_audit`). It must NOT be granted DELETE or UPDATE on
--      `user_verification_audit`.
--    - Administrative Account Separation: The application runtime account must NEVER possess
--      administrative schema privileges such as DROP, ALTER, TRIGGER, or TRUNCATE.
--    - Administrator Boundary Notice: The triggers do NOT protect against sufficiently
--      privileged database administrators executing DDL operations (such as TRUNCATE TABLE,
--      DROP TRIGGER, or DROP TABLE). Administrative-level protection requires strict
--      database role separation, DBA audit logging, and read-only replica archiving.
--
-- The four steps below represent the reference DDL operations executed by the runner:
--   Step 1: ALTER TABLE users (5 columns, index idx_user_verification, FK fk_user_reviewed_by)
--   Step 2: CREATE TABLE user_verification_audit (7 columns, PK, 2 FKs with RESTRICT, 3 indexes)
--   Step 3: CREATE TRIGGER trg_user_verification_audit_no_update (DML UPDATE protection)
--   Step 4: CREATE TRIGGER trg_user_verification_audit_no_delete (DML DELETE protection)
-- ====================================================================================

-- Step 1: Alter users table with verification snapshot and session token version
ALTER TABLE users
ADD COLUMN verification_status ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING' AFTER account_status,
ADD COLUMN token_version INT NOT NULL DEFAULT 1 AFTER verification_status,
ADD COLUMN verification_reviewed_by_user_id INT NULL AFTER token_version,
ADD COLUMN verification_reviewed_at TIMESTAMP NULL AFTER verification_reviewed_by_user_id,
ADD COLUMN verification_notes VARCHAR(255) NULL AFTER verification_reviewed_at,
ADD INDEX idx_user_verification (verification_status),
ADD CONSTRAINT fk_user_reviewed_by FOREIGN KEY (verification_reviewed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL;

-- Step 2: Create immutable audit table to preserve complete history of verification decisions
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Database-level immutability enforcement: Prevent UPDATE operations on audit log
CREATE TRIGGER trg_user_verification_audit_no_update
BEFORE UPDATE ON user_verification_audit
FOR EACH ROW
SIGNAL SQLSTATE '45000'
SET MESSAGE_TEXT = 'user_verification_audit records are immutable and cannot be updated.';

-- Step 4: Database-level immutability enforcement: Prevent DELETE operations on audit log
CREATE TRIGGER trg_user_verification_audit_no_delete
BEFORE DELETE ON user_verification_audit
FOR EACH ROW
SIGNAL SQLSTATE '45000'
SET MESSAGE_TEXT = 'user_verification_audit records are immutable and cannot be deleted.';
