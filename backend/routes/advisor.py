from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from data.fetcher import DataFetcher
from data.cache import cache
from analytics.black_scholes import black_scholes, implied_volatility, BSResult as AnalyticsBSResult
from analytics.iv_calculator import compute_iv_stats, compute_expected_move
from analytics.advisor_engine import generate_advice
from analytics.earnings_data import days_to_earnings, get_next_earnings_date
from schemas import AdviceRequest, AdviceResponse, BSResult, AdviceItem
from config import settings

router = APIRouter()
fetcher = DataFetcher(polygon_api_key=settings.polygon_api_key)


def _bs_to_schema(r: AnalyticsBSResult) -> BSResult:
    return BSResult(
        price=round(r.price, 4),
        delta=round(r.delta, 4),
        gamma=round(r.gamma, 6),
        theta=round(r.theta, 4),
        vega=round(r.vega, 4),
        rho=round(r.rho, 4),
        charm=round(r.charm, 6),
        vanna=round(r.vanna, 6),
        d1=round(r.d1, 4),
        d2=round(r.d2, 4),
        itm_probability=round(r.itm_probability, 4),
    )


@router.post("/advice", response_model=AdviceResponse)
def get_advice(req: AdviceRequest, db: Session = Depends(get_db)):
    """
    Full analysis for a specific option:
    - Fetches live stock price
    - Computes IV from market price via Newton-Raphson
    - Computes IV Rank from 252 days of price history
    - Generates rule-based, specific trading advice
    """
    ticker = req.ticker.upper()

    # Fetch current stock price (cached 5min)
    cache_key_price = f"stock_price:{ticker}"
    current_price = cache.get(cache_key_price, db)
    if current_price is None:
        current_price = fetcher.get_current_price(ticker)
        if not current_price:
            raise HTTPException(status_code=404, detail=f"Cannot fetch price for {ticker}")
        cache.set(cache_key_price, current_price, db, ttl_seconds=300)

    # Compute time to expiry
    try:
        expiry_date = date.fromisoformat(req.expiry)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid expiry date format. Use YYYY-MM-DD")

    today = date.today()
    dte = max((expiry_date - today).days, 1)
    T = dte / 365.0

    r = settings.risk_free_rate

    # Compute IV from market price
    iv = implied_volatility(req.market_price, current_price, req.strike, T, r, req.option_type)

    if iv is None:
        # Fall back to a reasonable default
        iv = 0.30

    # BS calculation with implied vol
    bs = black_scholes(current_price, req.strike, T, r, iv, req.option_type)

    # Get historical IV stats (cached 15min)
    cache_key_hist = f"hist_iv:{ticker}"
    iv_stats = cache.get(cache_key_hist, db)
    if iv_stats is None:
        hist_prices = fetcher.get_historical_prices(ticker, days=252)
        iv_stats = compute_iv_stats(hist_prices) if hist_prices else {}
        cache.set(cache_key_hist, iv_stats, db, ttl_seconds=settings.cache_ttl)

    hv_30 = iv_stats.get("hv_30")
    iv_rank = iv_stats.get("iv_rank")
    iv_percentile = iv_stats.get("iv_percentile")
    iv_premium = (iv - hv_30) if (iv and hv_30) else None

    # Earnings data (cached 6 hours)
    cache_key_earn = f"earnings:{ticker}"
    dte_earnings = cache.get(cache_key_earn, db)
    next_earnings_str = None
    if dte_earnings is None:
        dte_earnings = days_to_earnings(ticker)
        next_earn_date = get_next_earnings_date(ticker)
        if next_earn_date:
            next_earnings_str = next_earn_date.isoformat()
        earnings_payload = {
            "dte_earnings": dte_earnings,
            "next_earnings_date": next_earnings_str,
        }
        cache.set(cache_key_earn, earnings_payload, db, ttl_seconds=21600)
    else:
        if isinstance(dte_earnings, dict):
            next_earnings_str = dte_earnings.get("next_earnings_date")
            dte_earnings = dte_earnings.get("dte_earnings")

    # Compute expected move from ATM straddle (simplified estimate)
    expected_move = None
    if iv and current_price and T:
        # Simplified: 1 std dev move ≈ S * IV * sqrt(T)
        expected_move = round(current_price * iv * (T ** 0.5), 2)

    # Generate advice
    advice_items = generate_advice(
        ticker=ticker,
        iv_rank=iv_rank,
        iv_percentile=iv_percentile,
        current_iv=iv,
        hv_30=hv_30,
        days_to_expiry=dte,
        theta=bs.theta,
        market_price=req.market_price,
        days_to_earnings=dte_earnings,
        expected_move=expected_move,
        current_price=current_price,
        delta=bs.delta,
        vega=bs.vega,
        gamma=bs.gamma,
        option_type=req.option_type,
        strike=req.strike,
    )

    # Compute breakeven
    if req.option_type == "call":
        breakeven = req.strike + req.market_price
    else:
        breakeven = req.strike - req.market_price

    advice_schema = [
        AdviceItem(level=a.level, title=a.title, body=a.body, lesson_link=a.lesson_link)
        for a in advice_items
    ]

    return AdviceResponse(
        ticker=ticker,
        current_price=round(current_price, 2),
        strike=req.strike,
        expiry=req.expiry,
        option_type=req.option_type,
        market_price=req.market_price,
        bs_price=round(bs.price, 4),
        greeks=_bs_to_schema(bs),
        iv=round(iv, 4) if iv else None,
        iv_rank=round(iv_rank, 1) if iv_rank is not None else None,
        iv_percentile=round(iv_percentile, 1) if iv_percentile is not None else None,
        hv_30=round(hv_30, 4) if hv_30 else None,
        iv_premium=round(iv_premium, 4) if iv_premium else None,
        days_to_expiry=dte,
        breakeven=round(breakeven, 2),
        advice=advice_schema,
        days_to_earnings=dte_earnings,
        next_earnings_date=next_earnings_str,
    )
