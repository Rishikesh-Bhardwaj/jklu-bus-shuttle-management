-- Migration 011: Add identification_number (Roll Number for Students / Faculty ID for Faculty)
-- Purpose: Required student/faculty identification numbers and unique constraint per role

ALTER TABLE users
ADD COLUMN identification_number VARCHAR(50) NULL AFTER full_name;

ALTER TABLE users
ADD UNIQUE KEY uq_role_identification (role, identification_number);

