import math
import random
import uuid
from datetime import date, timedelta
from typing import Optional
import numpy as np
import pandas as pd
import yfinance as yf

from analytics.black_scholes import black_scholes
from analytics.iv_calculator import compute_rolling_hv_series

# Curated pool: (ticker, start_date, end_date) — historical range to sample from
TICKER_POOL = [
    ("AAPL", "2022-02-01", "2024-01-01"),
    ("SPY",  "2022-02-01", "2024-01-01"),
    ("TSLA", "2022-04-01", "2024-01-01"),
    ("MSFT", "2022-02-01", "2024-01-01"),
    ("NVDA", "2022-06-01", "2024-01-01"),
    ("AMD",  "2022-06-01", "2024-01-01"),
    ("AMZN", "2022-02-01", "2024-01-01"),
    ("QQQ",  "2022-02-01", "2024-01-01"),
    ("META", "2022-06-01", "2024-01-01"),
]


def _format_date_ru(d: date) -> str:
    months = ["января", "февраля", "марта", "апреля", "мая", "июня",
              "июля", "августа", "сентября", "октября", "ноября", "декабря"]
    return f"{d.day} {months[d.month - 1]} {d.year}"


def _strike_increment(price: float) -> float:
    if price < 50:   return 1.0
    if price < 200:  return 2.5
    if price < 500:  return 5.0
    return 10.0


def pick_random_scenario(exclude_dates: list = None) -> tuple:
    """Pick random (ticker, scenario_date_str) from pool."""
    ticker, start_str, end_str = random.choice(TICKER_POOL)
    start_dt = date.fromisoformat(start_str)
    end_dt = date.fromisoformat(end_str)
    days_range = (end_dt - start_dt).days
    for _ in range(20):
        offset = random.randint(45, days_range - 45)
        candidate = start_dt + timedelta(days=offset)
        # skip weekends
        if candidate.weekday() < 5:
            return ticker, candidate.isoformat()
    return ticker, (start_dt + timedelta(days=60)).isoformat()


def fetch_scenario_data(ticker: str, scenario_date: str, r: float = 0.05) -> dict:
    """
    Fetch historical data and build a complete scenario dict.
    Returns everything needed to render the game scenario.
    Does NOT include future_prices (kept server-side).
    """
    scenario_dt = date.fromisoformat(scenario_date)
    fetch_start = (scenario_dt - timedelta(days=400)).isoformat()
    fetch_end   = (scenario_dt + timedelta(days=50)).isoformat()

    stock = yf.Ticker(ticker)
    hist = stock.history(start=fetch_start, end=fetch_end)
    if hist.empty or len(hist) < 40:
        raise ValueError(f"Insufficient data for {ticker} at {scenario_date}")

    hist.index = hist.index.tz_localize(None) if hist.index.tz is not None else hist.index
    hist_dates = pd.to_datetime(hist.index).date

    past_mask   = hist_dates <= scenario_dt
    future_mask = hist_dates > scenario_dt

    past_closes   = hist.loc[past_mask,   "Close"].values.tolist()
    future_closes = hist.loc[future_mask, "Close"].values.tolist()

    if len(past_closes) < 31:
        raise ValueError(f"Insufficient past history for {ticker} at {scenario_date}")

    entry_price = float(past_closes[-1])

    # 30-day HV
    prices_for_hv = past_closes[-31:]
    log_returns = [math.log(prices_for_hv[i] / prices_for_hv[i - 1]) for i in range(1, len(prices_for_hv))]
    hv_30 = float(np.std(log_returns) * math.sqrt(252)) if log_returns else 0.25

    # IV = HV * premium factor
    premium_factor = random.uniform(1.05, 1.20)
    iv_used = round(max(0.05, hv_30 * premium_factor), 4)

    # 30-day price return for narrative
    price_30d_ago = float(past_closes[-31])
    return_30d = (entry_price - price_30d_ago) / price_30d_ago

    if return_30d > 0.08:    trend = "сильный восходящий тренд"
    elif return_30d > 0.02:  trend = "умеренный рост"
    elif return_30d > -0.02: trend = "боковое движение"
    elif return_30d > -0.08: trend = "незначительное снижение"
    else:                    trend = "выраженное снижение"

    narrative = (
        f"Сейчас {_format_date_ru(scenario_dt)}. {ticker} торгуется по ${entry_price:.2f}. "
        f"За последние 30 дней акция показала {trend} ({return_30d * 100:+.1f}%). "
        f"Историческая волатильность составляет {hv_30 * 100:.1f}%, "
        f"подразумеваемая волатильность — {iv_used * 100:.1f}%. "
        f"Какую позицию вы откроете?"
    )

    # Generate options chain
    chain = generate_options_chain(ticker, scenario_date, entry_price, iv_used, r)

    # 30d past price history for sparkline (dates + prices)
    past_dates_all = [str(d) for d in hist_dates[past_mask]]
    past_prices_chart = [round(float(p), 2) for p in past_closes]
    # only last 30
    past_dates_chart = past_dates_all[-30:]
    past_prices_30d  = past_prices_chart[-30:]

    return {
        "ticker": ticker,
        "scenario_date": scenario_date,
        "entry_price": round(entry_price, 2),
        "hv_30": round(hv_30, 4),
        "iv_used": iv_used,
        "past_prices_30d": past_prices_30d,
        "past_dates_30d": past_dates_chart,
        "future_closes": [round(float(p), 2) for p in future_closes[:45]],  # server-side only
        "narrative": narrative,
        "market_context": {
            "return_30d": round(return_30d * 100, 2),
            "trend_description": trend,
            "hv_30_pct": round(hv_30 * 100, 1),
            "iv_used_pct": round(iv_used * 100, 1),
        },
        "options_chain": chain,
    }


