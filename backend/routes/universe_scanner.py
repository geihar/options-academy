"""
Universe scanner routes.
Provides:
  GET  /ticker-universe      → full universe list with source info
  POST /universe-scan        → lightweight concurrent scan of N tickers
  GET  /strategies           → all strategy profiles
  GET  /strategy-wizard      → filtered strategies for wizard inputs
"""

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from data.fetcher import DataFetcher
from data.cache import cache
from analytics.iv_calculator import compute_iv_stats
from analytics.ticker_universe import ticker_universe
from analytics.strategy_profiles import all_strategy_dicts, filter_strategies
from config import settings

router = APIRouter()
fetcher = DataFetcher(polygon_api_key=settings.polygon_api_key)
logger = logging.getLogger(__name__)

MAX_SCAN_WORKERS = 8
BATCH_DELAY = 0.3          # seconds between worker batches to respect rate limits
QUICK_SCAN_CACHE_TTL = 900  # 15 min — quicker refresh than full scan


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class QuickScanResult:
    ticker: str
    price: float
    hv_30: Optional[float]   # 30-day historical volatility (annualised %)
    iv_rank: Optional[float] # 0–100 derived from 52-week HV rolling series
    signal_type: str         # "sell_premium" | "buy_options" | "neutral"
    signal_strength: float   # 0–100 composite score
    error: Optional[str]     # None on success; error message on failure


# ── Single-ticker quick scan (reuses existing fetcher + iv_calculator) ────────

def _scan_quick_one(ticker: str) -> QuickScanResult:
    """
    Lightweight per-ticker scan: fetches one year of price history and derives
    HV30 + IV rank.  Does NOT fetch the options chain — use the full scanner for that.

    Creates its own DB session for thread safety.
    Never raises; catches all exceptions and returns an error result instead.
    """
    db: Session = SessionLocal()
    try:
        cache_key = f"quick_scan:{ticker}"
        cached = cache.get(cache_key, db)
        if cached:
            return QuickScanResult(**cached)

        prices = fetcher.get_historical_prices(ticker, days=252)
        if not prices or len(prices) < 60:
            result = QuickScanResult(
                ticker=ticker, price=0.0, hv_30=None, iv_rank=None,
                signal_type="neutral", signal_strength=0.0,
                error="Недостаточно данных (нужно ≥ 60 дней истории)"
            )
            return result

        iv_stats = compute_iv_stats(prices)
        price = prices[-1]
        hv_30 = iv_stats.get("hv_30")
        iv_rank = iv_stats.get("iv_rank")

        signal_type, signal_strength = _classify_signal(iv_rank)

        result = QuickScanResult(
            ticker=ticker,
            price=round(price, 2),
            hv_30=round(hv_30 * 100, 2) if hv_30 else None,  # store as %
            iv_rank=round(iv_rank, 1) if iv_rank is not None else None,
            signal_type=signal_type,
            signal_strength=round(signal_strength, 1),
            error=None,
        )

        # Cache successful results
        cache.set(cache_key, result.__dict__, db, ttl_seconds=QUICK_SCAN_CACHE_TTL)
        return result

    except Exception as exc:
        logger.warning(f"quick scan error {ticker}: {exc}")
        return QuickScanResult(
            ticker=ticker, price=0.0, hv_30=None, iv_rank=None,
            signal_type="neutral", signal_strength=0.0,
            error=str(exc)[:120],
        )
    finally:
        db.close()


def _classify_signal(iv_rank: Optional[float]) -> tuple[str, float]:
    """Map IV rank to a signal type and 0–100 strength score."""
    if iv_rank is None:
        return "neutral", 0.0
    if iv_rank > 50:
        return "sell_premium", min(100.0, (iv_rank - 50) * 2.0)
    if iv_rank < 30:
        return "buy_options", min(100.0, (30.0 - iv_rank) * 3.33)
    return "neutral", 20.0


def _scan_concurrent(
    tickers: list[str],
    max_workers: int = MAX_SCAN_WORKERS,
    batch_delay: float = BATCH_DELAY,
) -> list[QuickScanResult]:
    """
    Scan all tickers concurrently in batches.
    Results are returned sorted by signal_strength descending (errors at the bottom).
    """
    results: dict[str, QuickScanResult] = {}

    # Process in batches to keep concurrent connections within Yahoo rate limits.
    # Each yfinance history() call = 1 HTTP request, so 8 workers = 8 concurrent requests.
    batch_size = max_workers
    batches = [tickers[i:i + batch_size] for i in range(0, len(tickers), batch_size)]

    for batch in batches:
        with ThreadPoolExecutor(max_workers=len(batch)) as pool:
            futures = {pool.submit(_scan_quick_one, t): t for t in batch}
            for future in as_completed(futures):
                res = future.result()
                results[res.ticker] = res
        # Brief pause between batches to be polite to Yahoo's servers.
        time.sleep(batch_delay)

    sorted_results = sorted(
        results.values(),
        key=lambda r: (r.error is None, r.signal_strength),
        reverse=True,
    )
    return sorted_results


# ── Pydantic response models ──────────────────────────────────────────────────

class UniverseInfoResponse(BaseModel):
    source: str
    total: int
    tickers: list[str]


