CREATE TABLE IF NOT EXISTS territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    average_pace DOUBLE PRECISION,
    color TEXT,
    left_top_corner_lat DOUBLE PRECISION NOT NULL,
    left_top_corner_lng DOUBLE PRECISION NOT NULL,
    right_top_corner_lat DOUBLE PRECISION NOT NULL,
    right_top_corner_lng DOUBLE PRECISION NOT NULL,
    left_bottom_corner_lat DOUBLE PRECISION NOT NULL,
    left_bottom_corner_lng DOUBLE PRECISION NOT NULL,
    right_bottom_corner_lat DOUBLE PRECISION NOT NULL,
    right_bottom_corner_lng DOUBLE PRECISION NOT NULL,
    deleted_at TIMESTAMP DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
