"""
Finviz screener parser.
Fetches stocks with high short interest from the free Finviz screener.
No API key required.
"""

import logging
import re
from typing import Optional
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Finviz screener URL for high-short-interest stocks
# Filters: Short Float > 10%, Avg Volume > 300K, Price > $1
# Sorted by Short Float descending
# v=111 = Overview table
SCREENER_URL = (
    "https://finviz.com/screener.ashx"
    "?v=111"
    "&f=sh_short_o10,sh_avgvol_o300,sh_price_o1"
    "&o=-short"
    "&r={page}"         # r=1, r=21, r=41 ... (20 per page)
)

# Column indices in the overview table (v=111)
# 0=No, 1=Ticker, 2=Company, 3=Sector, 4=Industry, 5=Country,
# 6=Market Cap, 7=P/E, 8=Price, 9=Change, 10=Volume
COL_TICKER   = 1
COL_COMPANY  = 2
COL_SECTOR   = 3
COL_COUNTRY  = 5
COL_PRICE    = 8
COL_CHANGE   = 9
COL_VOLUME   = 10

# Short % is NOT in v=111 overview. We get it from v=152 (Short Selling view)
# v=152 columns: 0=No, 1=Ticker, 2=Company, ..., Short Float, Short Ratio, etc.
# Alternatively parse from the tooltip or use a dedicated URL.
# Easiest: use v=152 (Short Selling columns):
# columns: Ticker, Short Float, Short Ratio, Short Int (shares)
SHORT_URL = (
    "https://finviz.com/screener.ashx"
    "?v=152"
    "&f=sh_short_o10,sh_avgvol_o300,sh_price_o1"
    "&o=-short"
    "&r={page}"
)
# v=152 column map (Short Selling view)
SHORT_COL_TICKER       = 1
SHORT_COL_COMPANY      = 2
SHORT_COL_SHORT_FLOAT  = 3   # "Short Float" e.g. "24.50%"
SHORT_COL_SHORT_RATIO  = 4   # "Short Ratio" e.g. "3.50"
SHORT_COL_SHORT_INT    = 5   # "Short Int" e.g. "12.34M" (shares)


def _parse_float_pct(s: str) -> Optional[float]:
    """Parse '24.50%' → 24.5, or None."""
    try:
        return float(s.replace('%', '').replace(',', '').strip())
    except Exception:
        return None


def _parse_float(s: str) -> Optional[float]:
    """Parse '3.50' or '12.34M' → float, or None."""
    try:
        s = s.strip().replace(',', '')
        if s.endswith('B'):
            return float(s[:-1]) * 1e9
        if s.endswith('M'):
            return float(s[:-1]) * 1e6
        if s.endswith('K'):
            return float(s[:-1]) * 1e3
        return float(s)
    except Exception:
        return None


def fetch_high_short_interest_tickers(
    pages: int = 2,
    min_short_float: float = 10.0,
    max_results: int = 60,
) -> list[dict]:
    """
    Fetch tickers with high short interest from Finviz screener.
    Returns list of dicts: {ticker, company, short_float_pct, short_ratio}.
    Sorted by short_float_pct descending.
    """
    results = []
    seen = set()

    for page_num in range(pages):
        row_start = page_num * 20 + 1  # Finviz paginates by 20
        url = SHORT_URL.format(page=row_start)

        try:
            resp = requests.get(url, headers=HEADERS, timeout=12)
            resp.raise_for_status()
        except Exception as e:
            logger.warning(f"Finviz fetch error (page {row_start}): {e}")
            break

        soup = BeautifulSoup(resp.text, "html.parser")

        # Find the screener results table
        table = soup.find("table", id="screener-table")
        if table is None:
            # Try alternative: table with class 'table-light'
            table = soup.find("table", {"class": re.compile(r"screener_table|table-light")})

        if table is None:
            logger.warning(f"Finviz: could not find screener table on page {row_start}")
            break

        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) <= SHORT_COL_SHORT_FLOAT:
                continue

            ticker_cell = cells[SHORT_COL_TICKER]
            ticker_link = ticker_cell.find("a")
            if not ticker_link:
                continue

            ticker = ticker_link.get_text(strip=True).upper()
            if not ticker or not re.match(r'^[A-Z]{1,6}$', ticker):
                continue
            if ticker in seen:
                continue
            seen.add(ticker)

            company = cells[SHORT_COL_COMPANY].get_text(strip=True) if len(cells) > SHORT_COL_COMPANY else ticker
            short_float = _parse_float_pct(cells[SHORT_COL_SHORT_FLOAT].get_text(strip=True))
            short_ratio = _parse_float(cells[SHORT_COL_SHORT_RATIO].get_text(strip=True)) if len(cells) > SHORT_COL_SHORT_RATIO else None

            if short_float is None or short_float < min_short_float:
                continue

            results.append({
                "ticker": ticker,
                "company": company,
                "short_float_pct": short_float,
                "short_ratio": short_ratio,
            })

        if len(results) >= max_results:
            break

    results.sort(key=lambda x: x.get("short_float_pct") or 0, reverse=True)
    return results[:max_results]


# ── Fallback curated list (when Finviz is unavailable) ────────────────────────

FALLBACK_UNIVERSE = [
    "GME", "AMC", "BBBY", "SPCE", "CLOV", "WKHS", "MVIS",
    "BYND", "W", "UPST", "PTON", "RIVN", "LCID", "CVNA",
    "COIN", "MSTR", "PLTR", "RBLX", "AFRM", "HOOD",
    "SQ", "SNAP", "LYFT", "UBER", "DASH", "ABNB",
    "SMCI", "NKLA", "RIDE", "GOEV", "HYLN", "XPEV", "NIO",
    "PLUG", "FCEL", "BE", "RUN", "NOVA", "ENPH",
    "CAR", "HTZ", "SPWR", "FLNC", "CHWY",
]
