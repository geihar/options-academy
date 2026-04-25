"""
Options Scanner Engine
Scans a list of tickers, finds best option candidates per strategy,
evaluates them against Trading Volatility book chapters, and
produces profit forecasts with quantitative backing.
"""

import math
import logging
from datetime import date
from typing import Optional
from dataclasses import dataclass, field

from analytics.black_scholes import black_scholes, implied_volatility
from analytics.iv_calculator import compute_iv_stats, compute_expected_move
from analytics.earnings_data import days_to_earnings, get_next_earnings_date
from analytics.book_context import get_all_chapter_signals, compute_composite_score, ChapterSignal

logger = logging.getLogger(__name__)


@dataclass
class ProfitForecast:
    """Quantitative profit forecast for a specific option."""
    expected_value: float            # EV per contract (100 shares)
    max_profit: float                # best case per contract
    max_loss: float                  # worst case per contract
    breakeven: float                 # stock price at breakeven
    breakeven_move_pct: float        # % move needed for breakeven
    breakeven_vs_1sd: float          # breakeven in units of 1 std dev
    expected_move_1sd: float         # 1 std dev move in $ terms
    prob_profit: float               # approx probability of being profitable (0-1)
    annualized_return_if_target: float  # annualized % return if hits 50% of max profit
    scenario_bull: float             # P&L if stock +10%
    scenario_bear: float             # P&L if stock -10%
    scenario_flat: float             # P&L if stock +0% (theta decay)
    theta_drag_total: float          # total theta drag to expiry


@dataclass
class ScannerCandidate:
    """A single option candidate returned by the scanner."""
    ticker: str
    current_price: float
    strike: float
    expiry: str
    option_type: str
    days_to_expiry: int
    market_price: float              # mid price
    bid: float
    ask: float
    volume: int
    open_interest: int

    # Greeks
    iv: Optional[float]
    delta: Optional[float]
    gamma: Optional[float]
    theta: Optional[float]
    vega: Optional[float]

    # IV stats
    iv_rank: Optional[float]
    iv_percentile: Optional[float]
    hv_30: Optional[float]
    iv_premium: Optional[float]      # IV - HV30

    # Earnings
    days_to_earnings: Optional[int]
    next_earnings_date: Optional[str]

    # Scoring
    composite_score: float
    chapter_signals: list[ChapterSignal]

    # Forecast
    forecast: ProfitForecast

    # Strategy recommendation
    recommended_strategy: str
    strategy_rationale: str
    setup_quality: str               # "Отличная" / "Хорошая" / "Средняя" / "Слабая"