def generate_options_chain(
    ticker: str,
    scenario_date: str,
    entry_price: float,
    iv: float,
    r: float = 0.05,
) -> dict:
    """Generate synthetic but realistic options chain using Black-Scholes."""
    scenario_dt = date.fromisoformat(scenario_date)
    increment = _strike_increment(entry_price)
    atm = round(entry_price / increment) * increment
    strikes = [round(atm + i * increment, 2) for i in range(-5, 6)]
    expiry_days = [7, 14, 21, 30, 45]
    expirations = [(scenario_dt + timedelta(days=d)).isoformat() for d in expiry_days]

    call_list, put_list = [], []
    base_oi_atm = 5000

    for exp_str, days in zip(expirations, expiry_days):
        T = days / 365.0
        for strike in strikes:
            for opt_type in ("call", "put"):
                result = black_scholes(S=entry_price, K=strike, T=T, r=r, sigma=iv, option_type=opt_type)
                if result is None or result.price < 0.01:
                    continue
                mid = round(result.price, 2)
                spread_half = max(0.01, round(mid * 0.02, 2))
                bid = round(max(0.01, mid - spread_half), 2)
                ask = round(mid + spread_half, 2)
                # OI: highest at ATM, decreasing with distance
                dist = abs(strike - atm) / increment
                oi = max(50, int(base_oi_atm * math.exp(-0.4 * dist)))
                volume = max(0, int(oi * random.uniform(0.05, 0.3)))

                contract = {
                    "option_type": opt_type,
                    "strike": strike,
                    "expiry": exp_str,
                    "bid": bid,
                    "ask": ask,
                    "last": mid,
                    "iv": round(iv * random.uniform(0.97, 1.03), 4),
                    "delta": round(result.delta, 4),
                    "gamma": round(result.gamma, 5),
                    "theta": round(result.theta, 5),
                    "vega": round(result.vega, 4),
                    "volume": volume,
                    "open_interest": oi,
                }
                if opt_type == "call":
                    call_list.append(contract)
                else:
                    put_list.append(contract)

    return {
        "calls": call_list,
        "puts": put_list,
        "expirations": expirations,
        "current_price": round(entry_price, 2),
    }


