# apps/api/vtp_api/routers.py
from fastapi import APIRouter

api_router = APIRouter()

# --- Router obbligatorio: coda di esecuzione ---
from . import queue as queue_mod
api_router.include_router(queue_mod.router)

# --- Router opzionali (montati se presenti) ---
try:
    from . import sizing as sizing_mod      # /sizing/*
    api_router.include_router(sizing_mod.router)
except Exception:
    pass

try:
    from . import copy as copy_mod          # /copy/preview, /copy/execute, ecc.
    api_router.include_router(copy_mod.router)
except Exception:
    pass

try:
    from . import prices as prices_mod      # /prices/ingest, /prices/latest (se esiste)
    api_router.include_router(prices_mod.router)
except Exception:
    pass
