-- Migration 003: Create Drivers Table
-- Purpose: Transport staff records and driver operational status

CREATE TABLE IF NOT EXISTS drivers (
    driver_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_name VARCHAR(100) NOT NULL,
    licence_number VARCHAR(50) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

