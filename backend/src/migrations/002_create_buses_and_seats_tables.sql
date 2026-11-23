-- Migration 002: Create Buses and Seats Tables
-- Purpose: Vehicle fleet management, physical capacity, and individual seat inventory

CREATE TABLE IF NOT EXISTS buses (
    bus_id INT AUTO_INCREMENT PRIMARY KEY,
    bus_no VARCHAR(20) NOT NULL UNIQUE,
    total_no_of_seats INT NOT NULL,
    status ENUM('ACTIVE', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_bus_capacity CHECK (total_no_of_seats > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seats (
    seat_id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE RESTRICT,
    UNIQUE KEY uq_bus_seat_number (bus_id, seat_number),
    UNIQUE KEY uq_seat_bus (seat_id, bus_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

