import logging
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from data.fetcher import DataFetcher
from data.cache import cache
from analytics.iv_calculator import compute_iv_stats
from analytics.squeeze_engine import get_squeeze_metrics
from analytics.finviz_screener import fetch_high_short_interest_tickers, FALLBACK_UNIVERSE
from schemas import SqueezeScanRequest, SqueezeScanResponse, SqueezeMetricsSchema, PricePoint
from config import settings

router = APIRouter()
fetcher = DataFetcher(polygon_api_key=settings.polygon_api_key)
logger = logging.getLogger(__name__)

SQUEEZE_CACHE_TTL = 4 * 3600
MAX_WORKERS = 8


def _squeeze_one(ticker: str) -> SqueezeMetricsSchema:
    db = SessionLocal()
    try:
        cache_key = f"squeeze:{ticker}"
        cached = cache.get(cache_key, db)
        if cached:
            return SqueezeMetricsSchema(**cached)

        iv_cache_key = f"hist_iv:{ticker}"
        iv_stats = cache.get(iv_cache_key, db)
        if iv_stats is None:
            hist_prices = fetcher.get_historical_prices(ticker, days=252)
            iv_stats = compute_iv_stats(hist_prices) if hist_prices else {}
            cache.set(iv_cache_key, iv_stats, db, ttl_seconds=settings.cache_ttl)

        m = get_squeeze_metrics(ticker, fetcher, iv_stats)

        if m is None:
            return SqueezeMetricsSchema(
                ticker=ticker,
                name=ticker,
                current_price=0.0,
                squeeze_score=0.0,
                squeeze_potential="Низкий",
                squeeze_phase="Нейтральный",
                error="Не удалось получить данные",
            )

        schema = SqueezeMetricsSchema(
            ticker=m.ticker,
            name=m.name,
            current_price=m.current_price,
            sector=m.sector,
            short_interest_pct=m.short_interest_pct,
            days_to_cover=m.days_to_cover,
            shares_short=m.shares_short,
            shares_short_prev=m.shares_short_prev,
            si_change_pct=m.si_change_pct,
            float_shares=m.float_shares,
            shares_outstanding=m.shares_outstanding,
            change_1d=m.change_1d,
            change_5d=m.change_5d,
            change_20d=m.change_20d,
            change_52w_low_pct=m.change_52w_low_pct,
            change_52w_high_pct=m.change_52w_high_pct,
            week_52_high=m.week_52_high,
            week_52_low=m.week_52_low,
            volume_today=m.volume_today,
            avg_volume_20d=m.avg_volume_20d,
            volume_ratio=m.volume_ratio,
            iv_rank=m.iv_rank,
            hv_20=m.hv_20,
            market_cap=m.market_cap,
            beta=m.beta,
            squeeze_score=m.squeeze_score,
            squeeze_potential=m.squeeze_potential,
            squeeze_phase=m.squeeze_phase,
            key_factors=m.key_factors,
            risk_factors=m.risk_factors,
            price_history=[
                PricePoint(date=p["date"], close=p["close"], volume=p["volume"])
                for p in m.price_history
            ],
        )

        cache.set(cache_key, schema.model_dump(), db, ttl_seconds=SQUEEZE_CACHE_TTL)
        return schema

    except Exception as e:
        logger.error(f"Squeeze scan error for {ticker}: {e}", exc_info=True)
        return SqueezeMetricsSchema(
            ticker=ticker,
            name=ticker,
            current_price=0.0,
            squeeze_score=0.0,
            squeeze_potential="Низкий",
            squeeze_phase="Нейтральный",
            error=str(e),
        )
    finally:
        db.close()


@router.post("/squeeze-scan", response_model=SqueezeScanResponse)
def squeeze_scan(req: SqueezeScanRequest, db: Session = Depends(get_db)):
    tickers = [t.upper().strip() for t in req.tickers if t.strip()]
    results: list[SqueezeMetricsSchema] = [None] * len(tickers)  # type: ignore

    with ThreadPoolExecutor(max_workers=min(len(tickers), MAX_WORKERS)) as pool:
        future_to_idx = {pool.submit(_squeeze_one, t): i for i, t in enumerate(tickers)}
        for future in as_completed(future_to_idx):
            results[future_to_idx[future]] = future.result()

    results.sort(key=lambda r: r.squeeze_score, reverse=True)
    return SqueezeScanResponse(results=results)


class UniverseItem(BaseModel):
    ticker: str
    company: str
    short_float_pct: Optional[float] = None
    short_ratio: Optional[float] = None


class UniverseResponse(BaseModel):
    source: str           # "finviz" | "fallback"
    items: List[UniverseItem]
    total: int


@router.get("/squeeze-universe", response_model=UniverseResponse)
def squeeze_universe(
    min_short_float: float = Query(default=10.0, description="Minimum short float %"),
    max_results: int = Query(default=50, le=100),
    db: Session = Depends(get_db),
):
    """
    Auto-discover high short-interest tickers from Finviz screener.
    No ticker input needed — returns candidates sorted by short float %.
    Cached for 6 hours.
    """
    cache_key = f"squeeze_universe:{min_short_float:.0f}"
    cached = cache.get(cache_key, db)
    if cached:
        return UniverseResponse(**cached)

    try:
        rows = fetch_high_short_interest_tickers(
            pages=3,
            min_short_float=min_short_float,
            max_results=max_results,
        )
        if rows:
            items = [UniverseItem(**r) for r in rows]
            result = UniverseResponse(source="finviz", items=items, total=len(items))
            cache.set(cache_key, result.model_dump(), db, ttl_seconds=6 * 3600)
            return result
    except Exception as e:
        logger.warning(f"Finviz scrape failed: {e}")

    # Fallback — curated list without SI numbers
    items = [UniverseItem(ticker=t, company=t) for t in FALLBACK_UNIVERSE[:max_results]]
    result = UniverseResponse(source="fallback", items=items, total=len(items))
    return result
