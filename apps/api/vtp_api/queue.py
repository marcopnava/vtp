# apps/api/vtp_api/queue.py
from __future__ import annotations
import json, os
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Column, DateTime, Float, ForeignKey, Integer, String, Text,
    create_engine, func, Index
)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

DB_URL = os.getenv("VTP_DB_URL", "sqlite:///./queue.db")
EXEC_API_KEY = os.getenv("EXEC_API_KEY", "changeme")
KILL_SWITCH = os.getenv("KILL_SWITCH", "0") == "1"
ENFORCE_PRICE_DEVIATION = os.getenv("ENFORCE_PRICE_DEVIATION", "0") == "1"
MAX_PRICE_DEVIATION_PCT = float(os.getenv("MAX_PRICE_DEVIATION_PCT", "0.5"))
MAX_LOT_PER_ACCOUNT = float(os.getenv("MAX_LOT_PER_ACCOUNT", "5.0"))
ALLOWED_IPS = {ip.strip() for ip in os.getenv("ALLOWLIST_IPS", "").split(",") if ip.strip()}

SUPPORTED_SYMBOLS = {
    "EURUSD","GBPUSD","AUDUSD","NZDUSD","USDJPY","USDCHF","USDCAD","EURJPY",
    "GBPJPY","AUDJPY","NZDJPY","CADJPY","EURNZD","AUDNZD","EURCAD","EURAUD",
    "SPX","US100","DAX","US500","FTSEMIB","JP225",
    "XAUUSD","XAGUSD","USOIL","NGAS","CORN","WHEAT","COFFEE","COCOA","SUGAR","SOYBEAN","XPTUSD",
    "US10Y","BTCUSD","ETHUSD","DXY",
}
ALIASES = {"SPX500":"SPX","US500":"SPX","NAS100":"US100"}

engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class QueuePlan(Base):
    __tablename__ = "queue_plans"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(120), nullable=True)
    items = relationship("QueueItem", back_populates="plan", cascade="all, delete-orphan")

class QueueItem(Base):
    __tablename__ = "queue_items"
    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("queue_plans.id"), index=True)
    account_id = Column(String(64), index=True, nullable=False)
    symbol = Column(String(32), index=True, nullable=False)
    side = Column(String(4), nullable=False)
    lot = Column(Float, nullable=False)
    sl = Column(Float, nullable=True)
    tp = Column(Float, nullable=True)
    status = Column(String(16), default="queued", index=True)  # queued|reserved|filled|rejected
    reserved_at = Column(DateTime, nullable=True)
    acked_at = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=True)
    price_exec = Column(Float, nullable=True)
    broker_order_id = Column(String(64), nullable=True)
    idempotency_key = Column(String(128), nullable=True, index=True)
    client_order_id = Column(String(128), nullable=True, index=True)
    plan = relationship("QueuePlan", back_populates="items")

Index("idx_unique_idem", QueueItem.account_id, QueueItem.idempotency_key)
Base.metadata.create_all(bind=engine)

class QueueItemIn(BaseModel):
    account_id: str
    symbol: str
    side: Literal["buy","sell"]
    lot: float = Field(..., gt=0)
    sl: Optional[float] = Field(None, ge=0)
    tp: Optional[float] = Field(None, ge=0)
    idempotency_key: Optional[str] = None
    client_order_id: Optional[str] = None
    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, v: str) -> str:
        v = v.strip().upper()
        return ALIASES.get(v, v)

class QueuePlanIn(BaseModel):
    plan_name: str
    items: List[QueueItemIn]
    created_by: Optional[str] = None

class QueuePlanOut(BaseModel):
    plan_id: int
    queued: int
    reserved: int
    filled: int
    rejected: int

class AckIn(BaseModel):
    id: int
    status: Literal["filled","rejected"]
    price: Optional[float] = None
    broker_order_id: Optional[str] = None
    reason: Optional[str] = None

class ItemOut(BaseModel):
    id: int; account_id: str; symbol: str; side: str; lot: float
    sl: Optional[float]; tp: Optional[float]; status: str
    reserved_at: Optional[datetime]; acked_at: Optional[datetime]
    price_exec: Optional[float]; broker_order_id: Optional[str]; reason: Optional[str]

class PlanStatusOut(BaseModel):
    plan_id: int; name: str; created_at: datetime
    counts: QueuePlanOut; items: List[ItemOut]

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

router = APIRouter(prefix="", tags=["queue"])

def _ensure_exec_auth(request: Request):
    api_key = request.headers.get("X-EXEC-API-KEY")
    if api_key != EXEC_API_KEY:
        raise HTTPException(401, detail="Invalid EXEC_API_KEY")
    if ALLOWED_IPS:
        client_ip = request.client.host if request.client else None
        if client_ip not in ALLOWED_IPS:
            raise HTTPException(403, detail=f"IP {client_ip} not allowed")

