import logging
from typing import Optional
import pandas as pd

logger = logging.getLogger(__name__)


class DataFetcher:
    def __init__(self, polygon_api_key: Optional[str] = None):
        self.polygon_api_key = polygon_api_key

    def get_current_price(self, ticker: str) -> Optional[float]:
        """Get the most recent closing price for a ticker."""
        try:
            import yfinance as yf
            stock = yf.Ticker(ticker.upper())
            hist = stock.history(period="5d")
            if hist.empty:
                return None
            return float(hist["Close"].iloc[-1])
        except Exception as e:
            logger.error(f"get_current_price error for {ticker}: {e}")
            return None

    def get_historical_prices(self, ticker: str, days: int = 252) -> list[float]:
        """
        Fetch `days` trading days of closing prices.
        Returns a list ordered oldest → newest.
        """
        try:
            import yfinance as yf
            period = f"{max(days + 60, 300)}d"  # fetch extra to account for weekends
            stock = yf.Ticker(ticker.upper())
            hist = stock.history(period=period)
            if hist.empty:
                return []
            prices = hist["Close"].dropna().tolist()
            return prices[-days:] if len(prices) >= days else prices
        except Exception as e:
            logger.error(f"get_historical_prices error for {ticker}: {e}")
            return []

    def get_historical_prices_with_dates(self, ticker: str, days: int = 252) -> list[dict]:
        """Returns list of {date: str, close: float} ordered oldest → newest."""
        try:
            import yfinance as yf
            period = f"{max(days + 60, 300)}d"
            stock = yf.Ticker(ticker.upper())
            hist = stock.history(period=period)
            if hist.empty:
                return []
            hist = hist["Close"].dropna()
            rows = [{"date": d.strftime("%Y-%m-%d"), "close": float(p)}
                    for d, p in zip(hist.index, hist.values)]
            return rows[-days:] if len(rows) >= days else rows
        except Exception as e:
            logger.error(f"get_historical_prices_with_dates error for {ticker}: {e}")
            return []

    def get_options_chain(self, ticker: str) -> dict:
        """
        Fetch full options chain for all available expirations.
        Returns a dict with:
          - current_price: float
          - expirations: list[str]
          - calls: list[dict]  (each dict has: strike, expiry, bid, ask, last, volume, oi, iv)
          - puts: list[dict]
        """
        try:
            import yfinance as yf
            stock = yf.Ticker(ticker.upper())
            expirations = stock.options

            if not expirations:
                return {
                    "current_price": self.get_current_price(ticker) or 0.0,
                    "expirations": [],
                    "calls": [],
                    "puts": [],
                }

            current_price = self.get_current_price(ticker) or 0.0
            all_calls = []
            all_puts = []

            for expiry in expirations[:8]:  # limit to next 8 expirations for speed
                try:
                    chain = stock.option_chain(expiry)
                    calls_df = chain.calls
                    puts_df = chain.puts

                    for _, row in calls_df.iterrows():
                        all_calls.append(self._parse_option_row(row, expiry, "call"))

                    for _, row in puts_df.iterrows():
                        all_puts.append(self._parse_option_row(row, expiry, "put"))

                except Exception as e:
                    logger.warning(f"Error fetching chain for {ticker} {expiry}: {e}")
                    continue

            return {
                "current_price": current_price,
                "expirations": list(expirations),
                "calls": all_calls,
                "puts": all_puts,
            }

        except Exception as e:
            logger.error(f"get_options_chain error for {ticker}: {e}")
            return {
                "current_price": 0.0,
                "expirations": [],
                "calls": [],
                "puts": [],
            }

    def _parse_option_row(self, row: pd.Series, expiry: str, option_type: str) -> dict:
        """Parse a yfinance option row into a clean dict."""
        return {
            "strike": float(row.get("strike", 0)),
            "expiry": expiry,
            "option_type": option_type,
            "bid": float(row.get("bid", 0) or 0),
            "ask": float(row.get("ask", 0) or 0),
            "last": float(row.get("lastPrice", 0) or 0),
            "volume": int(row.get("volume", 0) or 0),
            "open_interest": int(row.get("openInterest", 0) or 0),
            "iv": float(row.get("impliedVolatility", 0) or 0) if row.get("impliedVolatility") else None,
        }

    def get_option_mid_price(
        self,
        ticker: str,
        expiry: str,
        strike: float,
        option_type: str,
    ) -> Optional[float]:
        """
        Fetch current mid-price for a specific option contract via yfinance.
        Returns None if unavailable or spread is too wide.
        """
        try:
            import yfinance as yf
            stock = yf.Ticker(ticker.upper())
            chain = stock.option_chain(expiry)
            opts = chain.calls if option_type == "call" else chain.puts
            # Match by strike (allow small float diff)
            matching = opts[abs(opts["strike"] - strike) < 0.05]
            if matching.empty:
                return None
            row = matching.iloc[0]
            bid = float(row.get("bid", 0) or 0)
            ask = float(row.get("ask", 0) or 0)
            if bid > 0 and ask > 0:
                return round((bid + ask) / 2, 4)
            last = float(row.get("lastPrice", 0) or 0)
            return round(last, 4) if last > 0 else None
        except Exception as e:
            logger.error(f"get_option_mid_price error {ticker} {expiry} {strike} {option_type}: {e}")
            return None

    def get_stock_info(self, ticker: str) -> dict:
        """Get basic stock information."""
        try:
            import yfinance as yf
            stock = yf.Ticker(ticker.upper())
            info = stock.info
            current_price = self.get_current_price(ticker)

            return {
                "ticker": ticker.upper(),
                "name": info.get("longName", ticker),
                "current_price": current_price,
                "market_cap": info.get("marketCap"),
                "sector": info.get("sector"),
                "beta": info.get("beta"),
                "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
                "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            }
        except Exception as e:
            logger.error(f"get_stock_info error for {ticker}: {e}")
            return {
                "ticker": ticker.upper(),
                "name": ticker,
                "current_price": self.get_current_price(ticker),
            }


fetcher = DataFetcher()
