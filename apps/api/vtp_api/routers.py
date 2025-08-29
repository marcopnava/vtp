# apps/api/vtp_api/routers.py
from fastapi import APIRouter, HTTPException, Header
from typing import Dict, Any, Optional, List
import os
import time

router = APIRouter()

# ============ SIZING ============

@router.post("/sizing/calc")
def sizing_calc(payload: Dict[str, Any]):
    """
    payload atteso:
    {
      "risk_mode": "fixed" | "%equity" | "%balance",
      "risk_value": <float>,
      "balance": <float>,
      "equity": <float>,
      "stop_distance": <float>,  # in prezzo
      "slippage": <float>,       # in prezzo
      "instrument": {
        "symbol": "EURUSD",
        "tick_size": 0.0001,
        "tick_value": 10,
        "min_lot": 0.01,
        "lot_step": 0.01,
        "max_lot": 50
      }
    }
    """
    try:
      inst = payload["instrument"]
      tick_size = float(inst["tick_size"])
      tick_value = float(inst["tick_value"])
      lot_step  = float(inst["lot_step"])
      min_lot   = float(inst["min_lot"])
      max_lot   = float(inst["max_lot"])
      stop_distance = float(payload.get("stop_distance", 0.0)) + float(payload.get("slippage", 0.0))

      # rischio per ogni 1.00 lot
      # NB: rischio = (stop_distance / tick_size) * tick_value
      per_lot_risk = (stop_distance / tick_size) * tick_value

      # quanto rischio voglio mettere in €
      risk_mode  = str(payload.get("risk_mode","fixed"))
      risk_value = float(payload.get("risk_value", 0.0))
      balance    = float(payload.get("balance", 0.0) or 0.0)
      equity     = float(payload.get("equity", 0.0) or 0.0)

      if risk_mode == "%equity":
          risk_eur = equity * (risk_value/100.0)
      elif risk_mode == "%balance":
          risk_eur = balance * (risk_value/100.0)
      else:
          risk_eur = risk_value

      if per_lot_risk <= 0:
          return {"suggested_lots": 0.0, "rounded_to_step": 0.0, "per_lot_risk": per_lot_risk, "risk_at_suggested": 0.0, "warnings": ["per_lot_risk <= 0"]}

      suggested = risk_eur / per_lot_risk
      # round a step
      rounded = round(suggested / lot_step) * lot_step
      # clamp min/max
      rounded = max(min_lot, min(rounded, max_lot))

      return {
          "suggested_lots": suggested,
          "rounded_to_step": round(rounded, 6),
          "per_lot_risk": per_lot_risk,
          "risk_at_suggested": per_lot_risk * rounded,
          "warnings": []
      }
    except Exception as e:
      raise HTTPException(status_code=400, detail=f"sizing_calc error: {e}")

# ============ COPY TRADING PREVIEW/EXECUTE ============

def _round_to_step(x: float, step: float) -> float:
    if step <= 0: return x
    return round(x/step) * step

def _apply_rule(master_lot: float, base_master: float, follower: Dict[str, Any]) -> float:
    """
    Regole supportate:
    - proportional { base: equity|balance, multiplier }
    - fixed { lots }
    - lot_per_10k { base: equity|balance, lots_per_10k }
    """
    rule = follower.get("rule", {}) or {}
    t = rule.get("type")
    if t == "fixed":
        return float(rule.get("lots", 0.0))
    base = str(rule.get("base", "equity"))
    if t == "proportional":
        mult = float(rule.get("multiplier", 1.0))
        fbase = float(follower.get(base, 0.0) or 0.0)
        return master_lot * (fbase / (base_master or 1.0)) * mult
    if t == "lot_per_10k":
        lots_per_10k = float(rule.get("lots_per_10k", 0.0))
        fbase = float(follower.get(base, 0.0) or 0.0)
        return (fbase/10000.0) * lots_per_10k
    return 0.0

@router.post("/copy/preview")
def copy_preview(payload: Dict[str, Any]):
    try:
        inst = payload["instrument"]
        lot_step = float(inst["lot_step"]); min_lot=float(inst["min_lot"]); max_lot=float(inst["max_lot"])
        master = payload["master_order"]
        master_lot = float(master["lot"])
        base_master = float(payload["master_info"].get("equity", 0.0))
        followers: List[Dict[str, Any]] = payload.get("followers", [])

        previews = []
        total_raw = 0.0
        total_rounded = 0.0
        for f in followers:
            if not f.get("enabled", True):
                continue
            raw = _apply_rule(master_lot, base_master, f)
            rounded = _round_to_step(raw, lot_step)
            rounded = max(min_lot, min(rounded, max_lot))
            previews.append({
                "follower_id": f.get("id"),
                "follower_name": f.get("name"),
                "raw_lot": round(raw, 6),
                "rounded_lot": round(rounded, 6),
                "warnings": []
            })
            total_raw += raw
            total_rounded += rounded

        return {
            "symbol": master.get("symbol"),
            "side": master.get("side"),
            "master_lot": master_lot,
            "total_followers": len(previews),
            "total_lots_raw": round(total_raw, 6),
            "total_lots_rounded": round(total_rounded, 6),
            "previews": previews
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"copy_preview error: {e}")

@router.post("/copy/execute")
def copy_execute(payload: Dict[str, Any]):
    """
    DRY_RUN: genera un execution_plan identico al preview con metadata.
    payload identico a /copy/preview. Aggiungi facoltativo: {"dry_run": true}
    """
    try:
        dry_run = bool(payload.get("dry_run", True))
        preview = copy_preview(payload)  # riuso la logica
        plan = {
            "ts": int(time.time()),
            "symbol": preview["symbol"],
            "side": preview["side"],
            "master_lot": preview["master_lot"],
            "total_lots": preview["total_lots_rounded"],
            "entries": [
                {
                    "follower_id": p["follower_id"],
                    "follower_name": p["follower_name"],
                    "lot": p["rounded_lot"],
                    "status": "planned"
                }
                for p in preview["previews"]
            ]
        }
        # live non implementata: torniamo comunque DRY_RUN
        return {
            "mode": "DRY_RUN" if dry_run else "LIVE_NOT_IMPLEMENTED",
            "execution_plan": plan
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"copy_execute error: {e}")

# ============ PRICES ============

PRICES: Dict[str, Dict[str, Any]] = {}  # memoria volatile

def _require_api_key(x_api_key: Optional[str]):
    expected = os.environ.get("PRICE_API_KEY", "dev")
    if not x_api_key or x_api_key != expected:
        raise HTTPException(status_code=401, detail="invalid api key")

@router.post("/prices/ingest")
def prices_ingest(body: Dict[str, Any], x_api_key: Optional[str] = Header(None, convert_underscores=False)):
    """
    headers: X-API-KEY: <token>
    body: { "symbol":"EURUSD", "bid":1.12345, "ask":1.12358, "ts": 1693242343 }
    """
    _require_api_key(x_api_key)
    sym = str(body.get("symbol","")).upper()
    if not sym: raise HTTPException(status_code=400, detail="symbol required")
    bid = float(body.get("bid", 0.0)); ask = float(body.get("ask", 0.0))
    ts  = int(body.get("ts", time.time()))
    PRICES[sym] = {"symbol": sym, "bid": bid, "ask": ask, "ts": ts}
    return {"ok": True, "stored": PRICES[sym]}

@router.get("/prices/latest")
def prices_latest(symbol: Optional[str] = None):
    if symbol:
        s = symbol.upper()
        return PRICES.get(s, {"symbol": s, "bid": None, "ask": None, "ts": None})
    return {"items": list(PRICES.values())}
