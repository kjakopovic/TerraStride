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
        "search": {
            "type": "string",
        },
    },
    "required": [
        "lat",
        "lng",
        "search",
    ],
    "additionalProperties": False,
}
