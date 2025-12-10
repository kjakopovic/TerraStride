schema = {
    "type": "object",
    "properties": {
        "email": {
            "type": "string",
            "format": "email",
        },
        "password": {
            "type": "string",
            "minLength": 8,
            "pattern": "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}$",
        },
    },
    "required": [
        "email",
        "password",
    ],
    "additionalProperties": False,
}
