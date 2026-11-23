-- Migration 008: Create Check Ins Table
-- Purpose: Passenger boarding manifest, check-in tracking, and audit-safe boarding history

CREATE TABLE IF NOT EXISTS check_ins (
    booking_id INT PRIMARY KEY,
    boarding_status ENUM('NOT_CHECKED_IN', 'BOARDED', 'NO_SHOW', 'CANCELLED_PRIOR') NOT NULL DEFAULT 'NOT_CHECKED_IN',
    boarded_at TIMESTAMP NULL,
    marked_by_user_id INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT,
    FOREIGN KEY (marked_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

