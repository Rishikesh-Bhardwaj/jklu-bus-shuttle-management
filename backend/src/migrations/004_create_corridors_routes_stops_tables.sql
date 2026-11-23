-- Migration 004: Create Route Corridors, Routes, Stops, and Route Stops
-- Purpose: Transport geography, directional routes, ordered stop sequences, and route pairing

CREATE TABLE IF NOT EXISTS route_corridors (
    corridor_id INT AUTO_INCREMENT PRIMARY KEY,
    corridor_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routes (
    route_id INT AUTO_INCREMENT PRIMARY KEY,
    corridor_id INT NOT NULL,
    paired_return_route_id INT NULL,
    route_name VARCHAR(100) NOT NULL,
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    direction ENUM('OUTBOUND', 'RETURN') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (corridor_id) REFERENCES route_corridors(corridor_id) ON DELETE RESTRICT,
    FOREIGN KEY (paired_return_route_id) REFERENCES routes(route_id) ON DELETE RESTRICT,
    UNIQUE KEY uq_paired_route (paired_return_route_id),
    UNIQUE KEY uq_route_direction (route_id, direction),
    INDEX idx_route_corridor_dir (corridor_id, direction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stops (
    stop_id INT AUTO_INCREMENT PRIMARY KEY,
    stop_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS route_stops (
    route_stop_id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    stop_id INT NOT NULL,
    stop_order INT NOT NULL,
    estimated_offset_minutes INT DEFAULT 0,
    FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE,
    FOREIGN KEY (stop_id) REFERENCES stops(stop_id) ON DELETE RESTRICT,
    UNIQUE KEY uq_route_stop_order (route_id, stop_order),
    UNIQUE KEY uq_route_stop (route_id, stop_id),
    CONSTRAINT chk_stop_order CHECK (stop_order > 0),
    CONSTRAINT chk_offset_minutes CHECK (estimated_offset_minutes >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

