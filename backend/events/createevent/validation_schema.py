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
