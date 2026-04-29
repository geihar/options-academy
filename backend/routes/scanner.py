import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from data.fetcher import DataFetcher
from data.cache import cache
from analytics.iv_calculator import compute_iv_stats
from analytics.scanner_engine import scan_ticker_options, scan_naked_options
from schemas import (
    ScanRequest, ScanResponse, ScanTickerResult, ScannerCandidateSchema,
    ChapterSignalSchema, ProfitForecastSchema, EvidenceItemSchema,
    NakedScanRequest, NakedScanResponse, NakedTickerResult, NakedCandidateSchema,
)
from config import settings

router = APIRouter()
fetcher = DataFetcher(polygon_api_key=settings.polygon_api_key)
logger = logging.getLogger(__name__)


@router.post("/scan", response_model=ScanResponse)
def scan_options(req: ScanRequest, db: Session = Depends(get_db)):
    """
    Scan multiple tickers for high-quality options setups.
    Evaluates each candidate against Trading Volatility book chapters and
    provides profit forecasts with quantitative backing.
    """
    tickers = [t.upper().strip() for t in req.tickers if t.strip()]
    results: list[ScanTickerResult] = []
    total_candidates = 0

    for ticker in tickers:
        try:
            # IV stats (cached 15min)
            cache_key_hist = f"hist_iv:{ticker}"
            iv_stats = cache.get(cache_key_hist, db)
            if iv_stats is None:
                hist_prices = fetcher.get_historical_prices(ticker, days=252)
                iv_stats = compute_iv_stats(hist_prices) if hist_prices else {}
                cache.set(cache_key_hist, iv_stats, db, ttl_seconds=settings.cache_ttl)

            # Current price for header
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

            # Convert dataclasses to Pydantic schemas
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

            total_candidates += len(schema_candidates)
            results.append(ScanTickerResult(
                ticker=ticker,
                current_price=round(current_price, 2),
                iv_rank=iv_stats.get("iv_rank"),
                hv_30=iv_stats.get("hv_30"),
                days_to_earnings=None,  # included per-candidate
                candidates=schema_candidates,
            ))

        except Exception as e:
            logger.error(f"Scanner error for {ticker}: {e}", exc_info=True)
            results.append(ScanTickerResult(
                ticker=ticker,
                current_price=0,
                candidates=[],
                error=str(e),
            ))

    return ScanResponse(total_candidates=total_candidates, results=results)


@router.post("/naked-scan", response_model=NakedScanResponse)
def scan_naked_options_endpoint(req: NakedScanRequest, db: Session = Depends(get_db)):
    """
    Scan tickers for naked (uncovered) short option candidates.
    Pre-filters by IV Rank, then finds OTM options with attractive premium/risk ratio.
    """
    tickers = [t.upper().strip() for t in req.tickers if t.strip()]
    results: list[NakedTickerResult] = []
    total_candidates = 0

    for ticker in tickers:
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

            total_candidates += len(schema_candidates)
            results.append(NakedTickerResult(
                ticker=ticker,
                current_price=round(current_price, 2),
                iv_rank=iv_stats.get("iv_rank"),
                hv_30=iv_stats.get("hv_30"),
                candidates=schema_candidates,
                skipped_reason=skipped_reason,
            ))

        except Exception as e:
            logger.error(f"Naked scan error for {ticker}: {e}", exc_info=True)
            results.append(NakedTickerResult(
                ticker=ticker,
                current_price=0,
                candidates=[],
                error=str(e),
            ))

    return NakedScanResponse(total_candidates=total_candidates, results=results)
