import logging
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, OptionPosition
from data.fetcher import DataFetcher
from data.cache import cache
from analytics.black_scholes import black_scholes, implied_volatility
from schemas import (
    PositionAddRequest, PositionCloseRequest, JournalUpdateRequest,
    PositionSchema, PositionPnL, PositionGreeks,
)
from config import settings

router = APIRouter()
fetcher = DataFetcher(polygon_api_key=settings.polygon_api_key)
logger = logging.getLogger(__name__)

MULTIPLIER = 100


def _compute_pnl(pos: OptionPosition, db: Session) -> PositionPnL:
    """Fetch live price and compute unrealized P&L for an open position."""
    today = date.today()
    entry = date.fromisoformat(pos.entry_date)
    days_held = (today - entry).days

    try:
        expiry_date = date.fromisoformat(pos.expiry)
    except ValueError:
        return PositionPnL(days_held=days_held)

    dte = max((expiry_date - today).days, 0)

    # Current stock price (cached 5min)
    cache_key = f"stock_price:{pos.ticker}"
    current_price = cache.get(cache_key, db)
    if current_price is None:
        current_price = fetcher.get_current_price(pos.ticker)
        if current_price:
            cache.set(cache_key, current_price, db, ttl_seconds=300)

    if not current_price:
        return PositionPnL(days_held=days_held, days_to_expiry=dte)

    greeks = None
    if dte == 0:
        # Expired — use intrinsic value
        if pos.option_type == "call":
            current_opt = max(0.0, current_price - pos.strike)
        else:
            current_opt = max(0.0, pos.strike - current_price)
    else:
        T = dte / 365.0
        r = settings.risk_free_rate

        # ── Step 1: try real market mid-price from yfinance ──────────────────
        current_opt = None
        try:
            market_mid = fetcher.get_option_mid_price(
                pos.ticker, pos.expiry, pos.strike, pos.option_type
            )
            if market_mid is not None and market_mid >= 0:
                current_opt = market_mid
        except Exception as e:
            logger.debug(f"Market mid fetch failed for {pos.ticker}: {e}")

        # ── Step 2: estimate IV from ENTRY conditions to avoid circular ref ──
        # Use T_at_entry (original DTE) so implied_vol → BS doesn't cancel out
        T_at_entry = (dte + days_held) / 365.0
        iv = 0.30  # safe default
        if T_at_entry > 0:
            try:
                iv_est = implied_volatility(
                    pos.entry_price, current_price, pos.strike,
                    T_at_entry, r, pos.option_type
                )
                if iv_est and 0.02 < iv_est < 5.0:
                    iv = iv_est
            except Exception:
                pass

        # ── Step 3: fall back to Black-Scholes if no market price ────────────
        if current_opt is None:
            try:
                bs = black_scholes(current_price, pos.strike, T, r, iv, pos.option_type)
                current_opt = bs.price
            except Exception:
                current_opt = None

        # ── Step 4: always compute Greeks for display ─────────────────────────
        if current_opt is not None:
            # If we got market price, back-compute IV from it for accurate greeks
            try:
                iv_market = implied_volatility(
                    current_opt, current_price, pos.strike, T, r, pos.option_type
                )
                if iv_market and 0.02 < iv_market < 5.0:
                    iv = iv_market
            except Exception:
                pass
            try:
                bs = black_scholes(current_price, pos.strike, T, r, iv, pos.option_type)
                greeks = PositionGreeks(
                    iv=round(iv, 4),
                    delta=round(bs.delta, 4),
                    gamma=round(bs.gamma, 6),
                    theta=round(bs.theta, 4),
                    vega=round(bs.vega, 4),
                )
            except Exception:
                greeks = None

    if current_opt is not None:
        sign = 1 if pos.direction == "long" else -1
        unrealized = sign * (current_opt - pos.entry_price) * MULTIPLIER * pos.contracts
        entry_cost = pos.entry_price * MULTIPLIER * pos.contracts
        pct = (unrealized / entry_cost * 100) if entry_cost != 0 else 0
    else:
        unrealized = None
        pct = None
        greeks = None

    return PositionPnL(
        current_price=round(current_price, 2) if current_price else None,
        current_option_price=round(current_opt, 4) if current_opt is not None else None,
        unrealized_pnl=round(unrealized, 2) if unrealized is not None else None,
        unrealized_pnl_pct=round(pct, 2) if pct is not None else None,
        days_to_expiry=dte,
        days_held=days_held,
        greeks=greeks if dte > 0 else None,
    )


