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
