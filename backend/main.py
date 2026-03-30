from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
import os

from routes.upload import router as upload_router
from routes.process import router as process_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create required directories on startup."""
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("outputs", exist_ok=True)
    yield


app = FastAPI(
    title="PUBG Mobile Showcase Generator",
    description="Auto-generate showcase posters from PUBG Mobile screenshots",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins_env = os.getenv("CORS_ORIGINS", "")
cors_origins = [
    origin.strip()
    for origin in cors_origins_env.split(",")
    if origin.strip()
]

# CORS — allow frontend dev server and configured production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        *cors_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(upload_router)
app.include_router(process_router)

# Mount static directories
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")


@app.get("/")
async def root():
    return {
        "message": "PUBG Mobile Showcase Generator API",
        "docs": "/docs",
        "version": "1.0.0"
    }