def _compute_forecast(
    current_price: float,
    strike: float,
    option_type: str,
    market_price: float,
    iv: float,
    delta: float,
    theta: float,
    days_to_expiry: int,
) -> ProfitForecast:
    """Compute quantitative P&L forecast for an option position (long 1 contract)."""
    T = max(days_to_expiry, 1) / 365.0
    multiplier = 100

    # Expected 1-std-dev move
    expected_move_1sd = current_price * iv * math.sqrt(T)

    # Breakeven
    if option_type == "call":
        breakeven = strike + market_price
        move_to_be = breakeven - current_price
    else:
        breakeven = strike - market_price
        move_to_be = current_price - breakeven

    move_pct = move_to_be / current_price * 100 if current_price > 0 else 0
    be_vs_1sd = move_to_be / expected_move_1sd if expected_move_1sd > 0 else 99

    # Probability of profit ≈ probability ITM (delta proxy)
    prob_profit = abs(delta)

    # Scenarios: stock ±10% and flat at expiry
    scenarios = {}
    for label, stock_pct in [("bull", 1.10), ("bear", 0.90), ("flat", 1.0)]:
        exit_price = current_price * stock_pct
        if option_type == "call":
            intrinsic = max(0.0, exit_price - strike)
        else:
            intrinsic = max(0.0, strike - exit_price)
        pnl = (intrinsic - market_price) * multiplier
        scenarios[label] = round(pnl, 2)

    # Max profit / max loss
    max_loss = market_price * multiplier  # premium paid
    if option_type == "call":
        # Unlimited upside, estimate using 2× expected move
        target_price = current_price + expected_move_1sd * 2
        max_profit = max(0, target_price - strike - market_price) * multiplier
    else:
        target_price = max(0, current_price - expected_move_1sd * 2)
        max_profit = max(0, strike - target_price - market_price) * multiplier

    # Expected Value = P(profit) * avg_gain - P(loss) * premium
    avg_gain_if_profit = max_profit * 0.5  # conservative: assume half of max
    ev = prob_profit * avg_gain_if_profit - (1 - prob_profit) * max_loss

    # Annualized return if we hit 50% of max profit
    target_pnl = max_profit * 0.5
    cost_basis = market_price * multiplier
    if cost_basis > 0 and days_to_expiry > 0 and target_pnl > 0:
        ann_return = (target_pnl / cost_basis) * (365.0 / days_to_expiry) * 100
    else:
        ann_return = 0.0

    # Total theta drag
    theta_drag = abs(theta) * days_to_expiry * multiplier

    return ProfitForecast(
        expected_value=round(ev, 2),
        max_profit=round(max_profit, 2),
        max_loss=round(max_loss, 2),
        breakeven=round(breakeven, 2),
        breakeven_move_pct=round(move_pct, 2),
        breakeven_vs_1sd=round(be_vs_1sd, 2),
        expected_move_1sd=round(expected_move_1sd, 2),
        prob_profit=round(prob_profit, 3),
        annualized_return_if_target=round(ann_return, 1),
        scenario_bull=scenarios["bull"],
        scenario_bear=scenarios["bear"],
        scenario_flat=scenarios["flat"],
        theta_drag_total=round(theta_drag, 2),
    )


def _setup_quality(score: float) -> str:
    if score >= 72:
        return "Отличная"
    elif score >= 55:
        return "Хорошая"
    elif score >= 38:
        return "Средняя"
    else:
        return "Слабая"


def _recommend_strategy(
    signals: list[ChapterSignal],
    iv_rank: Optional[float],
    option_type: str,
    delta: Optional[float],
    days_to_expiry: int,
) -> tuple[str, str]:
    """Pick the top strategy based on signals."""
    if not signals:
        return ("Нет сигнала", "Недостаточно данных для рекомендации")

    # Rank by score
    top = sorted(signals, key=lambda s: s.score, reverse=True)[0]
    strategy = top.strategy_hint
    rationale = (
        f"Сильнейший сигнал: {top.chapter} «{top.chapter_title}» (оценка {top.score:.0f}/100). "
        f"{top.profit_catalyst}"
    )
    return strategy, rationale