def _price_deviation_ok(symbol: str, side: str) -> bool:
    if not ENFORCE_PRICE_DEVIATION: return True
    return True  # TODO: confronta con /prices/latest

def _caps_for(account_id: str) -> float:
    try:
        caps = json.loads(os.getenv("ACCOUNT_CAPS_JSON", "{}"))
        if isinstance(caps, dict) and account_id in caps: return float(caps[account_id])
    except Exception: pass
    return MAX_LOT_PER_ACCOUNT

def _counts(db: Session, plan_id: int) -> QueuePlanOut:
    rows = (db.query(QueueItem.status, func.count(QueueItem.id))
              .filter(QueueItem.plan_id == plan_id)
              .group_by(QueueItem.status).all())
    counts = {k:v for k,v in rows}
    return QueuePlanOut(plan_id=plan_id,
                        queued=counts.get("queued",0),
                        reserved=counts.get("reserved",0),
                        filled=counts.get("filled",0),
                        rejected=counts.get("rejected",0))

@router.post("/copy/queue", response_model=QueuePlanOut)
def create_queue_plan(payload: QueuePlanIn, db: Session = Depends(get_db)):
    if KILL_SWITCH: raise HTTPException(503, detail="Kill switch is ON")
    if not payload.items: raise HTTPException(400, detail="No items provided")
    for it in payload.items:
        if it.symbol not in SUPPORTED_SYMBOLS: raise HTTPException(400, detail=f"Symbol {it.symbol} not supported")
        if it.lot > _caps_for(it.account_id): raise HTTPException(400, detail=f"Lot {it.lot} exceeds cap for {it.account_id}")
        if not _price_deviation_ok(it.symbol, it.side): raise HTTPException(400, detail=f"Price deviation too large for {it.symbol}")
    plan = QueuePlan(name=payload.plan_name[:120], created_by=payload.created_by)
    db.add(plan); db.flush()
    for it in payload.items:
        idem = (it.idempotency_key or f"{payload.plan_name}:{it.account_id}:{it.symbol}:{it.side}:{it.lot}")[:128]
        exists = (db.query(QueueItem)
                    .filter(QueueItem.account_id==it.account_id, QueueItem.idempotency_key==idem)
                    .first())
        if exists: continue
        db.add(QueueItem(plan_id=plan.id, account_id=it.account_id, symbol=it.symbol,
                         side=it.side, lot=it.lot, sl=it.sl, tp=it.tp,
                         status="queued", idempotency_key=idem, client_order_id=it.client_order_id))
    db.commit()
    return _counts(db, plan.id)

@router.get("/queue/peek")
def peek_next(request: Request,
              account_id: str = Query(..., min_length=1),
              format: str = Query("json", pattern="^(json|plain)$"),
              db: Session = Depends(get_db)):
    _ensure_exec_auth(request)
    if KILL_SWITCH: raise HTTPException(503, detail="Kill switch is ON")
    item = (db.query(QueueItem)
              .filter(QueueItem.account_id==account_id, QueueItem.status=="queued")
              .order_by(QueueItem.id.asc())
              .first())
    if not item: return "NONE" if format=="plain" else {"status":"empty"}
    item.status="reserved"; item.reserved_at=datetime.utcnow(); db.commit()
    if format=="plain":
        sl = "" if item.sl is None else f"{item.sl}"
        tp = "" if item.tp is None else f"{item.tp}"
        return f"{item.id}|{item.symbol}|{item.side}|{item.lot}|{sl}|{tp}"
    return {"id":item.id,"symbol":item.symbol,"side":item.side,"lot":item.lot,"sl":item.sl,"tp":item.tp}

@router.post("/queue/ack")
def ack_item(request: Request, payload: AckIn, db: Session = Depends(get_db)):
    _ensure_exec_auth(request)
    item = db.query(QueueItem).filter(QueueItem.id==payload.id).first()
    if not item: raise HTTPException(404, detail="Item not found")
    if item.status not in ("reserved","queued"): return {"status": item.status}
    item.status = payload.status
    item.acked_at = datetime.utcnow()
    item.price_exec = payload.price
    item.broker_order_id = payload.broker_order_id
    item.reason = payload.reason
    db.commit()
    return {"status": item.status}

@router.get("/queue/status", response_model=PlanStatusOut)
def plan_status(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(QueuePlan).filter(QueuePlan.id==plan_id).first()
    if not plan: raise HTTPException(404, detail="Plan not found")
    counts = _counts(db, plan.id)
    items = [ItemOut(id=it.id, account_id=it.account_id, symbol=it.symbol, side=it.side, lot=it.lot,
                     sl=it.sl, tp=it.tp, status=it.status, reserved_at=it.reserved_at,
                     acked_at=it.acked_at, price_exec=it.price_exec,
                     broker_order_id=it.broker_order_id, reason=it.reason)
             for it in plan.items]
    return PlanStatusOut(plan_id=plan.id, name=plan.name, created_at=plan.created_at, counts=counts, items=items)