def resolve_scenario(
    ticker: str,
    scenario_date: str,
    forward_days: int,
    legs: list,
    entry_price: float,
    iv_at_entry: float,
    future_closes: list,
    r: float = 0.05,
) -> dict:
    """
    Compute P&L for a trade resolved after forward_days.
    Uses BS mark-to-market for unexpired options, intrinsic for expired.
    """
    scenario_dt = date.fromisoformat(scenario_date)
    exit_dt = scenario_dt + timedelta(days=forward_days)

    # Get exit price from future_closes
    if not future_closes or forward_days > len(future_closes):
        raise ValueError("Not enough future price data for resolution")
    exit_price = float(future_closes[min(forward_days - 1, len(future_closes) - 1)])

    # Build price history for chart
    price_history = []
    all_dates = [str(scenario_dt + timedelta(days=i)) for i in range(forward_days + 1)]
    combined = [entry_price] + future_closes[:forward_days]
    for d_str, p in zip(all_dates, combined):
        price_history.append({"date": d_str, "price": round(p, 2)})

    # IV mean-reversion at exit
    iv_exit = iv_at_entry * 0.85  # typical post-event vol compression

    pnl_per_leg = []
    total_pnl = 0.0

    for leg in legs:
        exp_dt = date.fromisoformat(leg["expiry"])
        T_entry = (exp_dt - scenario_dt).days / 365.0
        T_exit  = max(0, (exp_dt - exit_dt).days) / 365.0
        sign = 1 if leg["direction"] == "long" else -1

        if T_exit <= 0:
            # Expired: use intrinsic
            if leg["option_type"] == "call":
                exit_val = max(0.0, exit_price - leg["strike"])
            else:
                exit_val = max(0.0, leg["strike"] - exit_price)
        else:
            # Mark to market with BS
            result_exit = black_scholes(
                S=exit_price, K=leg["strike"], T=T_exit, r=r,
                sigma=iv_exit, option_type=leg["option_type"]
            )
            exit_val = result_exit.price if result_exit else 0.0

        entry_val = leg["entry_premium"]
        leg_pnl = sign * (exit_val - entry_val) * 100 * leg.get("contracts", 1)
        total_pnl += leg_pnl
        pnl_per_leg.append({
            "option_type": leg["option_type"],
            "strike": leg["strike"],
            "expiry": leg["expiry"],
            "direction": leg["direction"],
            "entry_premium": entry_val,
            "exit_value": round(exit_val, 4),
            "pnl": round(leg_pnl, 2),
        })

    return {
        "exit_price": round(exit_price, 2),
        "total_pnl": round(total_pnl, 2),
        "pnl_per_leg": pnl_per_leg,
        "price_history": price_history,
    }


def compute_score(total_pnl: float, capital_risked: float, legs: list, entry_price: float, exit_price: float) -> dict:
    """Score a completed trade round. Returns breakdown dict + total."""
    capital = max(capital_risked, 100)
    pnl_pct = total_pnl / capital

    # Base P&L score (0-60)
    if pnl_pct > 0.20:    base = 60
    elif pnl_pct > 0.10:  base = 45
    elif pnl_pct > 0.0:   base = 30
    elif pnl_pct > -0.10: base = 15
    else:                  base = 0

    # Strategy quality (0-25)
    quality = 0
    has_defined_risk = len(legs) >= 2  # spread = defined risk
    if has_defined_risk: quality += 10
    if capital <= 1000:  quality += 8  # position sizing OK
    net_theta = sum(
        (-1 if l["direction"] == "long" else 1) * abs(l.get("entry_premium", 0) * 0.01)
        for l in legs
    )
    if net_theta > 0:    quality += 7  # positive theta position

    # Direction accuracy (0-15)
    direction = 0
    price_up = exit_price > entry_price
    for leg in legs:
        correct = (
            (leg["option_type"] == "call" and leg["direction"] == "long"  and price_up) or
            (leg["option_type"] == "put"  and leg["direction"] == "long"  and not price_up) or
            (leg["option_type"] == "put"  and leg["direction"] == "short" and price_up) or
            (leg["option_type"] == "call" and leg["direction"] == "short" and not price_up)
        )
        if correct:
            direction = 15
            break

    total = base + quality + direction
    return {
        "base_pnl": base,
        "strategy_quality": quality,
        "direction_accuracy": direction,
        "total": total,
    }


def get_rank(total_score: int) -> str:
    if total_score >= 1000: return "Мастер"
    if total_score >= 600:  return "Опционщик"
    if total_score >= 300:  return "Трейдер"
    if total_score >= 100:  return "Стажёр"
    return "Новичок"
