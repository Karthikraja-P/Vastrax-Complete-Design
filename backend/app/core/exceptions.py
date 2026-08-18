"""Domain exception hierarchy and FastAPI exception handler registration.

All application errors subclass AppException so a single handler can render
them uniformly as JSON ``{"detail": "..."}`` responses.
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base class for all domain-level exceptions."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class NotFoundError(AppException):
    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, detail)


class UnauthorizedError(AppException):
    def __init__(self, detail: str = "Not authenticated") -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, detail)


class ForbiddenError(AppException):
    def __init__(self, detail: str = "Access denied") -> None:
        super().__init__(status.HTTP_403_FORBIDDEN, detail)


class ConflictError(AppException):
    def __init__(self, detail: str = "Resource already exists") -> None:
        super().__init__(status.HTTP_409_CONFLICT, detail)


class BadRequestError(AppException):
    def __init__(self, detail: str = "Bad request") -> None:
        super().__init__(status.HTTP_400_BAD_REQUEST, detail)


class InternalError(AppException):
    def __init__(self, detail: str = "Internal server error") -> None:
        super().__init__(status.HTTP_500_INTERNAL_SERVER_ERROR, detail)


class PaymentRequiredError(AppException):
    def __init__(self, detail: str = "Payment required") -> None:
        super().__init__(status.HTTP_402_PAYMENT_REQUIRED, detail)

# this is global exception handler for all AppException subclasses.
def register_exception_handlers(app: FastAPI) -> None:
    """Attach a single JSON handler for all AppException subclasses."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
