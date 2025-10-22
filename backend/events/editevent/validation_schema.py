schema = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "maxLength": 50,
        },
        "city": {
            "type": "string",
            "maxLength": 50,
        },
        "entry_fee": {
            "type": "number",
            "minimum": 0,
        },
        "date": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$",  # YYYY-MM-DD format
        },
        "startTime": {
            "type": "string",
            "pattern": "^\\d{2}:\\d{2}$",  # HH:MM format
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
        "trace": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                },
                "required": [
                    "lat",
                    "lng",
                ],
                "additionalProperties": False,
            },
            "minItems": 1,
        },
    },
    "required": [
        "name",
        "city",
        "date",
        "startTime",
        "checkpoints",
        "trace",
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
