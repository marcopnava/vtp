# /Users/marconava/Desktop/vtp/apps/api/vtp_api/schemas.py
from typing import List, Optional, Literal, Union, Annotated
from pydantic import BaseModel, Field


class InstrumentSpec(BaseModel):
    symbol: str
    tick_size: float = Field(gt=0)
    tick_value: float  # EUR per tick @ 1 lot
    min_lot: float = Field(ge=0)
    lot_step: float = Field(gt=0)
    max_lot: Optional[float] = None


class MasterInfo(BaseModel):
    balance: float
    equity: float


class MasterOrder(BaseModel):
    symbol: str
    side: Literal["buy", "sell"]
    lot: float
    sl: Optional[float] = None
    tp: Optional[float] = None
    comment: Optional[str] = None


class ProportionalRule(BaseModel):
    type: Literal["proportional"]
    base: Literal["balance", "equity"]
    multiplier: float = 1.0


class FixedRule(BaseModel):
    type: Literal["fixed"]
    lots: float


class LotPerUnitRule(BaseModel):
    type: Literal["lot_per_10k"]
    base: Literal["balance", "equity"]
    lots_per_unit: float
    unit: float = 10_000.0


Rule = Annotated[Union[ProportionalRule, FixedRule, LotPerUnitRule], Field(discriminator="type")]


class FollowerAccount(BaseModel):
    id: str
    name: Optional[str] = None
    balance: float
    equity: float
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
    previews: List[FollowerPreview]


# ---- sizing (riuso per /sizing/calc) ----
class SizingInstrument(BaseModel):
    symbol: str
    tick_size: float
    tick_value: float
    min_lot: float
    lot_step: float
    max_lot: Optional[float] = None


class SizingRequest(BaseModel):
    risk_mode: Literal["fixed", "percent_balance", "percent_equity"]
    risk_value: float  # € oppure %
    balance: Optional[float] = None
    equity: Optional[float] = None
    stop_distance: float
    slippage: float = 0.0
    instrument: SizingInstrument


class SizingResponse(BaseModel):
    suggested_lots: float
    rounded_to_step: float
    per_lot_risk: float
    risk_at_suggested: float
    warnings: List[str] = []
