-- Migration 007: Create Trip Seat Reservations Table
-- Purpose: Concurrency-safe active seat locks, double-booking prevention, and bus-seat integrity

CREATE TABLE IF NOT EXISTS trip_seat_reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    trip_id INT NOT NULL,
    user_id INT NOT NULL,
    seat_id INT NOT NULL,
    bus_id INT NOT NULL,
    reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_active_trip_seat (trip_id, seat_id),
    UNIQUE KEY uq_active_trip_user (trip_id, user_id),
    CONSTRAINT fk_res_booking_integrity 
        FOREIGN KEY (booking_id, trip_id, user_id, seat_id) 
        REFERENCES bookings(booking_id, trip_id, user_id, seat_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_res_trip_bus 
        FOREIGN KEY (trip_id, bus_id) 
        REFERENCES trips(trip_id, bus_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_res_seat_bus 
        FOREIGN KEY (seat_id, bus_id) 
        REFERENCES seats(seat_id, bus_id) 
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

