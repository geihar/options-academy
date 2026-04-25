import numpy as np
import pandas as pd
from typing import Optional


def compute_hv(prices: list[float], window: int = 30) -> Optional[float]:
    """
    Compute Historical Volatility (annualized) from a list of closing prices.
    Uses log returns over the specified window.
    """
    if len(prices) < window + 1:
        return None

    prices_arr = np.array(prices)
    log_returns = np.log(prices_arr[1:] / prices_arr[:-1])

    # Use last `window` log returns
    recent_returns = log_returns[-window:]
    hv = np.std(recent_returns, ddof=1) * np.sqrt(252)
    return float(hv)


def compute_iv_rank(current_iv: float, historical_ivs: list[float]) -> Optional[float]:
    """
    IV Rank (0-100): Where is current IV relative to the range over the past year?
    IV Rank = (current_IV - 52w_low) / (52w_high - 52w_low) * 100
    """
    if not historical_ivs or len(historical_ivs) < 20:
        return None

    low = min(historical_ivs)
    high = max(historical_ivs)

    if high == low:
        return 50.0

    rank = (current_iv - low) / (high - low) * 100
    return max(0.0, min(100.0, float(rank)))


def compute_iv_percentile(current_iv: float, historical_ivs: list[float]) -> Optional[float]:
    """
    IV Percentile (0-100): What % of days in the past year had IV BELOW current IV?
    Different from IV Rank — measures frequency, not position in range.
    """
    if not historical_ivs or len(historical_ivs) < 20:
        return None

    days_below = sum(1 for iv in historical_ivs if iv < current_iv)
    percentile = days_below / len(historical_ivs) * 100
    return float(percentile)


def compute_rolling_hv_series(prices: list[float], window: int = 30) -> list[float]:
    """
    Compute a rolling HV series from price history.
    Returns a list of HV values, one per trading day (after the first window+1 days).
    Used as a proxy for historical IV when actual IV data is unavailable.
    """
    if len(prices) < window + 2:
        return []

    prices_arr = np.array(prices)
    log_returns = np.log(prices_arr[1:] / prices_arr[:-1])

    hv_series = []
    for i in range(window, len(log_returns)):
        window_returns = log_returns[i - window: i]
        hv = np.std(window_returns, ddof=1) * np.sqrt(252)
        hv_series.append(float(hv))

    return hv_series


def compute_iv_stats(prices: list[float]) -> dict:
    """
    Given 252 days of historical prices, compute:
    - 30-day HV (as proxy for current implied vol when real IV unavailable)
    - rolling HV series (as proxy for historical IVs)
    - IV Rank and IV Percentile using HV proxy

    Returns a dict with: hv_30, hv_series, iv_rank, iv_percentile
    """
    hv_30 = compute_hv(prices, window=30)

    # Build rolling 30-day HV series as IV proxy
    hv_series = compute_rolling_hv_series(prices, window=30)

    iv_rank = None
    iv_percentile = None

    if hv_30 is not None and hv_series:
        iv_rank = compute_iv_rank(hv_30, hv_series)
        iv_percentile = compute_iv_percentile(hv_30, hv_series)

    return {
        "hv_30": hv_30,
        "hv_series": hv_series,
        "iv_rank": iv_rank,
        "iv_percentile": iv_percentile,
    }


def compute_expected_move(atm_call_price: float, atm_put_price: float) -> float:
    """
    Expected move = ATM call + ATM put (straddle price).
    Represents the market's 1 standard deviation expected move by expiry.
    """
    return atm_call_price + atm_put_price
