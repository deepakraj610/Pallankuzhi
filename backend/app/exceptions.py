"""Custom application exceptions mapped to JSON error responses in main.py."""


class AppException(Exception):
    """Base application error."""

    def __init__(
        self, message: str, code: str = "ERROR", status_code: int = 500
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class NotFoundError(AppException):
    def __init__(self, resource: str) -> None:
        super().__init__(f"{resource} not found", "NOT_FOUND", 404)


class ConflictError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, "CONFLICT", 409)


class BadRequestError(AppException):
    def __init__(self, message: str, code: str = "BAD_REQUEST") -> None:
        super().__init__(message, code, 400)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Invalid credentials") -> None:
        super().__init__(message, "UNAUTHORIZED", 401)


class InvalidMoveError(BadRequestError):
    def __init__(self, message: str) -> None:
        super().__init__(message, "INVALID_MOVE")