def scan_ticker_options(
    ticker: str,
    fetcher,
    iv_stats: dict,
    min_volume: int = 10,
    min_open_interest: int = 50,
    min_dte: int = 5,
    max_dte: int = 60,
    strategies: list[str] = None,  # ["sell_premium", "buy_calls", "buy_puts", "any"]
    r: float = 0.05,
) -> list[ScannerCandidate]:
    """
    Scan all options for a ticker and return top candidates.
    Returns list of ScannerCandidate sorted by composite_score descending.
    """
    if strategies is None:
        strategies = ["any"]

    try:
        chain_data = fetcher.get_options_chain(ticker)
    except Exception as e:
        logger.warning(f"Failed to fetch chain for {ticker}: {e}")
        return []

    current_price = chain_data.get("current_price", 0)
    if not current_price:
        return []

    # Earnings info
    dte_earn = days_to_earnings(ticker)
    next_earn = get_next_earnings_date(ticker)
    next_earn_str = next_earn.isoformat() if next_earn else None

    hv_30 = iv_stats.get("hv_30")
    iv_rank = iv_stats.get("iv_rank")
    iv_percentile = iv_stats.get("iv_percentile")

    candidates = []
    today = date.today()

    all_options = []
    for opt in chain_data.get("calls", []):
        all_options.append({**opt, "option_type": "call"})
    for opt in chain_data.get("puts", []):
        all_options.append({**opt, "option_type": "put"})

    for opt in all_options:
        try:
            expiry_date = date.fromisoformat(opt["expiry"])
        except (ValueError, KeyError):
            continue

        dte = (expiry_date - today).days
        if dte < min_dte or dte > max_dte:
            continue

        volume = opt.get("volume", 0) or 0
        oi = opt.get("open_interest", 0) or 0
        if volume < min_volume or oi < min_open_interest:
            continue

        bid = opt.get("bid", 0) or 0
        ask = opt.get("ask", 0) or 0
        last = opt.get("last", 0) or 0
        mid = (bid + ask) / 2 if bid and ask else last
        if mid <= 0:
            continue

        option_type = opt["option_type"]
        strike = opt["strike"]

        # Strategy filter
        if "any" not in strategies:
            s = strategies[0] if strategies else "any"
            if s == "sell_puts" and option_type != "put":
                continue
            elif s == "sell_calls" and option_type != "call":
                continue
            elif s == "buy_calls" and option_type != "call":
                continue
            elif s == "buy_puts" and option_type != "put":
                continue
            # sell_premium → allow both call and put (no filter)

        T = max(dte, 1) / 365.0

        # Compute IV and Greeks
        iv = opt.get("iv")
        if not iv:
            try:
                iv = implied_volatility(mid, current_price, strike, T, r, option_type)
            except Exception:
                iv = None

        if not iv or iv <= 0:
            continue

        try:
            bs = black_scholes(current_price, strike, T, r, iv, option_type)
        except Exception:
            continue

        delta = round(bs.delta, 4)
        gamma = round(bs.gamma, 6)
        theta = round(bs.theta, 4)
        vega = round(bs.vega, 4)
        iv_premium = (iv - hv_30) if (iv and hv_30) else None

        # Get chapter signals
        signals = get_all_chapter_signals(
            ticker=ticker,
            iv=iv,
            hv_30=hv_30,
            iv_rank=iv_rank,
            days_to_expiry=dte,
            days_to_earnings=dte_earn,
            delta=delta,
            gamma=gamma,
            theta=theta,
            vega=vega,
            market_price=mid,
            current_price=current_price,
            strike=strike,
            option_type=option_type,
        )

        # Drop lottery-ticket options — delta < 0.10 means < 10% chance of profit
        if abs(delta) < 0.10:
            continue

        composite = compute_composite_score(signals)
        if composite < 20:
            continue  # skip noise

        forecast = _compute_forecast(
            current_price=current_price,
            strike=strike,
            option_type=option_type,
            market_price=mid,
            iv=iv,
            delta=delta,
            theta=theta,
            days_to_expiry=dte,
        )

        strategy, rationale = _recommend_strategy(signals, iv_rank, option_type, delta, dte)

        candidates.append(ScannerCandidate(
            ticker=ticker,
            current_price=current_price,
            strike=strike,
            expiry=opt["expiry"],
            option_type=option_type,
            days_to_expiry=dte,
            market_price=round(mid, 4),
            bid=bid,
            ask=ask,
            volume=volume,
            open_interest=oi,
            iv=round(iv, 4),
            delta=delta,
            gamma=gamma,
            theta=theta,
            vega=vega,
            iv_rank=round(iv_rank, 1) if iv_rank is not None else None,
            iv_percentile=round(iv_percentile, 1) if iv_percentile is not None else None,
            hv_30=round(hv_30, 4) if hv_30 else None,
            iv_premium=round(iv_premium, 4) if iv_premium else None,
            days_to_earnings=dte_earn,
            next_earnings_date=next_earn_str,
            composite_score=composite,
            chapter_signals=signals,
            forecast=forecast,
            recommended_strategy=strategy,
            strategy_rationale=rationale,
            setup_quality=_setup_quality(composite),
        ))

    # Sort by score, return top 5 per ticker
    candidates.sort(key=lambda c: c.composite_score, reverse=True)
    return candidates[:5]
