"""
Historical volatility data endpoint.
Returns rolling HV30 series with dates for charting.
"""
import numpy as np
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from data.fetcher import DataFetcher
from data.cache import cache
from config import settings

router = APIRouter()
fetcher = DataFetcher(polygon_api_key=settings.polygon_api_key)
logger = logging.getLogger(__name__)


@router.get("/iv-history/{ticker}")
def get_iv_history(ticker: str, db: Session = Depends(get_db)):
    """
    Returns 252 trading days of:
    - rolling 30-day HV (annualised) as a proxy for historical IV
    - 10-day HV for short-term volatility context
    - price close for reference

    Cached 1 hour.
    """
    ticker = ticker.upper()
    cache_key = f"iv_history:{ticker}"

    cached = cache.get(cache_key, db)
    if cached:
        return cached

    rows = fetcher.get_historical_prices_with_dates(ticker, days=252)
    if not rows:
        raise HTTPException(status_code=404, detail=f"No data for {ticker}")

    prices = [r["close"] for r in rows]
    dates = [r["date"] for r in rows]

    prices_arr = np.array(prices)
    log_returns = np.log(prices_arr[1:] / prices_arr[:-1])

    result_rows = []
    for i in range(30, len(log_returns)):
        # rolling 30-day HV
        hv30 = float(np.std(log_returns[i - 30: i], ddof=1) * np.sqrt(252))
        # rolling 10-day HV
        hv10 = float(np.std(log_returns[i - 10: i], ddof=1) * np.sqrt(252)) if i >= 10 else hv30
        result_rows.append({
            "date": dates[i + 1],        # +1 because log_returns is shifted
            "hv30": round(hv30 * 100, 2),  # as %
            "hv10": round(hv10 * 100, 2),
            "close": round(prices[i + 1], 2),
        })

    # Compute IV rank series (position in 52-week HV range)
    hv_vals = [r["hv30"] for r in result_rows]
    hv_min = min(hv_vals)
    hv_max = max(hv_vals)
    hv_range = hv_max - hv_min or 1

    for r in result_rows:
        r["iv_rank"] = round((r["hv30"] - hv_min) / hv_range * 100, 1)

    payload = {
        "ticker": ticker,
        "data": result_rows,
        "current_hv30": result_rows[-1]["hv30"] if result_rows else None,
        "hv30_min": round(hv_min, 2),
        "hv30_max": round(hv_max, 2),
    }

    cache.set(cache_key, payload, db, ttl_seconds=3600)
    return payload
