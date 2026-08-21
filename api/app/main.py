"""Honeypot SOC API - FastAPI application entry point.

Exposes the SOC data (events, overview, MITRE, geo, malware/IoCs) behind
session-JWT auth, plus public health endpoints. Routers are mounted under
/api/v1. CORS is enabled only for localhost development origins.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db
from .routers import auth as auth_router
from .routers import automation as automation_router
from .routers import events as events_router
from .routers import geo as geo_router
from .routers import health as health_router
from .routers import live as live_router
from .routers import malware as malware_router
from .routers import mitre as mitre_router
from .routers import overview as overview_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.create_pool()
    yield
    await db.close_pool()


def create_app() -> FastAPI:
    application = FastAPI(
        title="Honeypot SOC API",
        version="1.0.0",
        description="Consola web del SOC: eventos, métricas, MITRE, geo, malware/IoCs y automatización.",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=config.settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health_router.router, prefix="/api/v1", tags=["health"])
    application.include_router(auth_router.router, prefix="/api/v1", tags=["auth"])
    application.include_router(overview_router.router, prefix="/api/v1", tags=["overview"])
    application.include_router(live_router.router, prefix="/api/v1", tags=["events"])
    application.include_router(events_router.router, prefix="/api/v1", tags=["events"])
    application.include_router(mitre_router.router, prefix="/api/v1", tags=["mitre"])
    application.include_router(geo_router.router, prefix="/api/v1", tags=["geo"])
    application.include_router(malware_router.router, prefix="/api/v1", tags=["malware"])
    application.include_router(
        automation_router.router, prefix="/api/v1", tags=["automation"]
    )
    return application


app = create_app()