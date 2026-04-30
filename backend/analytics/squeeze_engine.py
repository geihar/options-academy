"""
Short Squeeze Analytics Engine
Identifies short squeeze candidates and analyzes squeeze conditions.
"""

import math
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class SqueezeMetrics:
    ticker: str
    name: str
    current_price: float
    sector: Optional[str]

    # Short interest
    short_interest_pct: Optional[float]     # % of float sold short
    days_to_cover: Optional[float]          # avg days to cover at current volume
    shares_short: Optional[int]
    shares_short_prev: Optional[int]        # prior month
    si_change_pct: Optional[float]          # MoM % change in shares short
    float_shares: Optional[int]
    shares_outstanding: Optional[int]

    # Price momentum
    change_1d: Optional[float]      # % 1-day change
    change_5d: Optional[float]      # % 5-day change
    change_20d: Optional[float]     # % 20-day change
    change_52w_low_pct: Optional[float]   # % above 52w low (squeeze fuel)
    change_52w_high_pct: Optional[float]  # % below 52w high (upside room)
    week_52_high: Optional[float]
    week_52_low: Optional[float]

    # Volume
    volume_today: Optional[int]
    avg_volume_20d: Optional[float]
    volume_ratio: Optional[float]   # today / 20d avg

    # Volatility / options
    iv_rank: Optional[float]
    hv_20: Optional[float]

    # Fundamentals
    market_cap: Optional[float]
    beta: Optional[float]

    # Output
    squeeze_score: float
    squeeze_potential: str      # "Взрывной" / "Высокий" / "Средний" / "Низкий"
    squeeze_phase: str          # "Накопление" / "Триггер" / "Ускорение" / "Истощение" / "Нейтральный"
    key_factors: list = field(default_factory=list)   # why this scores high
    risk_factors: list = field(default_factory=list)  # what could prevent/reverse
    price_history: list = field(default_factory=list) # [{date, close, volume}] last 60d


def _float_label(float_shares: Optional[int]) -> str:
    if float_shares is None:
        return "неизвестен"
    m = float_shares / 1_000_000
    if m < 5:
        return f"{m:.1f}M — микрофлоат"
    if m < 20:
        return f"{m:.1f}M — малый флоат"
    if m < 100:
        return f"{m:.0f}M — средний флоат"
    return f"{m:.0f}M"


