# /Users/marconava/Desktop/vtp/apps/api/vtp_api/routers.py
import math
from fastapi import APIRouter
from .schemas import (
    CopyPreviewRequest, CopyPreviewResponse, FollowerPreview,
    SizingRequest, SizingResponse
)

router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True}


# ---------- /sizing/calc ----------
@router.post("/sizing/calc", response_model=SizingResponse)
def sizing_calc(req: SizingRequest) -> SizingResponse:
    inst = req.instrument
    warnings = []

    # budget rischio
    if req.risk_mode == "fixed":
        budget = req.risk_value
    elif req.risk_mode == "percent_balance":
        if not req.balance or req.balance <= 0:
            return SizingResponse(suggested_lots=0, rounded_to_step=0, per_lot_risk=0, risk_at_suggested=0, warnings=["balance mancante/<=0"])
        budget = req.balance * (req.risk_value / 100.0)
    else:  # percent_equity
        if not req.equity or req.equity <= 0:
            return SizingResponse(suggested_lots=0, rounded_to_step=0, per_lot_risk=0, risk_at_suggested=0, warnings=["equity mancante/<=0"])
        budget = req.equity * (req.risk_value / 100.0)

    per_lot_ticks = (req.stop_distance + max(req.slippage, 0.0)) / inst.tick_size
    per_lot_risk = per_lot_ticks * inst.tick_value  # EUR per 1 lot
    if per_lot_risk <= 0:
        return SizingResponse(suggested_lots=0, rounded_to_step=0, per_lot_risk=0, risk_at_suggested=0, warnings=["per_lot_risk <= 0"])

    suggested_lots = budget / per_lot_risk

    # round down a step
    step = inst.lot_step if inst.lot_step > 0 else 0.01
    rounded = math.floor(suggested_lots / step) * step
    if rounded < inst.min_lot and suggested_lots > 0:
        warnings.append(f"lot < min_lot, alzato a {inst.min_lot}")
        rounded = inst.min_lot
    if inst.max_lot and rounded > inst.max_lot:
        warnings.append(f"lot > max_lot, limitato a {inst.max_lot}")
        rounded = inst.max_lot

    return SizingResponse(
        suggested_lots=suggested_lots,
        rounded_to_step=rounded,
        per_lot_risk=per_lot_risk,
        risk_at_suggested=rounded * per_lot_risk,
        warnings=warnings,
    )


# ---------- /copy/preview ----------
@router.post("/copy/preview", response_model=CopyPreviewResponse)
def copy_preview(req: CopyPreviewRequest) -> CopyPreviewResponse:
    inst = req.instrument
    step = inst.lot_step if inst.lot_step > 0 else 0.01
    min_lot = inst.min_lot
    max_lot = inst.max_lot

    def round_down(v: float) -> float:
        return max(0.0, math.floor(v / step) * step)

    def clamp(v: float) -> tuple[float, list[str]]:
        warns = []
        out = v
        if out > 0 and out < min_lot:
            warns.append(f"lot < min_lot, alzato a {min_lot}")
            out = min_lot
        if max_lot is not None and out > max_lot:
            warns.append(f"lot > max_lot, limitato a {max_lot}")
            out = max_lot
        return out, warns

    # helper per base value
    def base_value(x_base: str, bal: float, eq: float) -> float:
        return eq if x_base == "equity" else bal

    previews: list[FollowerPreview] = []
    total_raw = 0.0
    total_rounded = 0.0
    total_followers = 0

    master_bal = req.master_info.balance
    master_eq = req.master_info.equity

    for f in req.followers:
        warnings: list[str] = []
        raw = 0.0
        if not f.enabled:
            previews.append(FollowerPreview(
                follower_id=f.id, follower_name=f.name, raw_lot=0.0, rounded_lot=0.0,
                warnings=["disabled"]
            ))
            continue

        r = f.rule
        if r.type == "proportional":
            follower_base = base_value(r.base, f.balance, f.equity)
            master_base = base_value(r.base, master_bal, master_eq)
            if master_base <= 0:
                warnings.append("master base <= 0")
                raw = 0.0
            else:
                raw = req.master_order.lot * (follower_base / master_base) * r.multiplier
        elif r.type == "fixed":
            raw = max(0.0, r.lots)
        else:  # lot_per_10k
            b = base_value(r.base, f.balance, f.equity)
            unit = r.unit if r.unit > 0 else 10_000.0
            raw = (b / unit) * r.lots_per_unit

        if raw < 0:
            warnings.append("lot negativo corretto a 0")
            raw = 0.0

        rounded = round_down(raw)
        if rounded != raw:
            warnings.append(f"rounded down by step {step}")

        rounded, limit_warns = clamp(rounded)
        warnings.extend(limit_warns)

        total_followers += 1
        total_raw += raw
        total_rounded += rounded

        previews.append(FollowerPreview(
            follower_id=f.id,
            follower_name=f.name,
            raw_lot=round(raw, 6),
            rounded_lot=round(rounded, 6),
            warnings=warnings
        ))

    return CopyPreviewResponse(
        symbol=req.master_order.symbol,
        side=req.master_order.side,
        master_lot=req.master_order.lot,
        total_followers=total_followers,
        total_lots_raw=round(total_raw, 6),
        total_lots_rounded=round(total_rounded, 6),
        previews=previews
    )
