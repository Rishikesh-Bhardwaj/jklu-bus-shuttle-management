-- Migration 009: Create Feedback Table
-- Purpose: University shuttle feedback, ratings, and administrative review moderation

CREATE TABLE IF NOT EXISTS feedback (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    rating TINYINT NOT NULL,
    review_text TEXT NOT NULL,
    moderation_status ENUM('PUBLISHED', 'HIDDEN') NOT NULL DEFAULT 'PUBLISHED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_feedback_published (moderation_status, created_at),
    CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

