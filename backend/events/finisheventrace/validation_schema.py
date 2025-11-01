schema = {
    "type": "object",
    "properties": {
        "ticket_id": {
            "type": "string",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",  # uuid check, format uuid doesn't work
        },
        "km_long": {
            "type": "number",
            "minimum": 0,
        },
        "number_of_steps": {
            "type": "number",
            "minimum": 0,
        },
        "duration_in_seconds": {
            "type": "number",
            "minimum": 0,
        },
        "checkpoints": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "address": {"type": "string"},
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                    "is_start": {"type": "boolean"},
                    "is_end": {"type": "boolean"},
                },
                "required": [
                    "address",
                    "lat",
                    "lng",
                    "is_start",
                    "is_end",
                ],
                "additionalProperties": False,
            },
            "minItems": 2,
        },
    },
    "required": [
        "ticket_id",
        "km_long",
        "number_of_steps",
        "duration_in_seconds",
        "checkpoints",
    ],
    "additionalProperties": False,
}

path_params_schema = {
    "type": "object",
    "properties": {
        "event_id": {
            "type": "string",
            "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",  # uuid check, format uuid doesn't work
        }
    },
    "required": ["event_id"],
    "additionalProperties": False,
}
