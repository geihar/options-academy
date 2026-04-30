"""
Ticker universe discovery for the full-universe scanner.
Primary source: Wikipedia S&P 500 list (reliable, free, no auth required).
Supplement: hardcoded NDX 100 additions and liquid ETFs.
Fallback: curated 60-name list for when network access fails.
"""

import logging
import time
from typing import Optional
import pandas as pd

logger = logging.getLogger(__name__)

# NDX 100 names not already in S&P 500, plus liquid ETFs and popular optionable names.
_NDX_SUPPLEMENT: list[str] = [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "TSLA", "NFLX", "ADBE",
    "PYPL", "INTC", "CSCO", "AVGO", "TXN", "QCOM", "AMD", "SBUX", "GILD", "REGN",
    "VRTX", "ISRG", "MRNA", "BIIB", "ILMN", "LULU", "MELI", "PDD", "BIDU", "JD",
    "SPY", "QQQ", "IWM", "GLD", "TLT", "XLE", "XLF", "XLK", "XLV", "XLI",
    "ARKK", "COIN", "HOOD", "MSTR", "PLTR", "RBLX", "SOFI", "LCID", "RIVN", "SMCI",
]

_FALLBACK_UNIVERSE: list[str] = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "NFLX", "AMD", "INTC",
    "BABA", "DIS", "JPM", "BAC", "GS", "XOM", "CVX", "JNJ", "PFE", "UNH",
    "V", "MA", "PYPL", "SQ", "COIN", "HOOD", "MSTR", "PLTR", "RBLX", "SOFI",
    "SPY", "QQQ", "IWM", "GLD", "SLV", "TLT", "XLE", "XLF", "XLK", "ARKK",
    "COST", "WMT", "TGT", "AMGN", "GILD", "MRK", "ABBV", "BMY", "LLY", "REGN",
    "TSMC", "ASML", "AMAT", "KLAC", "LRCX", "MU", "MRVL", "QCOM", "AVGO", "TXN",
]


class TickerUniverse:
    """
    Fetches and caches the universe of scannable, optionable tickers.
    Wikipedia S&P 500 is the primary source (~500 tickers).
    NDX supplement adds ~50 high-vol tech/crypto names.
    Falls back to _FALLBACK_UNIVERSE if network is unavailable.
    """

    _cached_tickers: Optional[list[str]] = None
    _cache_source: str = "unknown"
    _cache_time: float = 0.0
    _CACHE_TTL_SECONDS: float = 6 * 3600  # refresh every 6 hours

    def get_tickers(self, max_results: Optional[int] = None) -> list[str]:
        """
        Returns a deduplicated, sorted list of optionable tickers.
        Caches the result for 6 hours to avoid repeated Wikipedia fetches.
        """
        now = time.time()
        if (
            self._cached_tickers is not None
            and now - self._cache_time < self._CACHE_TTL_SECONDS
        ):
            tickers = self._cached_tickers
        else:
            tickers = self._load_fresh()
            TickerUniverse._cached_tickers = tickers
            TickerUniverse._cache_time = now

        return tickers[:max_results] if max_results else tickers

    def get_source(self) -> str:
        """Returns the data source used for the last successful fetch."""
        return self._cache_source

    def _load_fresh(self) -> list[str]:
        """Fetch fresh universe. Tries Wikipedia first, falls back to curated list."""
        sp500: list[str] = []
        try:
            sp500 = self._fetch_sp500_wikipedia()
            logger.info(f"Loaded {len(sp500)} tickers from Wikipedia S&P 500")
            TickerUniverse._cache_source = "wikipedia_sp500"
        except Exception as exc:
            logger.warning(f"Wikipedia S&P 500 fetch failed ({exc}), using fallback universe")
            TickerUniverse._cache_source = "fallback"
            return sorted(set(_FALLBACK_UNIVERSE))

        combined = list(set(sp500 + _NDX_SUPPLEMENT))
        combined = [t for t in combined if t and 1 <= len(t) <= 6]
        combined.sort()
        logger.info(f"Universe ready: {len(combined)} tickers (S&P 500 + NDX supplement)")
        return combined

    def _fetch_sp500_wikipedia(self) -> list[str]:
        """
        Scrape the S&P 500 constituent list from Wikipedia.
        Returns Yahoo Finance-compatible symbols (dots replaced with dashes).
        """
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        tables = pd.read_html(url, header=0)
        symbols = tables[0]["Symbol"].dropna().tolist()
        # Yahoo Finance uses BRK-B not BRK.B
        return [str(s).replace(".", "-").strip().upper() for s in symbols]

    def info(self) -> dict:
        """Returns a summary dict for the /ticker-universe info endpoint."""
        tickers = self.get_tickers()
        return {
            "source": self.get_source(),
            "total": len(tickers),
            "tickers": tickers,
        }


# Module-level singleton — shared across all requests.
ticker_universe = TickerUniverse()
