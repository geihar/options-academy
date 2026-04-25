from datetime import date, datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def get_next_earnings_date(ticker: str) -> Optional[date]:
    """
    Fetch upcoming earnings date for a ticker using yfinance.
    Returns None if unavailable or parsing fails.
    """
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        cal = stock.calendar

        if cal is None:
            return None

        # calendar can be a DataFrame or dict depending on yfinance version
        if hasattr(cal, 'columns'):
            # DataFrame format (older yfinance)
            if 'Earnings Date' in cal.columns:
                val = cal['Earnings Date'].iloc[0]
                if val is not None:
                    if isinstance(val, (datetime, date)):
                        return val.date() if isinstance(val, datetime) else val
                    return None
        elif isinstance(cal, dict):
            # Dict format (newer yfinance)
            earnings_date = cal.get('Earnings Date')
            if earnings_date is not None:
                if isinstance(earnings_date, list) and len(earnings_date) > 0:
                    ed = earnings_date[0]
                elif not isinstance(earnings_date, list):
                    ed = earnings_date
                else:
                    return None

                if isinstance(ed, (datetime, date)):
                    return ed.date() if isinstance(ed, datetime) else ed
                try:
                    return datetime.strptime(str(ed)[:10], "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    return None

    except Exception as e:
        logger.warning(f"Could not fetch earnings date for {ticker}: {e}")

    return None


def days_to_earnings(ticker: str, as_of: Optional[date] = None) -> Optional[int]:
    """
    Returns days until next earnings, or None if unknown.
    Negative means earnings just passed.
    """
    earnings_date = get_next_earnings_date(ticker)
    if earnings_date is None:
        return None

    ref_date = as_of or date.today()
    delta = (earnings_date - ref_date).days
    return delta