class QuickScanResultSchema(BaseModel):
    ticker: str
    price: float
    hv_30: Optional[float]
    iv_rank: Optional[float]
    signal_type: str
    signal_strength: float
    error: Optional[str]


class UniverseScanRequest(BaseModel):
    max_tickers: int = 100
    signal_filter: str = "all"   # "all" | "sell_premium" | "buy_options"
    max_workers: int = 8


class UniverseScanResponse(BaseModel):
    results: list[QuickScanResultSchema]
    scan_time_seconds: float
    tickers_scanned: int
    signals_found: int
    errors: int
    universe_source: str


class WizardRequest(BaseModel):
    outlook: str   # bullish | mildly_bullish | neutral | mildly_bearish | bearish | volatile
    risk_type: str # defined | open
    iv_env: str    # high | low | unsure


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/ticker-universe", response_model=UniverseInfoResponse)
def get_ticker_universe(db: Session = Depends(get_db)):
    """
    Return the full universe of scannable tickers with source metadata.
    Cached in memory for 6 hours; Wikipedia fetch only happens once per session.
    """
    info = ticker_universe.info()
    return UniverseInfoResponse(**info)


@router.post("/universe-scan", response_model=UniverseScanResponse)
def run_universe_scan(req: UniverseScanRequest, db: Session = Depends(get_db)):
    """
    Lightweight concurrent scan of up to max_tickers from the universe.
    Uses HV30 as IV proxy — fast enough to scan 100 tickers in ~15 seconds.
    Full options-chain analysis: use /scan for individual tickers after spotting signals here.
    """
    all_tickers = ticker_universe.get_tickers()
    tickers = all_tickers[:min(req.max_tickers, 500)]
    workers = min(req.max_workers, MAX_SCAN_WORKERS, len(tickers))

    t0 = time.time()
    raw = _scan_concurrent(tickers, max_workers=workers)
    elapsed = round(time.time() - t0, 2)

    # Apply signal filter
    if req.signal_filter != "all":
        filtered = [r for r in raw if r.signal_type == req.signal_filter]
        # Always include errors so the user can see failures
        errors_only = [r for r in raw if r.error]
        display = filtered + [e for e in errors_only if e not in filtered]
    else:
        display = raw

    signals_found = sum(1 for r in raw if r.signal_type != "neutral" and not r.error)
    errors = sum(1 for r in raw if r.error)

    return UniverseScanResponse(
        results=[QuickScanResultSchema(**r.__dict__) for r in display],
        scan_time_seconds=elapsed,
        tickers_scanned=len(tickers),
        signals_found=signals_found,
        errors=errors,
        universe_source=ticker_universe.get_source(),
    )


@router.get("/strategies")
def get_strategies():
    """Return all 10 strategy profiles as JSON — used by the frontend wizard."""
    return {"strategies": all_strategy_dicts()}


@router.post("/strategy-wizard")
def strategy_wizard(req: WizardRequest):
    """
    Given 3 wizard dimensions, return filtered + ranked strategies with fit reasons.
    Guaranteed to return ≥ 1 strategy for any valid input combination.
    """
    valid_outlooks = {"bullish", "mildly_bullish", "neutral", "mildly_bearish", "bearish", "volatile"}
    valid_risks = {"defined", "open"}
    valid_ivs = {"high", "low", "unsure"}

    outlook = req.outlook if req.outlook in valid_outlooks else "neutral"
    risk_type = req.risk_type if req.risk_type in valid_risks else "defined"
    iv_env = req.iv_env if req.iv_env in valid_ivs else "unsure"

    matches = filter_strategies(outlook, risk_type, iv_env)

    # Attach full profile data to each match
    all_profiles = {s["id"]: s for s in all_strategy_dicts()}
    enriched = []
    for m in matches:
        profile = all_profiles.get(m["id"])
        if profile:
            enriched.append({**profile, **m})

    # Separate excluded strategies with one-line reason
    matched_ids = {m["id"] for m in matches}
    all_profiles_list = all_strategy_dicts()
    excluded = []
    for p in all_profiles_list:
        if p["id"] not in matched_ids:
            excluded.append({
                "id": p["id"],
                "name": p["name"],
                "name_ru": p["name_ru"],
                "icon": p["icon"],
                "exclude_reason": _exclude_reason(p, outlook, risk_type, iv_env),
            })

    return {
        "matched": enriched,
        "excluded": excluded,
        "outlook": outlook,
        "risk_type": risk_type,
        "iv_env": iv_env,
    }


def _exclude_reason(profile: dict, outlook: str, risk_type: str, iv_env: str) -> str:
    """Return a brief one-line reason why a strategy was excluded from wizard results."""
    if outlook not in profile["outlook_tags"]:
        tag_names = {
            "bullish": "бычий", "mildly_bullish": "умеренно бычий",
            "neutral": "нейтральный", "mildly_bearish": "умеренно медвежий",
            "bearish": "медвежий", "volatile": "волатильный",
        }
        tags_str = "/".join(tag_names.get(t, t) for t in profile["outlook_tags"])
        return f"Требует {tags_str} взгляд на рынок"
    if risk_type == "defined" and profile["risk_type"] == "open":
        return "Неограниченный риск — вы выбрали только определённый риск"
    return "Не оптимально для текущего IV окружения"
