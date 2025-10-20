schema = {
    "type": "object",
    "properties": {
        "lat": {
            "type": "string",
            "pattern": r"^-?\d+\.\d+$",
        },
        "lng": {
            "type": "string",
            "pattern": r"^-?\d+\.\d+$",
        },
    },
    "required": [
        "lat",
        "lng",
    ],
    "additionalProperties": True,
}
