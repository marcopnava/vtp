# /Users/marconava/Desktop/vtp/apps/api/vtp_api/routers.py

from typing import List, Optional, Literal, Annotated, Union
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import math

# ---------------------------
# Helpers
# ---------------------------
def _round_down_to_step(value: float, step: float) -> float:
    if step <= 0:
        return value
    steps = math.floor(value / step)
    return round(steps * step, 8)

def _apply_lot_bounds_and_round(raw_lots: float, min_lot: float, lot_step: float, max_lot: Optional[float]) -> (float, float, list):
    warnings = []
    lots = raw_lots

    if max_lot is not None and lots > max_lot:
        warnings.append(f"Cap applicato: max_lot={max_lot}")
        lots = max_lot

    if lots < min_lot:
        warnings.append(f"Aumentato a min_lot={min_lot}")
        lots = min_lot

    rounded = _round_down_to_step(lots, lot_step)

    if rounded < min_lot:
        rounded = round(math.ceil(min_lot / lot_step) * lot_step, 8)
        warnings.append("Allineato allo step sopra min_lot")

    return lots, rounded, warnings

# ---------------------------
# Schemi Pydantic (richiesta/risposta)
# ---------------------------

class InstrumentSpec(BaseModel):
    symbol: str
    tick_size: float = Field(..., gt=0)
    tick_value: float = Field(..., gt=0)  # EUR per tick @ 1 lot
    min_lot: float = Field(0.01, gt=0)
    lot_step: float = Field(0.01, gt=0)
    max_lot: Optional[float] = None

class MasterInfo(BaseModel):
    balance: float = Field(..., gt=0)
    equity: float = Field(..., gt=0)

class MasterOrder(BaseModel):
    symbol: str
    side: Literal["buy", "sell"]
    lot: float = Field(..., gt=0)
    sl: Optional[float] = None
    tp: Optional[float] = None
    comment: Optional[str] = None

class ProportionalRule(BaseModel):
    type: Literal["proportional"] = "proportional"
    base: Literal["balance", "equity"] = "equity"
    multiplier: float = Field(1.0, gt=0)

class FixedRule(BaseModel):
    type: Literal["fixed"] = "fixed"
    lots: float = Field(..., gt=0)

class LotPerUnitRule(BaseModel):
    type: Literal["lot_per_10k"] = "lot_per_10k"
    base: Literal["balance", "equity"] = "equity"
    lots_per_unit: float = Field(..., gt=0, description="lotti per unità (es. per 10k)")
    unit: float = Field(10000.0, gt=0, description="unità di base, es. 10000 EUR")

Rule = Annotated[Union[ProportionalRule, FixedRule, LotPerUnitRule], Field(discriminator="type")]

class FollowerAccount(BaseModel):
    id: str
    name: Optional[str] = None
    balance: float = Field(..., gt=0)
    equity: float = Field(..., gt=0)
    rule: Rule
    enabled: bool = True

class CopyPreviewRequest(BaseModel):
    instrument: InstrumentSpec
    master_info: MasterInfo
    master_order: MasterOrder
    followers: List[FollowerAccount]

class FollowerPreview(BaseModel):
    follower_id: str
    follower_name: Optional[str] = None
    raw_lot: float
    rounded_lot: float
    warnings: List[str] = []

class CopyPreviewResponse(BaseModel):
    symbol: str
    side: Literal["buy", "sell"]
    master_lot: float
    total_followers: int
    total_lots_raw: float
    total_lots_rounded: float
    previews: List[FollowerPreview] = []

router = APIRouter()

# ---------------------------
# Logica di sizing per regola
# ---------------------------

def _compute_raw_lot_for_follower(rule: Rule, master_lot: float, master_info: MasterInfo, fol_balance: float, fol_equity: float) -> float:
    if isinstance(rule, ProportionalRule):
        if rule.base == "equity":
            base_master = master_info.equity
            base_fol = fol_equity
        else:
            base_master = master_info.balance
            base_fol = fol_balance

        if base_master <= 0:
            raise HTTPException(status_code=400, detail=f"Master {rule.base} deve essere > 0")
        return master_lot * (base_fol / base_master) * rule.multiplier

    if isinstance(rule, FixedRule):
        return rule.lots

    if isinstance(rule, LotPerUnitRule):
        base = fol_equity if rule.base == "equity" else fol_balance
        return (base / rule.unit) * rule.lots_per_unit

    # fallback (non dovrebbe mai accadere)
    raise HTTPException(status_code=400, detail="Regola non riconosciuta")

# ---------------------------
# Endpoint: /copy/preview
# ---------------------------

@router.post("/copy/preview", response_model=CopyPreviewResponse)
def copy_preview(payload: CopyPreviewRequest) -> CopyPreviewResponse:
    inst = payload.instrument
    mo = payload.master_order
    mi = payload.master_info

    previews: List[FollowerPreview] = []
    sum_raw = 0.0
    sum_rounded = 0.0
    count = 0

    for f in payload.followers:
        if not f.enabled:
            continue
        raw = _compute_raw_lot_for_follower(
            f.rule, mo.lot, mi, f.balance, f.equity
        )
        _, rounded, warns = _apply_lot_bounds_and_round(
            raw, inst.min_lot, inst.lot_step, inst.max_lot
        )
        previews.append(FollowerPreview(
            follower_id=f.id,
            follower_name=f.name,
            raw_lot=round(raw, 8),
            rounded_lot=rounded,
            warnings=warns
        ))
        sum_raw += raw
        sum_rounded += rounded
        count += 1

    return CopyPreviewResponse(
        symbol=mo.symbol,
        side=mo.side,
        master_lot=mo.lot,
        total_followers=count,
        total_lots_raw=round(sum_raw, 8),
        total_lots_rounded=round(sum_rounded, 8),
        previews=previews
    )
