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
from analytics.scanner_engine import scan_ticker_options, scan_naked_options
from analytics.scanner_universe import fetch_scanner_universe, CATEGORIES, FALLBACK_UNIVERSE
from schemas import (
    ScanRequest, ScanResponse, ScanTickerResult, ScannerCandidateSchema,
    ChapterSignalSchema, ProfitForecastSchema, EvidenceItemSchema,
    NakedScanRequest, NakedScanResponse, NakedTickerResult, NakedCandidateSchema,
)
from config import settings

router = APIRouter()
fetcher = DataFetcher(polygon_api_key=settings.polygon_api_key)
logger = logging.getLogger(__name__)

MAX_WORKERS = 8


# ── Per-ticker helpers (each creates its own DB session for thread safety) ─────

def _scan_one(ticker: str, req: ScanRequest) -> tuple[ScanTickerResult, int]:
    db = SessionLocal()
    try:
        cache_key_hist = f"hist_iv:{ticker}"
        iv_stats = cache.get(cache_key_hist, db)
        if iv_stats is None:
            hist_prices = fetcher.get_historical_prices(ticker, days=252)
            iv_stats = compute_iv_stats(hist_prices) if hist_prices else {}
            cache.set(cache_key_hist, iv_stats, db, ttl_seconds=settings.cache_ttl)

        cache_key_price = f"stock_price:{ticker}"
        current_price = cache.get(cache_key_price, db)
        if current_price is None:
            current_price = fetcher.get_current_price(ticker) or 0
            cache.set(cache_key_price, current_price, db, ttl_seconds=300)

        candidates = scan_ticker_options(
            ticker=ticker,
            fetcher=fetcher,
            iv_stats=iv_stats,
            min_volume=req.min_volume,
            min_open_interest=req.min_open_interest,
            min_dte=req.min_dte,
            max_dte=req.max_dte,
            strategies=req.strategies,
            r=settings.risk_free_rate,
        )

        schema_candidates = []
        for c in candidates:
            chapter_signals = [
                ChapterSignalSchema(
                    chapter=s.chapter,
                    chapter_title=s.chapter_title,
                    signal_name=s.signal_name,
                    score=s.score,
                    level=s.level,
                    title=s.title,
                    body=s.body,
                    strategy_hint=s.strategy_hint,
                    profit_catalyst=s.profit_catalyst,
                    data_evidence=[
                        EvidenceItemSchema(
                            label=e.label,
                            value=e.value,
                            status=e.status,
                            meaning=e.meaning,
                            threshold=e.threshold,
                        )
                        for e in s.data_evidence
                    ],
                    entry_rules=s.entry_rules,
                    exit_rules=s.exit_rules,
                    risk_note=s.risk_note,
                )
                for s in c.chapter_signals
            ]
            f = c.forecast
            forecast = ProfitForecastSchema(
                expected_value=f.expected_value,
                max_profit=f.max_profit,
                max_loss=f.max_loss,
                breakeven=f.breakeven,
                breakeven_move_pct=f.breakeven_move_pct,
                breakeven_vs_1sd=f.breakeven_vs_1sd,
                expected_move_1sd=f.expected_move_1sd,
                prob_profit=f.prob_profit,
                annualized_return_if_target=f.annualized_return_if_target,
                scenario_bull=f.scenario_bull,
                scenario_bear=f.scenario_bear,
                scenario_flat=f.scenario_flat,
                theta_drag_total=f.theta_drag_total,
            )
            schema_candidates.append(ScannerCandidateSchema(
                ticker=c.ticker,
                current_price=c.current_price,
                strike=c.strike,
                expiry=c.expiry,
                option_type=c.option_type,
                days_to_expiry=c.days_to_expiry,
                market_price=c.market_price,
                bid=c.bid,
                ask=c.ask,
                volume=c.volume,
                open_interest=c.open_interest,
                iv=c.iv,
                delta=c.delta,
                gamma=c.gamma,
                theta=c.theta,
                vega=c.vega,
                iv_rank=c.iv_rank,
                iv_percentile=c.iv_percentile,
                hv_30=c.hv_30,
                iv_premium=c.iv_premium,
                days_to_earnings=c.days_to_earnings,
                next_earnings_date=c.next_earnings_date,
                composite_score=c.composite_score,
                chapter_signals=chapter_signals,
                forecast=forecast,
                recommended_strategy=c.recommended_strategy,
                strategy_rationale=c.strategy_rationale,
                setup_quality=c.setup_quality,
            ))

        result = ScanTickerResult(
            ticker=ticker,
            current_price=round(current_price, 2),
            iv_rank=iv_stats.get("iv_rank"),
            hv_30=iv_stats.get("hv_30"),
            days_to_earnings=None,
            candidates=schema_candidates,
        )
        return result, len(schema_candidates)

    except Exception as e:
        logger.error(f"Scanner error for {ticker}: {e}", exc_info=True)
        return ScanTickerResult(ticker=ticker, current_price=0, candidates=[], error=str(e)), 0
    finally:
        db.close()


