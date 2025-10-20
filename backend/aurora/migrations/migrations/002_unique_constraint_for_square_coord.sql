ALTER TABLE territories ADD CONSTRAINT unique_square UNIQUE (
    left_top_corner_lat, left_top_corner_lng,
    right_top_corner_lat, right_top_corner_lng,
    left_bottom_corner_lat, left_bottom_corner_lng,
    right_bottom_corner_lat, right_bottom_corner_lng
);