def _to_schema(pos: OptionPosition, db: Session, include_pnl: bool = True) -> PositionSchema:
    realized = None
    if pos.status == "closed" and pos.close_price is not None:
        sign = 1 if pos.direction == "long" else -1
        realized = round(
            sign * (pos.close_price - pos.entry_price) * MULTIPLIER * pos.contracts, 2
        )

    pnl = None
    if pos.status == "open" and include_pnl:
        try:
            pnl = _compute_pnl(pos, db)
        except Exception as e:
            logger.warning(f"P&L error for {pos.id}: {e}")

    return PositionSchema(
        id=pos.id,
        user_session_id=pos.user_session_id,
        ticker=pos.ticker,
        option_type=pos.option_type,
        direction=pos.direction,
        strike=pos.strike,
        expiry=pos.expiry,
        contracts=pos.contracts,
        entry_price=pos.entry_price,
        entry_date=pos.entry_date,
        notes=pos.notes,
        status=pos.status,
        is_covered=bool(pos.is_covered),
        shares_held=pos.shares_held,
        stock_cost_basis=pos.stock_cost_basis,
        close_price=pos.close_price,
        realized_pnl=realized,
        pnl=pnl,
        trade_result=pos.trade_result,
        outcome_notes=pos.outcome_notes,
        lesson_learned=pos.lesson_learned,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/positions", response_model=PositionSchema, status_code=201)
def add_position(req: PositionAddRequest, db: Session = Depends(get_db)):
    pos = OptionPosition(
        user_session_id=req.user_session_id,
        ticker=req.ticker.upper(),
        option_type=req.option_type,
        direction=req.direction,
        strike=req.strike,
        expiry=req.expiry,
        contracts=req.contracts,
        entry_price=req.entry_price,
        entry_date=req.entry_date,
        notes=req.notes,
        is_covered=req.is_covered,
        shares_held=req.shares_held if req.is_covered else None,
        stock_cost_basis=req.stock_cost_basis if req.is_covered else None,
    )
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return _to_schema(pos, db)


@router.get("/positions/{user_session_id}", response_model=list[PositionSchema])
def list_positions(
    user_session_id: str,
    status: str = "open",     # "open" | "closed" | "all"
    db: Session = Depends(get_db),
):
    q = db.query(OptionPosition).filter(
        OptionPosition.user_session_id == user_session_id
    )
    if status != "all":
        q = q.filter(OptionPosition.status == status)
    positions = q.order_by(OptionPosition.created_at.desc()).all()
    return [_to_schema(p, db) for p in positions]


@router.post("/positions/{position_id}/close", response_model=PositionSchema)
def close_position(
    position_id: str,
    req: PositionCloseRequest,
    db: Session = Depends(get_db),
):
    pos = db.query(OptionPosition).filter(OptionPosition.id == position_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    if pos.status == "closed":
        raise HTTPException(status_code=400, detail="Position already closed")
    pos.status = "closed"
    pos.close_price = req.close_price
    pos.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(pos)
    return _to_schema(pos, db, include_pnl=False)


@router.patch("/positions/{position_id}/journal", response_model=PositionSchema)
def update_journal(
    position_id: str,
    req: JournalUpdateRequest,
    db: Session = Depends(get_db),
):
    pos = db.query(OptionPosition).filter(OptionPosition.id == position_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    if req.trade_result is not None:
        pos.trade_result = req.trade_result
    if req.outcome_notes is not None:
        pos.outcome_notes = req.outcome_notes
    if req.lesson_learned is not None:
        pos.lesson_learned = req.lesson_learned
    db.commit()
    db.refresh(pos)
    return _to_schema(pos, db, include_pnl=False)


@router.get("/positions/{user_session_id}/portfolio-greeks")
def portfolio_greeks(user_session_id: str, db: Session = Depends(get_db)):
    """Aggregate Greeks across all open positions."""
    positions = db.query(OptionPosition).filter(
        OptionPosition.user_session_id == user_session_id,
        OptionPosition.status == "open",
    ).all()

    net_delta = 0.0
    net_theta = 0.0
    net_vega = 0.0
    net_gamma = 0.0
    total_cost = 0.0
    positions_with_greeks = 0

    for pos in positions:
        try:
            pnl = _compute_pnl(pos, db)
            if pnl.greeks:
                sign = 1 if pos.direction == "long" else -1
                mult = MULTIPLIER * pos.contracts
                net_delta += sign * (pnl.greeks.delta or 0) * mult
                net_theta += sign * (pnl.greeks.theta or 0) * mult
                net_vega  += sign * (pnl.greeks.vega  or 0) * mult
                net_gamma += sign * (pnl.greeks.gamma or 0) * mult
                positions_with_greeks += 1
        except Exception:
            pass
        total_cost += pos.entry_price * MULTIPLIER * pos.contracts

    return {
        "net_delta": round(net_delta, 2),
        "net_theta": round(net_theta, 4),   # daily $ P&L from time decay
        "net_vega": round(net_vega, 4),      # $ per 1% IV change
        "net_gamma": round(net_gamma, 6),
        "total_cost_basis": round(total_cost, 2),
        "open_positions": len(positions),
        "positions_with_greeks": positions_with_greeks,
    }


@router.delete("/positions/{position_id}", status_code=204)
def delete_position(position_id: str, db: Session = Depends(get_db)):
    pos = db.query(OptionPosition).filter(OptionPosition.id == position_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    db.delete(pos)
    db.commit()
