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
        "limit": {
            "type": "string",
            "pattern": r"^\d+$",
        },
    },
    "required": [],
    "additionalProperties": True,
}