def _compute_score_and_factors(m: SqueezeMetrics) -> tuple[float, str, str, list, list]:
    """Compute squeeze_score, potential, phase, key_factors, risk_factors."""
    score = 0.0
    key = []
    risk = []

    # ── Short Interest ─────────────────────────────────────────────────────────
    si = m.short_interest_pct or 0.0
    if si >= 40:
        score += 40
        key.append(f"Короткие позиции {si:.1f}% флоата — экстремальный шортинтерес")
    elif si >= 30:
        score += 33
        key.append(f"Короткие позиции {si:.1f}% флоата — очень высокий шортинтерес")
    elif si >= 20:
        score += 25
        key.append(f"Короткие позиции {si:.1f}% флоата — высокий шортинтерес")
    elif si >= 10:
        score += 12
        key.append(f"Короткие позиции {si:.1f}% флоата — умеренный шортинтерес")
    else:
        risk.append(f"Короткие позиции {si:.1f}% — низкий шортинтерес, слабый топливо для сквиза")

    # ── Days to Cover ──────────────────────────────────────────────────────────
    dtc = m.days_to_cover or 0.0
    if dtc >= 10:
        score += 20
        key.append(f"Days-to-cover {dtc:.1f} дней — медведи в ловушке очень долго")
    elif dtc >= 5:
        score += 15
        key.append(f"Days-to-cover {dtc:.1f} дней — закрытие займёт много дней")
    elif dtc >= 2.5:
        score += 8
        key.append(f"Days-to-cover {dtc:.1f} дней")
    elif dtc > 0:
        risk.append(f"Days-to-cover {dtc:.1f} — короткие позиции можно быстро закрыть")

    # ── SI Change MoM ──────────────────────────────────────────────────────────
    if m.si_change_pct is not None:
        if m.si_change_pct >= 20:
            score += 10
            key.append(f"Короткие позиции выросли на {m.si_change_pct:.0f}% за месяц — давление нарастает")
        elif m.si_change_pct >= 10:
            score += 6
            key.append(f"Короткие позиции выросли на {m.si_change_pct:.0f}% за месяц")
        elif m.si_change_pct <= -20:
            risk.append(f"Короткие позиции упали на {abs(m.si_change_pct):.0f}% — часть шортистов уже вышла")

    # ── Float Size ────────────────────────────────────────────────────────────
    if m.float_shares is not None:
        fl = m.float_shares / 1_000_000
        if fl < 5:
            score += 20
            key.append(f"Микрофлоат {fl:.1f}M акций — минимальное предложение = взрывной потенциал")
        elif fl < 10:
            score += 15
            key.append(f"Малый флоат {fl:.1f}M акций — ограниченное предложение усиливает движение")
        elif fl < 20:
            score += 10
            key.append(f"Малый флоат {fl:.1f}M акций")
        elif fl < 50:
            score += 5

    # ── Volume Spike ──────────────────────────────────────────────────────────
    vr = m.volume_ratio or 0.0
    if vr >= 10:
        score += 15
        key.append(f"Объём {vr:.0f}× от среднего — экстремальная активность")
    elif vr >= 5:
        score += 12
        key.append(f"Объём {vr:.0f}× от среднего — сильная активность")
    elif vr >= 2:
        score += 7
        key.append(f"Объём {vr:.1f}× от среднего — повышенная активность")
    elif vr >= 1.5:
        score += 3

    # ── Price Momentum ────────────────────────────────────────────────────────
    m5 = m.change_5d or 0.0
    m20 = m.change_20d or 0.0
    if 5 <= m5 <= 30:
        score += 8
        key.append(f"Цена +{m5:.1f}% за 5 дней — начало движения")
    elif m5 > 30:
        score += 4  # less — might already be exhausted
        key.append(f"Цена +{m5:.1f}% за 5 дней — сильное движение (следи за истощением)")
        risk.append("Очень быстрый рост за 5 дней — возможно уже в стадии истощения")
    elif m5 < -10:
        risk.append(f"Цена падает ({m5:.1f}% за 5 дней) — сквиз пока не запустился")

    # ── Distance from 52w low (squeeze from lows is most explosive) ────────────
    if m.change_52w_low_pct is not None and m.change_52w_low_pct < 30:
        score += 5
        key.append(f"Цена на {m.change_52w_low_pct:.0f}% выше 52-нед. минимума — есть пространство для роста")

    # ── IV Rank ───────────────────────────────────────────────────────────────
    if m.iv_rank and m.iv_rank >= 60:
        score += 6
        key.append(f"IV Rank {m.iv_rank:.0f} — рынок опционов предчувствует движение")
    elif m.iv_rank and m.iv_rank >= 40:
        score += 3

    # ── Risk factors ──────────────────────────────────────────────────────────
    if m.market_cap and m.market_cap > 50_000_000_000:
        risk.append("Крупная компания (market cap > $50B) — сложнее сдвинуть ценой")
    if m.beta and m.beta < 0.5:
        risk.append(f"Низкая бета ({m.beta:.1f}) — акция мало реагирует на рынок")

    score = max(0.0, min(100.0, score))

    # Potential label
    if score >= 70:
        potential = "Взрывной"
    elif score >= 50:
        potential = "Высокий"
    elif score >= 30:
        potential = "Средний"
    else:
        potential = "Низкий"

    # Phase detection
    m5d = m.change_5d or 0.0
    vr_ = m.volume_ratio or 1.0
    si_ = m.short_interest_pct or 0.0

    if m5d > 30 and vr_ > 5:
        phase = "Ускорение"
    elif m5d > 50:
        phase = "Истощение"
    elif m5d > 5 and vr_ > 2:
        phase = "Триггер"
    elif si_ >= 15 and m5d < 5:
        phase = "Накопление"
    else:
        phase = "Нейтральный"

    return score, potential, phase, key, risk


