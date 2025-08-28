# /Users/marconava/Desktop/vtp/apps/api/vtp_api/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# importa il router del calcolatore lotti (lo creeremo nel prossimo file)
try:
    from .sizing import router as sizing_router
except Exception:
    sizing_router = None

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

# monta il router del calcolatore lotti se presente
if sizing_router:
    app.include_router(sizing_router, prefix="/sizing", tags=["sizing"])
