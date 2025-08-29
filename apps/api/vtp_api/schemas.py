# apps/api/vtp_api/schemas.py
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator


Side = Literal["buy", "sell", "close"]


class TradeItemIn(BaseModel):
    account_id: str = Field(..., min_length=1, description="Deve combaciare con ACCOUNT_ID dell'EA")
    symbol: str = Field(..., min_length=1, description="Simbolo canonical lato piattaforma (es. EURUSD, US100, XAUUSD)")
    side: Side = Field(..., description='"buy" | "sell" | "close"')
    lot: float = Field(ge=0, description="Lotti. Per side=close viene ignorato (coerzionato a 0).")
    sl: float = Field(default=0, ge=0, description="Prezzo SL assoluto (0 = nessuno)")
    tp: float = Field(default=0, ge=0, description="Prezzo TP assoluto (0 = nessuno)")
    idempotency_key: Optional[str] = Field(
        default=None,
        description="Chiave opzionale per evitare duplicati (plan:account:symbol:side:lot)"
    )

    @model_validator(mode="after")
    def normalize_for_close(self):
        # Normalizza simboli a uppercase (il mapping verso suffissi broker lo fa l'EA)
        self.symbol = (self.symbol or "").strip().upper()

        # Per side=close, forziamo lot/sl/tp a 0 così il backend/EA non li usa.
        if self.side == "close":
            self.lot = 0.0
            self.sl = 0.0
            self.tp = 0.0
        return self


class QueueRequest(BaseModel):
    plan_name: str = Field(..., min_length=1)
    created_by: str = Field(..., min_length=1)
    items: List[TradeItemIn]


class QueueCounts(BaseModel):
    plan_id: int
    queued: int = 0
    reserved: int = 0
    filled: int = 0
    rejected: int = 0


class QueuePostResponse(BaseModel):
    plan_id: int
    queued: int
    reserved: int
    filled: int
    rejected: int


class QueueItemOut(BaseModel):
    id: int
    account_id: str
    symbol: str
    side: Side
    lot: float
    sl: float = 0
    tp: float = 0
    status: str
    price_exec: Optional[float] = None
    reason: Optional[str] = None


class PlanStatusResponse(BaseModel):
    plan_id: int
    name: str
    created_at: str
    counts: QueueCounts
    items: List[QueueItemOut]
