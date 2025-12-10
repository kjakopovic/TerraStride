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
        "username": {
            "type": "string",
            "maxLength": 50,
        },
        "passcode": {
            "type": "string",
            "pattern": "^[0-9]{6}$",
        },
    },
    "required": [
        "email",
        "password",
        "username",
        "passcode",
    ],
    "additionalProperties": False,
}
