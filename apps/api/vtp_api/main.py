# apps/api/vtp_api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    # il tuo router aggregato (queue/sizing/copy/prices) già creato
    from .routers import api_router
except Exception:
    api_router = None

app = FastAPI(title="VTP API", version="0.1.0")

# CORS di base per il frontend locale
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "ok": True,
        "name": "VTP API",
        "hint": "Usa /health per lo stato, /docs per provare gli endpoint.",
        "endpoints": ["/health", "/docs", "/queue/status", "/copy/queue", "/queue/peek", "/queue/ack"],
    }

@app.get("/health")
def health():
    return {"ok": True}

# Monta i router se presenti
if api_router is not None:
    app.include_router(api_router)
