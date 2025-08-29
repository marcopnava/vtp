# apps/api/vtp_api/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import api_router

def _cors_origins():
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [x.strip() for x in raw.split(",") if x.strip()]

app = FastAPI(title="VTP API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

app.include_router(api_router)
