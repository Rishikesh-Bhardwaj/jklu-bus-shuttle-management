-- Migration 006: Create Bookings Table
-- Purpose: Ticket reservations, historical booking audit trail, and boarding stop validation

CREATE TABLE IF NOT EXISTS bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    trip_id INT NOT NULL,
    route_id INT NOT NULL,
    seat_id INT NOT NULL,
    boarding_stop_id INT NOT NULL,
    booking_status ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    booking_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP NULL,
    cancellation_reason VARCHAR(255) NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (seat_id) REFERENCES seats(seat_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_trip_route 
        FOREIGN KEY (trip_id, route_id) 
        REFERENCES trips(trip_id, route_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_booking_route_stop 
        FOREIGN KEY (route_id, boarding_stop_id) 
        REFERENCES route_stops(route_id, stop_id) 
        ON DELETE RESTRICT,
    UNIQUE KEY uq_booking_integrity (booking_id, trip_id, user_id, seat_id),
    INDEX idx_booking_user (user_id),
    INDEX idx_booking_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

