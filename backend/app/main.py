"""FastAPI application entry point."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.exceptions import AppException

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    docs_on = settings.ENABLE_DOCS
    application = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        docs_url="/docs" if docs_on else None,
        redoc_url="/redoc" if docs_on else None,
        openapi_url="/openapi.json" if docs_on else None,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @application.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "code": exc.code},
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "code": "INTERNAL_ERROR"},
        )

    @application.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "healthy"}

    from app.routers import auth as auth_router

    application.include_router(auth_router.router)

    from app.routers import stats as stats_router

    application.include_router(stats_router.router)

    from app.routers import games as games_router

    application.include_router(games_router.router)

    return application


app = create_app()
