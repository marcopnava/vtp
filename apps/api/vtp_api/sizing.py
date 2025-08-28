# /Users/marconava/Desktop/vtp/apps/api/vtp_api/sizing.py

import math
from fastapi import APIRouter, HTTPException
from .schemas import SizingRequest, SizingResponse

router = APIRouter()

def _round_down_to_step(value: float, step: float) -> float:
    """Arrotonda verso il basso al più vicino multiplo di step."""
    if step <= 0:
        return value
    steps = math.floor(value / step)
    return round(steps * step, 8)

@router.post("/calc", response_model=SizingResponse)
def calc_lot(req: SizingRequest) -> SizingResponse:
    """
    Calcola i lotti a partire da:
    - risk_mode: fixed | percent_balance | percent_equity
    - risk_value: € (se fixed) o % (se percent_*)
    - stop_distance + slippage: in PREZZO (non pip)
    - instrument: tick_size (prezzo/tick), tick_value (€/tick @ 1 lot), min/step/max lot
    """
    inst = req.instrument

    # 1) Risk amount in EUR
    if req.risk_mode == "fixed":
        risk_amount = req.risk_value
    elif req.risk_mode == "percent_balance":
        if req.balance is None or req.balance <= 0:
            raise HTTPException(status_code=400, detail="balance richiesto con percent_balance")
        risk_amount = req.balance * (req.risk_value / 100.0)
    elif req.risk_mode == "percent_equity":
        if req.equity is None or req.equity <= 0:
            raise HTTPException(status_code=400, detail="equity richiesto con percent_equity")
        risk_amount = req.equity * (req.risk_value / 100.0)
    else:
        raise HTTPException(status_code=400, detail="risk_mode non valido")

    # 2) Per-lot risk (EUR)
    total_distance = req.stop_distance + req.slippage
    if total_distance <= 0:
        raise HTTPException(status_code=400, detail="stop_distance + slippage deve essere > 0")

    if inst.tick_size <= 0 or inst.tick_value <= 0:
        raise HTTPException(status_code=400, detail="tick_size e tick_value devono essere > 0")

    ticks = total_distance / inst.tick_size
    per_lot_risk = ticks * inst.tick_value  # EUR

    if per_lot_risk <= 0:
        raise HTTPException(status_code=400, detail="per_lot_risk non valido (controlla tick_size/tick_value)")

    # 3) Raw lots (non arrotondati)
    raw_lots = risk_amount / per_lot_risk

    # 4) Clamp & rounding a step, rispettando min/max lot
    warnings = []
    lots = raw_lots

    # applica max_lot se presente
    if inst.max_lot is not None:
        if lots > inst.max_lot:
            lots = inst.max_lot
            warnings.append(f"Cap applicato: max_lot={inst.max_lot}")

    # rispetta min_lot
    if lots < inst.min_lot:
        lots = inst.min_lot
        warnings.append(f"Aumentato a min_lot={inst.min_lot}")

    # arrotonda verso il basso allo step
    rounded = _round_down_to_step(lots, inst.lot_step)

    # assicurati di non scendere sotto min_lot dopo il round
    if rounded < inst.min_lot:
        # riallinea al multiplo di step >= min_lot
        rounded = round(math.ceil(inst.min_lot / inst.lot_step) * inst.lot_step, 8)
        warnings.append("Allineato allo step sopra min_lot")

    risk_at_suggested = rounded * per_lot_risk

    return SizingResponse(
        suggested_lots=round(raw_lots, 8),
        rounded_to_step=rounded,
        per_lot_risk=round(per_lot_risk, 8),
        risk_at_suggested=round(risk_at_suggested, 8),
        warnings=warnings
    )