def _scan_naked_one(ticker: str, req: NakedScanRequest) -> tuple[NakedTickerResult, int]:
    db = SessionLocal()
    try:
        cache_key_hist = f"hist_iv:{ticker}"
        iv_stats = cache.get(cache_key_hist, db)
        if iv_stats is None:
            hist_prices = fetcher.get_historical_prices(ticker, days=252)
            iv_stats = compute_iv_stats(hist_prices) if hist_prices else {}
            cache.set(cache_key_hist, iv_stats, db, ttl_seconds=settings.cache_ttl)

        cache_key_price = f"stock_price:{ticker}"
        current_price = cache.get(cache_key_price, db)
        if current_price is None:
            current_price = fetcher.get_current_price(ticker) or 0
            cache.set(cache_key_price, current_price, db, ttl_seconds=300)

        candidates, skipped_reason = scan_naked_options(
            ticker=ticker,
            fetcher=fetcher,
            iv_stats=iv_stats,
            min_iv_rank=req.min_iv_rank,
            option_type_filter=req.option_type,
            min_dte=req.min_dte,
            max_dte=req.max_dte,
            min_volume=req.min_volume,
            min_open_interest=req.min_open_interest,
            r=settings.risk_free_rate,
        )

        schema_candidates = [
            NakedCandidateSchema(
                ticker=c.ticker,
                current_price=c.current_price,
                strike=c.strike,
                expiry=c.expiry,
                option_type=c.option_type,
                days_to_expiry=c.days_to_expiry,
                market_price=c.market_price,
                bid=c.bid,
                ask=c.ask,
                volume=c.volume,
                open_interest=c.open_interest,
                iv=c.iv,
                delta=c.delta,
                theta=c.theta,
                iv_rank=c.iv_rank,
                annualized_yield=c.annualized_yield,
                annualized_yield_on_margin=c.annualized_yield_on_margin,
                required_margin_est=c.required_margin_est,
                max_profit=c.max_profit,
                breakeven=c.breakeven,
                breakeven_move_pct=c.breakeven_move_pct,
                days_to_earnings=c.days_to_earnings,
                risk_factors=c.risk_factors,
                naked_score=c.naked_score,
                quality=c.quality,
            )
            for c in candidates
        ]

        result = NakedTickerResult(
            ticker=ticker,
            current_price=round(current_price, 2),
            iv_rank=iv_stats.get("iv_rank"),
            hv_30=iv_stats.get("hv_30"),
            candidates=schema_candidates,
            skipped_reason=skipped_reason,
        )
        return result, len(schema_candidates)

    except Exception as e:
        logger.error(f"Naked scan error for {ticker}: {e}", exc_info=True)
        return NakedTickerResult(ticker=ticker, current_price=0, candidates=[], error=str(e)), 0
    finally:
        db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/scan", response_model=ScanResponse)
def scan_options(req: ScanRequest, db: Session = Depends(get_db)):
    tickers = [t.upper().strip() for t in req.tickers if t.strip()]
    results: list[ScanTickerResult] = [None] * len(tickers)  # type: ignore
    total_candidates = 0

    with ThreadPoolExecutor(max_workers=min(len(tickers), MAX_WORKERS)) as pool:
        future_to_idx = {pool.submit(_scan_one, t, req): i for i, t in enumerate(tickers)}
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            result, count = future.result()
            results[idx] = result
            total_candidates += count

    return ScanResponse(total_candidates=total_candidates, results=results)


@router.post("/naked-scan", response_model=NakedScanResponse)
def scan_naked_options_endpoint(req: NakedScanRequest, db: Session = Depends(get_db)):
    tickers = [t.upper().strip() for t in req.tickers if t.strip()]
    results: list[NakedTickerResult] = [None] * len(tickers)  # type: ignore
    total_candidates = 0

    with ThreadPoolExecutor(max_workers=min(len(tickers), MAX_WORKERS)) as pool:
        future_to_idx = {pool.submit(_scan_naked_one, t, req): i for i, t in enumerate(tickers)}
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            result, count = future.result()
            results[idx] = result
            total_candidates += count

    return NakedScanResponse(total_candidates=total_candidates, results=results)


# ── Scanner Universe ──────────────────────────────────────────────────────────

class ScannerUniverseItem(BaseModel):
    ticker: str
    company: str
    sector: Optional[str] = None
    price: Optional[float] = None
    change_pct: Optional[float] = None
    volume: Optional[float] = None


class ScannerUniverseResponse(BaseModel):
    source: str   # "finviz" | "fallback"
    category: str
    label: str
    items: List[ScannerUniverseItem]
    total: int


@router.get("/scanner-universe", response_model=ScannerUniverseResponse)
def scanner_universe(
    category: str = Query(default="top_volume"),
    max_results: int = Query(default=40, le=80),
    db: Session = Depends(get_db),
):
    """
    Auto-discover liquid, optionable tickers from Finviz screener by category.
    Categories: top_volume, sp500, high_volatility, earnings_week, earnings_next_week.
    Cached for 2 hours.
    """
    if category not in CATEGORIES:
        category = "top_volume"

    cache_key = f"scanner_universe:{category}"
    cached = cache.get(cache_key, db)
    if cached:
        return ScannerUniverseResponse(**cached)

    cat_info = CATEGORIES[category]

    try:
        rows = fetch_scanner_universe(category=category, pages=2, max_results=max_results)
        if rows:
            items = [ScannerUniverseItem(**r) for r in rows]
            result = ScannerUniverseResponse(
                source="finviz",
                category=category,
                label=cat_info["label"],
                items=items,
                total=len(items),
            )
            cache.set(cache_key, result.model_dump(), db, ttl_seconds=2 * 3600)
            return result
    except Exception as e:
        logger.warning(f"Scanner universe fetch failed (category={category}): {e}")

    fallback = FALLBACK_UNIVERSE.get(category, FALLBACK_UNIVERSE["top_volume"])
    items = [ScannerUniverseItem(ticker=t, company=t) for t in fallback[:max_results]]
    result = ScannerUniverseResponse(
        source="fallback",
        category=category,
        label=cat_info["label"],
        items=items,
        total=len(items),
    )
    return result
