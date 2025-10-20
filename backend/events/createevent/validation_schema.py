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
                    "start": {"type": "boolean"},
                    "end": {"type": "boolean"},
                },
                "required": [
                    "address",
                    "lat",
                    "lng",
                    "start",
                    "end",
                ],
                "additionalProperties": False,
            },
            "minItems": 2,
        },
    },
    "required": [
        "name",
        "city",
        "date",
        "startTime",
        "checkpoints",
    ],
    "additionalProperties": False,
}
