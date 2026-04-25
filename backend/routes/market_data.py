import math
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from data.fetcher import DataFetcher
from data.cache import cache
from analytics.black_scholes import black_scholes, implied_volatility
from analytics.iv_calculator import compute_iv_stats
from schemas import OptionsChainResponse, OptionContract
from config import settings

router = APIRouter()
fetcher = DataFetcher(polygon_api_key=settings.polygon_api_key)


def _enrich_option(opt: dict, current_price: float, r: float) -> OptionContract:
    """Add BS-computed Greeks if IV is available."""
    strike = opt["strike"]
    expiry_str = opt["expiry"]
    option_type = opt["option_type"]
    iv = opt.get("iv")

    delta = None
    gamma = None
    theta = None
    vega = None
    computed_iv = iv

    try:
        expiry_date = date.fromisoformat(expiry_str)
        T = max((expiry_date - date.today()).days, 1) / 365.0
        mid_price = (opt["bid"] + opt["ask"]) / 2 if opt["bid"] and opt["ask"] else opt["last"]

        # If yfinance didn't provide IV, compute it from mid price
        if not computed_iv and mid_price > 0:
            computed_iv = implied_volatility(mid_price, current_price, strike, T, r, option_type)

        if computed_iv and computed_iv > 0:
            bs = black_scholes(current_price, strike, T, r, computed_iv, option_type)
            delta = round(bs.delta, 3)
            gamma = round(bs.gamma, 5)
            theta = round(bs.theta, 3)
            vega = round(bs.vega, 3)

    except Exception:
        pass

    return OptionContract(
        strike=strike,
        expiry=expiry_str,
        option_type=option_type,
        bid=opt["bid"],
        ask=opt["ask"],
        last=opt["last"],
        volume=opt["volume"],
        open_interest=opt["open_interest"],
        iv=round(computed_iv, 4) if computed_iv else None,
        delta=delta,
        gamma=gamma,
        theta=theta,
        vega=vega,
    )


@router.get("/options-chain/{ticker}", response_model=OptionsChainResponse)
def get_options_chain(ticker: str, db: Session = Depends(get_db)):
    """
    Fetch full options chain for a ticker.
    Results are cached for 15 minutes to avoid hammering yfinance.
    """
    ticker = ticker.upper()
    cache_key = f"options_chain:{ticker}"

    cached = cache.get(cache_key, db)
    if cached:
        return OptionsChainResponse(**cached)

    chain_data = fetcher.get_options_chain(ticker)

    if not chain_data["expirations"] and chain_data["current_price"] == 0.0:
        raise HTTPException(status_code=404, detail=f"No data found for ticker {ticker}")

    current_price = chain_data["current_price"]
    r = settings.risk_free_rate

    # Compute IV stats from historical prices
    hist_prices = fetcher.get_historical_prices(ticker, days=252)
    iv_stats = compute_iv_stats(hist_prices) if hist_prices else {}

    # Enrich all options with Greeks
    enriched_calls = [_enrich_option(opt, current_price, r) for opt in chain_data["calls"]]
    enriched_puts = [_enrich_option(opt, current_price, r) for opt in chain_data["puts"]]

    result = OptionsChainResponse(
        ticker=ticker,
        current_price=current_price,
        expirations=chain_data["expirations"],
        calls=enriched_calls,
        puts=enriched_puts,
        iv_rank=iv_stats.get("iv_rank"),
        iv_percentile=iv_stats.get("iv_percentile"),
        hv_30=iv_stats.get("hv_30"),
    )

    cache.set(cache_key, result.model_dump(), db, ttl_seconds=settings.cache_ttl)
    return result


@router.get("/stock/{ticker}")
def get_stock(ticker: str, db: Session = Depends(get_db)):
    """Current stock price + basic information."""
    ticker = ticker.upper()
    cache_key = f"stock_info:{ticker}"

    cached = cache.get(cache_key, db)
    if cached:
        return cached

    info = fetcher.get_stock_info(ticker)

    if not info.get("current_price"):
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")

    cache.set(cache_key, info, db, ttl_seconds=300)  # 5min for price
    return info
