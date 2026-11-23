-- Migration 005: Create Trips Table
-- Purpose: Scheduled shuttle services, bus/driver assignments, categories, and direction consistency

CREATE TABLE IF NOT EXISTS trips (
    trip_id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    direction ENUM('OUTBOUND', 'RETURN') NOT NULL,
    bus_id INT NOT NULL,
    driver_id INT NULL,
    trip_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    estimated_arrival_time TIME NULL,
    trip_category ENUM('STANDARD', 'EXTRA') NOT NULL DEFAULT 'STANDARD',
    trip_status ENUM('SCHEDULED', 'PUBLISHED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_trip_route_direction 
        FOREIGN KEY (route_id, direction) 
        REFERENCES routes(route_id, direction) 
        ON DELETE RESTRICT,
    FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE RESTRICT,
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE SET NULL,
    UNIQUE KEY uq_trip_bus (trip_id, bus_id),
    UNIQUE KEY uq_trip_route (trip_id, route_id),
    INDEX idx_trip_search (trip_date, direction, trip_category, trip_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

