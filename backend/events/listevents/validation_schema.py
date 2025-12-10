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
        "show_upcoming_events": {
            "type": "boolean",
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