def get_squeeze_metrics(
    ticker: str,
    fetcher,
    iv_stats: dict,
) -> Optional[SqueezeMetrics]:
    """Fetch and compute full squeeze metrics for a single ticker."""
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker.upper())

        info = {}
        try:
            info = stock.info or {}
        except Exception as e:
            logger.warning(f"yf info error for {ticker}: {e}")

        # History: last 60 trading days (OHLCV)
        hist_df = None
        try:
            hist_df = stock.history(period="90d")
        except Exception as e:
            logger.warning(f"yf history error for {ticker}: {e}")

        # ── Current price ─────────────────────────────────────────────────────
        current_price = None
        if hist_df is not None and not hist_df.empty:
            current_price = float(hist_df["Close"].iloc[-1])
        if not current_price:
            current_price = fetcher.get_current_price(ticker) or 0.0

        if not current_price:
            return None

        # ── Short interest ────────────────────────────────────────────────────
        si_pct = info.get("shortPercentOfFloat")
        if si_pct is not None:
            si_pct = float(si_pct) * 100 if si_pct < 1 else float(si_pct)

        days_to_cover = info.get("shortRatio")
        if days_to_cover is not None:
            days_to_cover = float(days_to_cover)

        shares_short = info.get("sharesShort")
        shares_short_prev = info.get("sharesShortPriorMonth")
        float_shares = info.get("floatShares")
        shares_outstanding = info.get("sharesOutstanding")

        si_change_pct = None
        if shares_short and shares_short_prev and shares_short_prev > 0:
            si_change_pct = (shares_short - shares_short_prev) / shares_short_prev * 100

        # ── Price momentum ────────────────────────────────────────────────────
        change_1d = change_5d = change_20d = None
        volume_today = avg_volume_20d = volume_ratio = None
        price_history = []

        if hist_df is not None and not hist_df.empty:
            closes = hist_df["Close"].dropna()
            volumes = hist_df["Volume"].dropna()

            if len(closes) >= 2:
                change_1d = (closes.iloc[-1] / closes.iloc[-2] - 1) * 100
            if len(closes) >= 6:
                change_5d = (closes.iloc[-1] / closes.iloc[-6] - 1) * 100
            if len(closes) >= 21:
                change_20d = (closes.iloc[-1] / closes.iloc[-21] - 1) * 100

            if not volumes.empty:
                volume_today = int(volumes.iloc[-1])
                if len(volumes) >= 20:
                    avg_volume_20d = float(volumes.iloc[-20:].mean())
                    if avg_volume_20d > 0:
                        volume_ratio = volume_today / avg_volume_20d

            # Build price history for chart (last 60d)
            for dt, row in hist_df.tail(60).iterrows():
                price_history.append({
                    "date": dt.strftime("%Y-%m-%d"),
                    "close": round(float(row["Close"]), 2),
                    "volume": int(row["Volume"]),
                })

        # ── 52-week stats ─────────────────────────────────────────────────────
        w52_high = info.get("fiftyTwoWeekHigh")
        w52_low = info.get("fiftyTwoWeekLow")

        change_52w_low_pct = None
        change_52w_high_pct = None
        if w52_low and w52_low > 0:
            change_52w_low_pct = (current_price - w52_low) / w52_low * 100
        if w52_high and w52_high > 0:
            change_52w_high_pct = (current_price - w52_high) / w52_high * 100

        # ── IV / HV ───────────────────────────────────────────────────────────
        iv_rank = iv_stats.get("iv_rank")
        hv_20 = iv_stats.get("hv_30")  # use hv_30 as proxy

        # ── Fundamentals ──────────────────────────────────────────────────────
        market_cap = info.get("marketCap")
        beta = info.get("beta")
        name = info.get("shortName") or info.get("longName") or ticker
        sector = info.get("sector")

        m = SqueezeMetrics(
            ticker=ticker.upper(),
            name=name,
            current_price=current_price,
            sector=sector,
            short_interest_pct=round(si_pct, 1) if si_pct is not None else None,
            days_to_cover=round(days_to_cover, 1) if days_to_cover is not None else None,
            shares_short=int(shares_short) if shares_short else None,
            shares_short_prev=int(shares_short_prev) if shares_short_prev else None,
            si_change_pct=round(si_change_pct, 1) if si_change_pct is not None else None,
            float_shares=int(float_shares) if float_shares else None,
            shares_outstanding=int(shares_outstanding) if shares_outstanding else None,
            change_1d=round(change_1d, 2) if change_1d is not None else None,
            change_5d=round(change_5d, 2) if change_5d is not None else None,
            change_20d=round(change_20d, 2) if change_20d is not None else None,
            change_52w_low_pct=round(change_52w_low_pct, 1) if change_52w_low_pct is not None else None,
            change_52w_high_pct=round(change_52w_high_pct, 1) if change_52w_high_pct is not None else None,
            week_52_high=round(w52_high, 2) if w52_high else None,
            week_52_low=round(w52_low, 2) if w52_low else None,
            volume_today=volume_today,
            avg_volume_20d=round(avg_volume_20d, 0) if avg_volume_20d else None,
            volume_ratio=round(volume_ratio, 2) if volume_ratio else None,
            iv_rank=round(iv_rank, 1) if iv_rank is not None else None,
            hv_20=round(hv_20, 4) if hv_20 else None,
            market_cap=market_cap,
            beta=round(beta, 2) if beta else None,
            squeeze_score=0.0,
            squeeze_potential="",
            squeeze_phase="",
            price_history=price_history,
        )

        score, potential, phase, key, risk = _compute_score_and_factors(m)
        m.squeeze_score = round(score, 1)
        m.squeeze_potential = potential
        m.squeeze_phase = phase
        m.key_factors = key
        m.risk_factors = risk

        return m

    except Exception as e:
        logger.error(f"get_squeeze_metrics error for {ticker}: {e}", exc_info=True)
        return None
