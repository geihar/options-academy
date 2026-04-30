"""
Strategy profiles for all 10 core options strategies.
Each profile includes: educational content, risk characteristics, Greek directions,
legs template (for payoff diagrams), and wizard matching criteria.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class StrategyProfile:
    id: str
    name: str
    name_ru: str
    icon: str

    # Wizard matching
    outlook_tags: tuple[str, ...]     # "bullish" | "mildly_bullish" | "neutral" | "mildly_bearish" | "bearish" | "volatile"
    risk_type: str                    # "defined" | "open"
    iv_pref: str                      # "low" | "high" | "any"
    is_advanced: bool                 # True → show ⚠️ ADVANCED gate

    # Risk profile labels (formulas as readable strings)
    max_profit_label: str
    max_loss_label: str
    breakeven_label: str

    # Education
    when_to_use: str
    common_mistakes: tuple[str, ...]

    # Greeks direction (qualitative, shown as +/- tags)
    delta_dir: str    # "positive" | "negative" | "near_zero"
    gamma_dir: str    # "positive" | "negative"
    theta_dir: str    # "positive" | "negative"
    vega_dir: str     # "positive" | "negative"

    # Payoff legs: each leg = (type, direction, strike_offset_pct, premium_pct_atm)
    # strike_offset_pct: relative to ATM (0 = ATM, 5 = 5% OTM, -5 = 5% ITM)
    # premium_pct_atm: premium as % of stock price (rough estimate for diagram)
    legs: tuple[dict, ...]

    # Optional advanced warning text
    warning: str = ""


STRATEGIES: list[StrategyProfile] = [
    StrategyProfile(
        id="long_call",
        name="Long Call",
        name_ru="Длинный колл",
        icon="📈",
        outlook_tags=("bullish", "mildly_bullish"),
        risk_type="defined",
        iv_pref="low",
        is_advanced=False,
        max_profit_label="Неограниченный (акция может расти бесконечно)",
        max_loss_label="Уплаченная премия — известна в момент входа",
        breakeven_label="Страйк + премия",
        when_to_use=(
            "Есть сильный бычий взгляд, IV низкий (опционы дешёвые). "
            "Лучшее соотношение цены и потенциала при ожидании значительного роста. "
            "Риск строго ограничен уплаченной премией — нельзя потерять больше."
        ),
        common_mistakes=(
            "Покупка слишком краткосрочных опционов: тета быстро уничтожает стоимость при медленном движении",
            "Покупка далёкого OTM (дельта 0.10–0.15) как 'лотерейный билет': >80% таких опционов истекают в ноль",
            "Покупка в высоком IV: переплачиваешь за временную стоимость, которая быстро сдувается",
        ),
        delta_dir="positive",
        gamma_dir="positive",
        theta_dir="negative",
        vega_dir="positive",
        legs=(
            {"type": "call", "direction": "long", "offset_pct": 3, "premium_pct": 2.5},
        ),
    ),

    StrategyProfile(
        id="long_put",
        name="Long Put",
        name_ru="Длинный пут",
        icon="📉",
        outlook_tags=("bearish", "mildly_bearish"),
        risk_type="defined",
        iv_pref="low",
        is_advanced=False,
        max_profit_label="Страйк − премия (акция может упасть до нуля)",
        max_loss_label="Уплаченная премия",
        breakeven_label="Страйк − премия",
        when_to_use=(
            "Ожидаешь падение акции или хочешь застраховать длинную позицию. "
            "Низкий IV делает страховку дешевле. "
            "Прибыль растёт нелинейно при сильном падении."
        ),
        common_mistakes=(
            "Покупка пута когда IV уже высокий: страховка стоит дорого именно тогда, когда риск уже реализован",
            "Выбор слишком далёкого OTM страйка: дешевле, но даёт реальную защиту только при обвале",
            "Игнорирование теты: пут нужно движение вниз, флэт убивает позицию",
        ),
        delta_dir="negative",
        gamma_dir="positive",
        theta_dir="negative",
        vega_dir="positive",
        legs=(
            {"type": "put", "direction": "long", "offset_pct": -3, "premium_pct": 2.5},
        ),
    ),

    StrategyProfile(
        id="covered_call",
        name="Covered Call",
        name_ru="Покрытый колл",
        icon="🛡️",
        outlook_tags=("neutral", "mildly_bullish"),
        risk_type="defined",
        iv_pref="high",
        is_advanced=False,
        max_profit_label="Премия + (страйк − цена акции) если исполнится",
        max_loss_label="Цена акции − премия (акция может упасть до нуля)",
        breakeven_label="Цена покупки акции − премия",
        when_to_use=(
            "Уже владеешь акцией и готов продать её по страйку. "
            "Высокий IV = больше премии за ту же вероятность исполнения. "
            "Генерирует регулярный доход в боковом или умеренно растущем рынке."
        ),
        common_mistakes=(
            "Продажа колла перед отчётностью: IV-crush поможет по опциону, но гэп-риск по акции реален",
            "Выбор страйка который не хочешь 'отдавать': создаёт психологический конфликт при исполнении",
            "Слишком близкий страйк ради большой премии: ограничивает апсайд акции",
        ),
        delta_dir="positive",
        gamma_dir="negative",
        theta_dir="positive",
        vega_dir="negative",
        legs=(
            {"type": "call", "direction": "short", "offset_pct": 7, "premium_pct": 1.5},
        ),
    ),

    StrategyProfile(
        id="cash_secured_put",
        name="Cash-Secured Put",
        name_ru="Пут с обеспечением",
        icon="🏦",
        outlook_tags=("neutral", "mildly_bullish"),
        risk_type="defined",
        iv_pref="high",
        is_advanced=False,
        max_profit_label="Полученная премия",
        max_loss_label="Страйк − премия (акция падает до нуля)",
        breakeven_label="Страйк − премия",
        when_to_use=(
            "Хочешь купить акцию по более низкой цене и готов ждать. "
            "Собираешь премию пока ждёшь когда акция 'придёт к тебе'. "
            "Высокий IV = больше премии за тот же страйк."
        ),
        common_mistakes=(
            "Продажа пута на акцию которую не хочешь держать: исполнение — реальный исход, будь готов",
            "Отсутствие кэша под полное обеспечение: при исполнении создаёт маржин-колл",
            "Продажа при низком IV: собираешь мало, а риск тот же",
        ),
        delta_dir="positive",
        gamma_dir="negative",
        theta_dir="positive",
        vega_dir="negative",
        legs=(
            {"type": "put", "direction": "short", "offset_pct": -7, "premium_pct": 1.5},
        ),
    ),

    StrategyProfile(
        id="bull_call_spread",
        name="Bull Call Spread",
        name_ru="Бычий колл-спрэд",
        icon="↗️",
        outlook_tags=("bullish", "mildly_bullish"),
        risk_type="defined",
        iv_pref="any",
        is_advanced=False,
        max_profit_label="(Верхний страйк − нижний страйк) − дебет",
        max_loss_label="Чистый дебет (разница премий)",
        breakeven_label="Нижний страйк + дебет",
        when_to_use=(
            "Бычий взгляд, но хочешь уменьшить стоимость входа по сравнению с чистым Long Call. "
            "Продажа верхнего колла снижает стоимость и одновременно ограничивает максимальную прибыль. "
            "Работает в любом IV окружении — короткая нога снижает стоимость в высоком IV."
        ),
        common_mistakes=(
            "Слишком широкие страйки: теряется преимущество спрэда в снижении стоимости",
            "Вход с DTE < 21 дня: недостаточно времени для реализации тезиса",
            "Ожидание максимальной прибыли: большинство побед — частичная прибыль, а не 100%",
        ),
        delta_dir="positive",
        gamma_dir="positive",
        theta_dir="negative",
        vega_dir="near_zero",
        legs=(
            {"type": "call", "direction": "long",  "offset_pct": 2,  "premium_pct": 3.0},
            {"type": "call", "direction": "short", "offset_pct": 8,  "premium_pct": 1.0},
        ),
    ),

    StrategyProfile(
        id="bear_put_spread",
        name="Bear Put Spread",
        name_ru="Медвежий пут-спрэд",
        icon="↘️",
        outlook_tags=("bearish", "mildly_bearish"),
        risk_type="defined",
        iv_pref="any",
        is_advanced=False,
        max_profit_label="(Верхний страйк − нижний страйк) − дебет",
        max_loss_label="Чистый дебет",
        breakeven_label="Верхний страйк − дебет",
        when_to_use=(
            "Медвежий взгляд с ограниченным риском и сниженной стоимостью входа. "
            "Дешевле чистого Long Put за счёт продажи нижнего пута. "
            "Хорошо работает при умеренном падении — не нужен обвал для прибыли."
        ),
        common_mistakes=(
            "Слишком узкий спрэд в волатильных акциях: потенциал прибыли слишком мал для нужного движения",
            "Продажа нижнего пута слишком близко: сужает диапазон прибыли",
        ),
        delta_dir="negative",
        gamma_dir="positive",
        theta_dir="negative",
        vega_dir="near_zero",
        legs=(
            {"type": "put", "direction": "long",  "offset_pct": -2, "premium_pct": 3.0},
            {"type": "put", "direction": "short", "offset_pct": -8, "premium_pct": 1.0},
        ),
    ),

    StrategyProfile(
        id="long_straddle",
        name="Long Straddle",
        name_ru="Длинный стрэддл",
        icon="⚡",
        outlook_tags=("volatile",),
        risk_type="defined",
        iv_pref="low",
        is_advanced=False,
        max_profit_label="Неограниченный (движение в любую сторону за пределы безубытка)",
        max_loss_label="Суммарная премия (обе ноги)",
        breakeven_label="Страйк ± суммарная премия",
        when_to_use=(
            "Ожидаешь сильное движение, но не знаешь в какую сторону — классика перед отчётностью. "
            "IV ДОЛЖЕН быть низким, иначе переплатишь и потеряешь на IV-crush после события. "
            "Прибыль растёт нелинейно при движении дальше от безубытков."
        ),
        common_mistakes=(
            "Покупка стрэддла при ВЫСОКОМ IV (например, накануне отчётности): "
            "IV-crush после события уничтожает позицию даже при движении акции",
            "Недооценка необходимого движения: нужно пройти выше страйк+премия ИЛИ ниже страйк-премия",
            "Удержание до экспирации: обычно лучше закрыть на большом движении в первые дни",
        ),
        delta_dir="near_zero",
        gamma_dir="positive",
        theta_dir="negative",
        vega_dir="positive",
        legs=(
            {"type": "call", "direction": "long", "offset_pct": 0, "premium_pct": 3.0},
            {"type": "put",  "direction": "long", "offset_pct": 0, "premium_pct": 3.0},
        ),
    ),

    StrategyProfile(
        id="short_straddle",
        name="Short Straddle",
        name_ru="Короткий стрэддл",
        icon="⚠️",
        outlook_tags=("neutral",),
        risk_type="open",
        iv_pref="high",
        is_advanced=True,
        max_profit_label="Суммарная полученная премия",
        max_loss_label="НЕОГРАНИЧЕННЫЙ — акция может двигаться бесконечно",
        breakeven_label="Страйк ± суммарная премия",
        when_to_use=(
            "Ожидаешь торговлю в очень узком диапазоне. "
            "Высокий IV = больше собираешь премии, IV-crush работает в твою пользу. "
            "ТОЛЬКО для опытных трейдеров с чётким планом выхода и стоп-лоссом."
        ),
        common_mistakes=(
            "Удержание через отчётность: одно движение уничтожает позицию",
            "Отсутствие предопределённых уровней стоп-лосса до входа в позицию",
            "Недооценка гамма-риска вблизи экспирации: небольшое движение = большой убыток",
        ),
        delta_dir="near_zero",
        gamma_dir="negative",
        theta_dir="positive",
        vega_dir="negative",
        legs=(
            {"type": "call", "direction": "short", "offset_pct": 0, "premium_pct": 3.0},
            {"type": "put",  "direction": "short", "offset_pct": 0, "premium_pct": 3.0},
        ),
        warning=(
            "⚠️ НЕОГРАНИЧЕННЫЙ РИСК: Эта стратегия может принести убыток, "
            "превышающий первоначальные инвестиции. Требует активного управления "
            "и обязательного стоп-лосса. Только для опытных трейдеров."
        ),
    ),

    StrategyProfile(
        id="iron_condor",
        name="Iron Condor",
        name_ru="Железный кондор",
        icon="🦅",
        outlook_tags=("neutral",),
        risk_type="defined",
        iv_pref="high",
        is_advanced=False,
        max_profit_label="Чистый кредит (полученная премия минус уплаченная)",
        max_loss_label="Ширина крыла − кредит (известна в момент входа)",
        breakeven_label="Два уровня: нижний страйк ± кредит и верхний страйк ± кредит",
        when_to_use=(
            "Ожидаешь диапазонную торговлю акции между двумя уровнями до экспирации. "
            "Высокий IV означает больший кредит за ту же вероятность прибыли. "
            "Определённый риск — альтернатива короткому стрэддлу для трейдеров с ограниченным риском."
        ),
        common_mistakes=(
            "Слишком узкие крылья: выше вероятность прикосновения к страйку, хотя кредит больше",
            "Игнорирование дельта-риска когда акция подходит к короткому страйку — пора корректировать",
            "Вход слишком близко к экспирации: не хватает времени на восстановление при движении",
        ),
        delta_dir="near_zero",
        gamma_dir="negative",
        theta_dir="positive",
        vega_dir="negative",
        legs=(
            {"type": "put",  "direction": "long",  "offset_pct": -15, "premium_pct": 0.5},
            {"type": "put",  "direction": "short", "offset_pct": -7,  "premium_pct": 1.5},
            {"type": "call", "direction": "short", "offset_pct":  7,  "premium_pct": 1.5},
            {"type": "call", "direction": "long",  "offset_pct":  15, "premium_pct": 0.5},
        ),
    ),

    StrategyProfile(
        id="protective_put",
        name="Protective Put",
        name_ru="Защитный пут",
        icon="🔒",
        outlook_tags=("bullish", "mildly_bullish"),
        risk_type="defined",
        iv_pref="low",
        is_advanced=False,
        max_profit_label="Неограниченный (акция растёт, пут истекает бесполезным)",
        max_loss_label="(Цена акции − страйк пута) + премия пута",
        breakeven_label="Цена акции + премия пута",
        when_to_use=(
            "Владеешь акцией и хочешь застраховаться от падения — как автомобильная страховка. "
            "Низкий IV делает страховку доступной. "
            "Сохраняешь полный апсайд акции при росте."
        ),
        common_mistakes=(
            "Покупка пута когда IV уже высокий: страховка стоит дорого именно когда риск реализован",
            "Слишком далёкий OTM страйк: дешевле, но защищает только от обвала, а не от коррекции",
            "Забывание о теме: стоимость страховки каждый день убывает — нужно обновлять позицию",
        ),
        delta_dir="positive",
        gamma_dir="positive",
        theta_dir="negative",
        vega_dir="positive",
        legs=(
            {"type": "put", "direction": "long", "offset_pct": -7, "premium_pct": 1.5},
        ),
    ),
]

# Index by id for O(1) lookup
STRATEGY_BY_ID: dict[str, StrategyProfile] = {s.id: s for s in STRATEGIES}


def filter_strategies(
    outlook: str,
    risk_type: str,
    iv_env: str,
) -> list[dict]:
    """
    Filter strategies by wizard inputs.  Returns a list of dicts, each containing:
      - profile: StrategyProfile
      - match_score: int (higher = better fit)
      - iv_warning: str | None (set when iv_env conflicts with strategy iv_pref)
      - fit_reason: str (human-readable explanation of why this strategy fits)

    Guarantees at least 1 result for any valid input combination.

    Parameters
    ----------
    outlook   : one of bullish | mildly_bullish | neutral | mildly_bearish | bearish | volatile
    risk_type : "defined" | "open"
    iv_env    : "high" | "low" | "unsure"
    """
    results = []

    for s in STRATEGIES:
        # ── Outlook filter (hard) ──────────────────────────────────────────────
        if outlook not in s.outlook_tags:
            continue

        # ── Risk filter ────────────────────────────────────────────────────────
        # "open" risk users see everything; "defined" users only see defined-risk strategies
        if risk_type == "defined" and s.risk_type == "open":
            continue

        # ── IV alignment ───────────────────────────────────────────────────────
        iv_warning: str | None = None
        match_score = 10  # base score for outlook match

        if iv_env == "unsure" or s.iv_pref == "any":
            match_score += 5
        elif iv_env == "high" and s.iv_pref == "high":
            match_score += 10
        elif iv_env == "low" and s.iv_pref == "low":
            match_score += 10
        elif iv_env == "high" and s.iv_pref == "low":
            iv_warning = (
                "Эта стратегия предпочтительна при низком IV. "
                "При высоком IV вы переплачиваете за временную стоимость."
            )
            match_score += 2
        elif iv_env == "low" and s.iv_pref == "high":
            iv_warning = (
                "Эта стратегия эффективнее при высоком IV (больше премии). "
                "При низком IV кредит может не компенсировать риск."
            )
            match_score += 2

        fit_reason = _build_fit_reason(s, outlook, risk_type, iv_env)
        results.append({
            "id": s.id,
            "match_score": match_score,
            "iv_warning": iv_warning,
            "fit_reason": fit_reason,
        })

    # Sort by match_score descending
    results.sort(key=lambda x: x["match_score"], reverse=True)

    # Safety net: if nothing matched (shouldn't happen), return all defined-risk strategies
    if not results:
        results = [
            {"id": s.id, "match_score": 1, "iv_warning": "Не самый подходящий IV контекст", "fit_reason": "Запасной вариант — пересмотрите входные параметры"}
            for s in STRATEGIES if s.risk_type == "defined"
        ]

    return results


def _build_fit_reason(
    s: StrategyProfile,
    outlook: str,
    risk_type: str,
    iv_env: str,
) -> str:
    """Generate a one-sentence human-readable reason why this strategy fits."""
    outlook_map = {
        "bullish": "у вас бычий взгляд",
        "mildly_bullish": "у вас умеренно бычий взгляд",
        "neutral": "вы ожидаете боковое движение",
        "mildly_bearish": "у вас умеренно медвежий взгляд",
        "bearish": "у вас медвежий взгляд",
        "volatile": "вы ожидаете резкое движение в любую сторону",
    }
    iv_map = {
        "high": "высокий IV (выгодно продавать)",
        "low":  "низкий IV (выгодно покупать)",
        "unsure": "неопределённый IV",
    }
    outlook_text = outlook_map.get(outlook, outlook)
    iv_text = iv_map.get(iv_env, iv_env)
    risk_text = "риск ограничен" if s.risk_type == "defined" else "готовы принять неограниченный риск"
    return (
        f"{s.name_ru}: подходит, потому что {outlook_text}, {iv_text} и {risk_text}."
    )


def all_strategy_dicts() -> list[dict]:
    """Return all strategies serialised to plain dicts (for JSON API response)."""
    result = []
    for s in STRATEGIES:
        result.append({
            "id": s.id,
            "name": s.name,
            "name_ru": s.name_ru,
            "icon": s.icon,
            "outlook_tags": list(s.outlook_tags),
            "risk_type": s.risk_type,
            "iv_pref": s.iv_pref,
            "is_advanced": s.is_advanced,
            "max_profit_label": s.max_profit_label,
            "max_loss_label": s.max_loss_label,
            "breakeven_label": s.breakeven_label,
            "when_to_use": s.when_to_use,
            "common_mistakes": list(s.common_mistakes),
            "greeks": {
                "delta": s.delta_dir,
                "gamma": s.gamma_dir,
                "theta": s.theta_dir,
                "vega": s.vega_dir,
            },
            "legs": [dict(leg) for leg in s.legs],
            "warning": s.warning,
        })
    return result
