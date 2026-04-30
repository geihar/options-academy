"""
Finviz screener for options scanner universe discovery.
Fetches liquid, optionable stocks by category without an API key.
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

# Finviz v=111 overview column indices
COL_TICKER  = 1
COL_COMPANY = 2
COL_SECTOR  = 3
COL_PRICE   = 8
COL_CHANGE  = 9
COL_VOLUME  = 10

CATEGORIES: dict[str, dict] = {
    "top_volume": {
        "label": "Топ по объёму",
        "description": "Наиболее торгуемые акции с ликвидными опционами",
        "url": (
            "https://finviz.com/screener.ashx"
            "?v=111&f=sh_avgvol_o500,sh_price_o5,optionable&o=-volume&r={page}"
        ),
    },
    "sp500": {
        "label": "S&P 500 активные",
        "description": "Компоненты S&P 500 с высоким объёмом торгов",
        "url": (
            "https://finviz.com/screener.ashx"
            "?v=111&f=idx_sp500,sh_avgvol_o500,sh_price_o10&o=-volume&r={page}"
        ),
    },
    "high_volatility": {
        "label": "Высокая волатильность",
        "description": "Акции с высокой месячной волатильностью — кандидаты для продажи премии",
        "url": (
            "https://finviz.com/screener.ashx"
            "?v=111&f=ta_volatility_mo,sh_avgvol_o300,sh_price_o5,optionable&o=-volume&r={page}"
        ),
    },
    "earnings_week": {
        "label": "Отчётность на этой неделе",
        "description": "Отчёт на этой неделе — рост IV перед публикацией, IV-crush после",
        "url": (
            "https://finviz.com/screener.ashx"
            "?v=111&f=earningsdate_thisweek,sh_avgvol_o300,sh_price_o5,optionable&r={page}"
        ),
    },
    "earnings_next_week": {
        "label": "Отчётность на следующей неделе",
        "description": "Отчёт на следующей неделе — игра на IV-crush после выхода",
        "url": (
            "https://finviz.com/screener.ashx"
            "?v=111&f=earningsdate_nextweek,sh_avgvol_o300,sh_price_o5,optionable&r={page}"
        ),
    },
}

FALLBACK_UNIVERSE: dict[str, list[str]] = {
    "top_volume": [
        "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META", "GOOGL", "AMD",
        "PLTR", "COIN", "SPY", "QQQ", "IWM", "SOFI", "RIVN", "MSTR", "HOOD", "RBLX", "SMCI", "NIO",
    ],
    "sp500": [
        "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "TSLA", "JPM", "V", "UNH",
        "JNJ", "XOM", "HD", "PG", "CVX", "MRK", "ABBV", "COST", "BAC", "WMT",
    ],
    "high_volatility": [
        "TSLA", "NVDA", "AMD", "COIN", "MSTR", "PLTR", "RBLX", "LCID", "RIVN", "SMCI",
        "SOFI", "HOOD", "UPST", "AFRM", "SQ", "SNAP", "LYFT", "BYND", "GME", "AMC",
    ],
    "earnings_week": [
        "AAPL", "MSFT", "AMZN", "GOOGL", "META", "NVDA", "TSLA", "AMD", "INTC", "NFLX",
    ],
    "earnings_next_week": [
        "JPM", "BAC", "GS", "MS", "C", "WFC", "JNJ", "PFE", "UNH", "CVX",
    ],
}


def _parse_float(s: str) -> Optional[float]:
    try:
        s = s.strip().replace(',', '').replace('%', '')
        if s.endswith('B'):
            return float(s[:-1]) * 1e9
        if s.endswith('M'):
            return float(s[:-1]) * 1e6
        if s.endswith('K'):
            return float(s[:-1]) * 1e3
        return float(s)
    except Exception:
        return None


def fetch_scanner_universe(
    category: str = "top_volume",
    pages: int = 2,
    max_results: int = 40,
) -> list[dict]:
    """
    Fetch optionable tickers from Finviz screener by category.
    Returns list of dicts: {ticker, company, sector, price, change_pct, volume}.
    """
    cat = CATEGORIES.get(category)
    if cat is None:
        return []

    results: list[dict] = []
    seen: set[str] = set()

    for page_num in range(pages):
        row_start = page_num * 20 + 1
        url = cat["url"].format(page=row_start)

        try:
            resp = requests.get(url, headers=HEADERS, timeout=12)
            resp.raise_for_status()
        except Exception as e:
            logger.warning(f"Finviz fetch error (category={category}, page={row_start}): {e}")
            break

        soup = BeautifulSoup(resp.text, "html.parser")
        table = soup.find("table", id="screener-table")
        if table is None:
            table = soup.find("table", {"class": re.compile(r"screener_table|table-light")})

        if table is None:
            logger.warning(f"Finviz: screener table not found (category={category})")
            break

        rows = table.find_all("tr")
        found_in_page = 0
        for row in rows:
            cells = row.find_all("td")
            if len(cells) <= COL_VOLUME:
                continue

            ticker_link = cells[COL_TICKER].find("a") if len(cells) > COL_TICKER else None
            if not ticker_link:
                continue

            ticker = ticker_link.get_text(strip=True).upper()
            if not ticker or not re.match(r'^[A-Z]{1,6}$', ticker):
                continue
            if ticker in seen:
                continue
            seen.add(ticker)

            company = cells[COL_COMPANY].get_text(strip=True) if len(cells) > COL_COMPANY else ticker
            sector_raw = cells[COL_SECTOR].get_text(strip=True) if len(cells) > COL_SECTOR else None
            sector = sector_raw if sector_raw and sector_raw not in ("-", "") else None
            price = _parse_float(cells[COL_PRICE].get_text(strip=True)) if len(cells) > COL_PRICE else None
            change_pct = _parse_float(cells[COL_CHANGE].get_text(strip=True)) if len(cells) > COL_CHANGE else None
            volume = _parse_float(cells[COL_VOLUME].get_text(strip=True)) if len(cells) > COL_VOLUME else None

            results.append({
                "ticker": ticker,
                "company": company,
                "sector": sector,
                "price": price,
                "change_pct": change_pct,
                "volume": volume,
            })
            found_in_page += 1

        if len(results) >= max_results or found_in_page == 0:
            break

    return results[:max_results]
