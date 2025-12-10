schema = {
    "type": "object",
    "properties": {
        "territories": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "average_pace": {"type": "string"},
                    "left_top_corner_lat": {"type": "number"},
                    "left_top_corner_lng": {"type": "number"},
                    "left_bottom_corner_lat": {"type": "number"},
                    "left_bottom_corner_lng": {"type": "number"},
                    "right_top_corner_lat": {"type": "number"},
                    "right_top_corner_lng": {"type": "number"},
                    "right_bottom_corner_lat": {"type": "number"},
                    "right_bottom_corner_lng": {"type": "number"},
                    "color": {"type": "string"},
                },
                "required": [
                    "average_pace",
                    "left_top_corner_lat",
                    "left_top_corner_lng",
                    "left_bottom_corner_lat",
                    "left_bottom_corner_lng",
                    "right_top_corner_lat",
                    "right_top_corner_lng",
                    "right_bottom_corner_lat",
                    "right_bottom_corner_lng",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["territories"],
    "additionalProperties": False,
}
