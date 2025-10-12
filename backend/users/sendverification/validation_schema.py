schema = {
    "type": "object",
    "properties": {
        "email": {
            "type": "string",
            "format": "email",
        },
        "confirmation_code": {
            "type": "string",
            "minLength": 6,
            "maxLength": 6,
            "pattern": "^[0-9]{6}$",
        },
    },
    "required": [
        "email",
        "confirmation_code",
    ],
    "additionalProperties": False,
}
