# /Users/marconava/Desktop/vtp/apps/api/vtp_api/schemas.py

from typing import Optional, Literal, List
from pydantic import BaseModel, Field


class InstrumentSpec(BaseModel):
    """
    Specifiche dello strumento necessarie per il sizing:
    - tick_size: dimensione di 1 tick di prezzo (es. EURUSD 0.0001 a 4 cifre / 0.00001 a 5 cifre)
    - tick_value: valore in EUR di 1 tick @ 1 lotto
    - min_lot, lot_step, max_lot: vincoli di volume dello strumento
    """
    symbol: str = Field(..., description="Es: EURUSD, XAUUSD")
    tick_size: float = Field(..., gt=0, description="Granularità prezzo per tick")
    tick_value: float = Field(..., gt=0, description="Valore per 1 tick a 1 lotto (EUR)")
    min_lot: float = Field(0.01, gt=0, description="Volume minimo per ordine")
    lot_step: float = Field(0.01, gt=0, description="Incremento consentito dei lotti")
    max_lot: Optional[float] = Field(None, description="Volume massimo per ordine (opzionale)")


class SizingRequest(BaseModel):
    """
    Richiesta di calcolo del lottaggio:
    - risk_mode: 'fixed' (EUR), oppure percentuale su Balance o Equity
    - risk_value: importo in EUR (se fixed) o percentuale (se percent_*)
    - balance/equity: richiesti solo se usi la modalità percentuale
    - stop_distance: distanza dello stop in UNITA' DI PREZZO (non pip, proprio prezzo)
    - slippage: margine extra sullo stop in prezzo (es. 0.0002)
    - instrument: specifiche strumento (tick_size, tick_value, step, ecc.)
    """
    risk_mode: Literal["fixed", "percent_balance", "percent_equity"]
    risk_value: float = Field(..., gt=0, description="€ se fixed, altrimenti percentuale")
    balance: Optional[float] = Field(None, gt=0)
    equity: Optional[float] = Field(None, gt=0)
    stop_distance: float = Field(..., gt=0, description="Distanza stop in prezzo")
    slippage: float = Field(0.0, ge=0, description="Margine extra in prezzo")
    instrument: InstrumentSpec


class SizingResponse(BaseModel):
    """
    Risposta del calcolatore:
    - suggested_lots: lotti grezzi (senza arrotondamento)
    - rounded_to_step: lotti arrotondati allo step e clampati tra min/max
    - per_lot_risk: rischio (EUR) per 1 lotto dato lo stop+slippage
    - risk_at_suggested: rischio (EUR) al volume arrotondato
    - warnings: note/avvisi (cap a max_lot, alzato a min_lot, ecc.)
    """
    suggested_lots: float
    rounded_to_step: float
    per_lot_risk: float
    risk_at_suggested: float
    warnings: List[str] = []
