# /Users/marconava/Desktop/vtp/apps/api/vtp_api/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Routers
from .sizing import router as sizing_router          # /sizing/calc
from .routers import router as copy_preview_router   # /copy/preview

app = FastAPI(
    title="VTP API",
    version="0.1.0",
    description="Backend API per VTP (copy trading & sizing)",
)

# CORS per sviluppo locale (Next.js su localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

# Monta i router
app.include_router(sizing_router, prefix="/sizing", tags=["sizing"])
app.include_router(copy_preview_router, tags=["copy"])
