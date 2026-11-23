-- Migration 001: Create Users Table
-- Purpose: Authentication, user accounts, and unified role/specialization hierarchy

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('STUDENT', 'FACULTY', 'MANAGER') NOT NULL,
    student_category ENUM('HOSTELLER', 'DAY_SCHOLAR') NULL,
    phone_number VARCHAR(20) NULL,
    account_status ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    CONSTRAINT chk_student_category_consistency CHECK (
        (role = 'STUDENT' AND student_category IS NOT NULL) OR
        (role != 'STUDENT' AND student_category IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

