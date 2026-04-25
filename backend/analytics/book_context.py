"""
Context extracted from "Trading Volatility: Trading Volatility, Correlation,
Term Structure and Skew" by Colin Bennett (Santander Global Banking & Markets).
"""

import math
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EvidenceItem:
    """One data point that contributed to the signal decision."""
    label: str          # e.g. "IV Rank"
    value: str          # e.g. "78/100"
    status: str         # "good" | "bad" | "neutral" | "warning"
    meaning: str        # e.g. "Верхние 22% — опционы дороги, преимущество продавца"
    threshold: str      # e.g. "Порог сигнала: > 50"


@dataclass
class ChapterSignal:
    chapter: str
    chapter_title: str
    signal_name: str
    score: float
    level: str          # "bullish" | "bearish" | "neutral" | "warning"
    title: str
    body: str
    strategy_hint: str
    profit_catalyst: str
    # New: detailed evidence and rules
    data_evidence: list[EvidenceItem] = field(default_factory=list)
    entry_rules: str = ""    # step-by-step entry instructions
    exit_rules: str = ""     # when/how to exit
    risk_note: str = ""      # primary risk to monitor


# ─────────────────────────────────────────────────────────────────────────────
# Chapter 1 — Variance Risk Premium (VRP)
# ─────────────────────────────────────────────────────────────────────────────

def chapter1_vrp_signal(
    iv: Optional[float],
    hv_30: Optional[float],
    iv_rank: Optional[float],
) -> Optional[ChapterSignal]:
    if iv is None or hv_30 is None or iv_rank is None:
        return None

    vrp = (iv - hv_30) * 100

    if vrp > 8 and iv_rank > 50:
        score = min(100, 50 + vrp * 2 + (iv_rank - 50) * 0.8)
        evidence = [
            EvidenceItem(
                label="IV (подразумеваемая волатильность)",
                value=f"{iv*100:.1f}%",
                status="warning",
                meaning=f"Рынок закладывает волатильность {iv*100:.1f}% годовых",
                threshold="—",
            ),
            EvidenceItem(
                label="HV30 (реализованная волатильность)",
                value=f"{hv_30*100:.1f}%",
                status="neutral",
                meaning=f"Фактическая волатильность за 30 дней составила {hv_30*100:.1f}%",
                threshold="—",
            ),
            EvidenceItem(
                label="VRP = IV − HV30",
                value=f"+{vrp:.1f} пп",
                status="good",
                meaning=f"Опционы переоценены на {vrp:.1f} процентных пункта волатильности. "
                        f"Беннетт: исторически VRP > 5 пп. стабильно выигрывали продавцы.",
                threshold="Порог: > 8 пп для сильного сигнала",
            ),
            EvidenceItem(
                label="IV Rank (52-нед. перцентиль)",
                value=f"{iv_rank:.0f}/100",
                status="good",
                meaning=f"IV выше, чем {iv_rank:.0f}% всех значений за последний год. "
                        f"Продавцы собирают максимальную премию относительно истории.",
                threshold="Порог: > 50 для подтверждения сигнала",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 1",
            chapter_title="Премия за риск волатильности (VRP)",
            signal_name="vrp_sell",
            score=round(score, 1),
            level="bullish",
            title=f"VRP +{vrp:.1f} пп при IV Rank {iv_rank:.0f} — продажа волатильности оправдана",
            body=(
                f"IV ({iv*100:.1f}%) превышает реализованную HV30 ({hv_30*100:.1f}%) "
                f"на {vrp:.1f} пп. Это «Variance Risk Premium» — систематическая переплата "
                f"рынком за страховку. По Беннетту, VRP > 5 пп при IV Rank > 50 исторически "
                f"давала положительный EV продавцам во всех классах активов. "
                f"Чем выше VRP, тем больше «страховой» переплаты вы захватываете."
            ),
            strategy_hint="Кредитные спреды, покрытые коллы, cash-secured puts, железные кондоры",
            profit_catalyst="IV снижается к HV30 (mean reversion). Каждый день без движения = прибыль.",
            data_evidence=evidence,
            entry_rules=(
                "1. Выберите страйк с дельтой 0.20–0.35 (OTM, но не слишком далеко).\n"
                "2. DTE: оптимально 21–45 дней — максимальный тета-распад без чрезмерного гамма-риска.\n"
                "3. Для спреда: продайте опцион, купите защитный на 5–10% дальше от ATM.\n"
                "4. Получаемый кредит должен составлять ≥ 1/3 ширины спреда.\n"
                "5. Размер позиции: риск ≤ 2% депозита на сделку."
            ),
            exit_rules=(
                "• Закрыть при 50% прибыли (половина кредита собрана) — статистически оптимально.\n"
                "• Стоп-лосс: если позиция достигла убытка 2× кредит — закрыть без исключений.\n"
                "• Временной стоп: за 5–7 дней до экспирации — откатить или закрыть.\n"
                "• При резком росте IV (>20% за день) — пересмотреть позицию."
            ),
            risk_note=(
                f"Основной риск: резкое направленное движение акции пробивает страйк. "
                f"При VRP+{vrp:.1f} пп рынок переоценивает волатильность, но не направление."
            ),
        )

    elif vrp < -5 and iv_rank < 35:
        score = min(100, 40 + abs(vrp) * 2 + (35 - iv_rank) * 0.8)
        evidence = [
            EvidenceItem(
                label="VRP = IV − HV30",
                value=f"{vrp:.1f} пп",
                status="good",
                meaning=f"IV ниже реализованной волатильности на {abs(vrp):.1f} пп. "
                        f"Редкая ситуация — опционы структурно дёшевы.",
                threshold="Порог: < −5 пп",
            ),
            EvidenceItem(
                label="IV Rank",
                value=f"{iv_rank:.0f}/100",
                status="good",
                meaning=f"IV в нижних {iv_rank:.0f}% истории — исторически дешёвые опционы.",
                threshold="Порог: < 35",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 1",
            chapter_title="Премия за риск волатильности (VRP)",
            signal_name="vrp_buy",
            score=round(score, 1),
            level="bearish",
            title=f"Отрицательный VRP {vrp:.1f} пп — опционы дешевле реализованной волатильности",
            body=(
                f"IV ({iv*100:.1f}%) ниже HV30 ({hv_30*100:.1f}%) на {abs(vrp):.1f} пп. "
                f"Рынок недооценивает волатильность. По Беннетту, это редкая ситуация, "
                f"создающая структурное преимущество для покупателей: вы платите за "
                f"волатильность меньше, чем она исторически реализовывалась."
            ),
            strategy_hint="Длинные коллы/путы, стрэддлы, стрэнглы, дебетовые спреды",
            profit_catalyst="Рост реализованной волатильности или расширение IV к среднему",
            data_evidence=evidence,
            entry_rules=(
                "1. Покупайте ATM или слегка OTM опционы (дельта 0.35–0.50).\n"
                "2. DTE: 30–60 дней — достаточно времени для реализации движения.\n"
                "3. Стрэддл: купить колл + пут на одном страйке для ненаправленной ставки.\n"
                "4. Размер: не более 1–2% депозита, т.к. покупка рискует всей премией."
            ),
            exit_rules=(
                "• Цель: 50–100% от уплаченной премии.\n"
                "• Стоп: потеря 50% уплаченной премии.\n"
                "• Временной стоп: если за 1/3 времени движения нет — рассмотреть выход."
            ),
            risk_note="Временной распад работает против покупателя. Нужно движение быстро.",
        )

    elif vrp > 3 and iv_rank >= 30:
        score = 30 + vrp * 2
        evidence = [
            EvidenceItem(
                label="VRP = IV − HV30",
                value=f"+{vrp:.1f} пп",
                status="neutral",
                meaning=f"Умеренное превышение IV над реализованной — небольшое преимущество продавца.",
                threshold="Порог умеренного сигнала: 3–8 пп",
            ),
            EvidenceItem(
                label="IV Rank",
                value=f"{iv_rank:.0f}/100",
                status="neutral",
                meaning="Средний диапазон IV — нейтральная среда.",
                threshold="30–50: нейтральная зона",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 1",
            chapter_title="Премия за риск волатильности (VRP)",
            signal_name="vrp_moderate",
            score=round(score, 1),
            level="neutral",
            title=f"VRP +{vrp:.1f} пп — умеренное преимущество продавца",
            body=(
                f"IV ({iv*100:.1f}%) выше HV30 ({hv_30*100:.1f}%) на {vrp:.1f} пп. "
                f"Небольшое структурное преимущество для продавцов. "
                f"Сигнал не критичный, но в сочетании с другими факторами — рабочий."
            ),
            strategy_hint="Кредитные спреды с жёстким управлением рисками",
            profit_catalyst="Стабильность цены + постепенное снижение IV",
            data_evidence=evidence,
            entry_rules=(
                "1. Используйте только спреды — не голые опционы при умеренном VRP.\n"
                "2. DTE 21–35 дней, страйк 0.25–0.30 дельта.\n"
                "3. Кредит ≥ 30% ширины спреда."
            ),
            exit_rules=(
                "• Закрыть при 40–50% прибыли.\n"
                "• Стоп: 1.5× кредит убытка."
            ),
            risk_note="Умеренный сигнал — уменьшите размер позиции на 50% от стандартного.",
        )

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Chapter 2 — Volatility Term Structure
# ─────────────────────────────────────────────────────────────────────────────

def chapter2_term_structure_signal(
    iv_rank: Optional[float],
    days_to_expiry: int,
    days_to_earnings: Optional[int],
) -> Optional[ChapterSignal]:
    if iv_rank is None:
        return None

    if days_to_earnings is not None and 3 <= days_to_earnings <= 14:
        score = 70 + max(0, (iv_rank - 40) * 0.5)
        evidence = [
            EvidenceItem(
                label="Дней до отчётности",
                value=f"{days_to_earnings} дн.",
                status="warning",
                meaning=f"Отчётность через {days_to_earnings} дн. — краткосрочная IV резко "
                        f"завышена из-за «событийного» страха. После публикации IV обрушится.",
                threshold="Зона события: 3–14 дней",
            ),
            EvidenceItem(
                label="IV Rank",
                value=f"{iv_rank:.0f}/100",
                status="warning" if iv_rank > 50 else "neutral",
                meaning=f"{'Высокий IV Rank усиливает overpricing ближнего опциона.' if iv_rank > 50 else 'Средний IV Rank — умеренная перекупленность.'}",
                threshold="Усиливает сигнал при > 50",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 2",
            chapter_title="Срочная структура волатильности",
            signal_name="term_structure_event",
            score=round(score, 1),
            level="warning",
            title=f"IV backwardation: отчётность через {days_to_earnings} дн. → ближний опцион раздут",
            body=(
                f"Перед отчётностью краткосрочная IV резко растёт (backwardation). "
                f"Это классическая возможность для продажи front-month опционов: "
                f"ближний страйк стоит аномально дорого относительно долгосрочного. "
                f"После публикации отчётности IV обычно падает на 40–60% (IV crush). "
                f"IV Rank {iv_rank:.0f}/100 подтверждает повышенную стоимость."
            ),
            strategy_hint="Продажа straddle/strangle за 1–2 дня до отчётности, закрытие на следующее утро",
            profit_catalyst="IV collapse после выхода отчётности (типичное падение 40–60%)",
            data_evidence=evidence,
            entry_rules=(
                f"1. Открыть за 1–2 дня до отчётности, НЕ раньше.\n"
                f"2. Страйк: ATM straddle или OTM strangle (дельта ±0.20–0.25 на каждой стороне).\n"
                f"3. Получаемый кредит = ожидаемое движение рынка (подтвердите по опционной цепочке).\n"
                f"4. Размер: не более 1% депозита — событийный риск высок.\n"
                f"5. Дата экспирации: опцион с экспирацией СРАЗУ после отчётности (не дальше)."
            ),
            exit_rules=(
                "• Закрыть на следующий день после отчётности при открытии рынка.\n"
                "• Не удерживать — IV crush уже произошёл, держать нет смысла.\n"
                "• Если акция пробила страйк — закрыть убыточную ногу сразу."
            ),
            risk_note=(
                f"Главный риск: неожиданно большое движение акции (gap) пробьёт страйк. "
                f"Защита: используйте спред вместо голого стрэддла, или уменьшите размер."
            ),
        )

    if days_to_expiry <= 14 and iv_rank > 60:
        score = 55 + (iv_rank - 60) * 0.8
        evidence = [
            EvidenceItem(
                label="Дней до экспирации (DTE)",
                value=f"{days_to_expiry} дн.",
                status="good",
                meaning=f"Короткий DTE = максимальное ускорение тета-распада. "
                        f"Нелинейный рост Θ в последние 14 дней работает на продавца.",
                threshold="Зона ускоренного распада: ≤ 14 дней",
            ),
            EvidenceItem(
                label="IV Rank",
                value=f"{iv_rank:.0f}/100",
                status="good",
                meaning=f"IV в верхних {100-iv_rank:.0f}% истории — продаёте дорогую волатильность.",
                threshold="Порог: > 60",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 2",
            chapter_title="Срочная структура волатильности",
            signal_name="term_structure_contango",
            score=round(score, 1),
            level="bullish",
            title=f"Front-month перекуплен: DTE {days_to_expiry} + IV Rank {iv_rank:.0f} — зона тета-сбора",
            body=(
                f"При IV Rank {iv_rank:.0f}/100 и {days_to_expiry} днях до экспирации "
                f"вы продаёте максимально дорогую волатильность в зоне ускоренного распада. "
                f"Беннетт: нелинейное ускорение тета после 30 DTE делает этот диапазон "
                f"наиболее эффективным для продажи. Каждый день работает на вас."
            ),
            strategy_hint="Короткий кредитный спред с текущей экспирацией",
            profit_catalyst="Тета-распад + отсутствие большого движения до экспирации",
            data_evidence=evidence,
            entry_rules=(
                "1. Продайте спред на этой же экспирации (DTE ≤ 14).\n"
                "2. Страйк: OTM 0.20–0.25 дельта — вне зоны риска, но с хорошей премией.\n"
                "3. Спред: ширина 5–10% от цены акции для разумного соотношения риск/прибыль.\n"
                "4. Проверьте: нет ли отчётности в этот период?"
            ),
            exit_rules=(
                "• Цель: 50% кредита (часто достигается за 3–5 дней).\n"
                "• При достижении цели — немедленно закрыть, не жадничать.\n"
                "• Стоп: позиция вышла в убыток 2× кредит."
            ),
            risk_note=(
                f"Гамма-риск высок при DTE ≤ 7: небольшое движение резко изменяет дельту. "
                f"Не удерживать голые позиции в последнюю неделю."
            ),
        )

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Chapter 3 — Volatility Smile and Skew
# ─────────────────────────────────────────────────────────────────────────────

def chapter3_skew_signal(
    iv: Optional[float],
    hv_30: Optional[float],
    iv_rank: Optional[float],
    option_type: str,
    delta: Optional[float],
) -> Optional[ChapterSignal]:
    if iv_rank is None or delta is None:
        return None

    abs_delta = abs(delta)

    if option_type == "put" and abs_delta < 0.35 and iv_rank > 45:
        score = 40 + (iv_rank - 45) * 0.8 + (0.35 - abs_delta) * 80
        evidence = [
            EvidenceItem(
                label="Тип опциона",
                value="OTM Put",
                status="good",
                meaning="OTM путы систематически переоценены из-за структурного спроса на «страховку» (equity skew).",
                threshold="—",
            ),
            EvidenceItem(
                label="Дельта (|Δ|)",
                value=f"{abs_delta:.2f}",
                status="good",
                meaning=f"|Δ| = {abs_delta:.2f}: опцион достаточно OTM для захвата скью-премии. "
                        f"Чем дальше от ATM, тем сильнее skew overpricing.",
                threshold="Зона скью: |Δ| < 0.35",
            ),
            EvidenceItem(
                label="IV Rank",
                value=f"{iv_rank:.0f}/100",
                status="good",
                meaning=f"Высокий IV Rank усиливает переоценённость путов.",
                threshold="Порог: > 45",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 3",
            chapter_title="Улыбка и перекос волатильности (Skew)",
            signal_name="skew_otm_put",
            score=round(score, 1),
            level="bullish",
            title=f"OTM пут Δ={delta:.2f}: equity skew завышает IV — продавец в преимуществе",
            body=(
                f"Беннетт: в акциях существует постоянный «отрицательный перекос» (negative skew) — "
                f"OTM путы всегда дороже ATM на единицу риска из-за страхового спроса. "
                f"Этот OTM пут (Δ={delta:.2f}) торгуется с IV-надбавкой скью. "
                f"Продажа через bull put spread позволяет захватить эту структурную надбавку "
                f"при контролируемом максимальном риске."
            ),
            strategy_hint="Bull put spread: продать этот OTM пут, купить более низкий пут для защиты",
            profit_catalyst="Акция остаётся выше страйка, IV скью сжимается к норме",
            data_evidence=evidence,
            entry_rules=(
                "1. Продайте этот OTM пут (Δ ≈ −0.20 до −0.30).\n"
                "2. Купите защитный пут на 5–10% ниже страйка (Δ ≈ −0.10).\n"
                "3. DTE: 21–45 дней оптимально.\n"
                "4. Кредит: минимум 30% ширины спреда.\n"
                "5. Это бычья-нейтральная стратегия — нужно, чтобы акция НЕ упала ниже страйка."
            ),
            exit_rules=(
                "• Цель: 50% полученного кредита.\n"
                "• Стоп: цена акции приближается к страйку (дельта короткого пута достигла −0.50).\n"
                "• Ролл: если угрожает экспирация ITM — ролл вниз и вперёд по времени."
            ),
            risk_note=(
                "Если акция падает ниже страйка короткого пута — убыток нарастает быстро. "
                "Всегда используйте спред, а не голый пут. Максимальный риск = ширина спреда − кредит."
            ),
        )

    if option_type == "call" and abs_delta < 0.35 and iv_rank < 40:
        score = 35 + (40 - iv_rank) * 0.9 + (0.35 - abs_delta) * 60
        evidence = [
            EvidenceItem(
                label="Тип опциона",
                value="OTM Call",
                status="good",
                meaning="OTM коллы дешевле путов из-за negative skew — их покупка выгодна при низкой IV.",
                threshold="—",
            ),
            EvidenceItem(
                label="IV Rank",
                value=f"{iv_rank:.0f}/100",
                status="good",
                meaning=f"Низкий IV Rank ({iv_rank:.0f}) = исторически дешёвые опционы. "
                        f"Покупка коллов при низком IV — оплата ниже среднего.",
                threshold="Порог: < 40",
            ),
            EvidenceItem(
                label="Дельта (|Δ|)",
                value=f"{abs_delta:.2f}",
                status="neutral",
                meaning=f"OTM колл с дельтой {abs_delta:.2f}: асимметричный профиль риска.",
                threshold="Зона: |Δ| < 0.35",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 3",
            chapter_title="Улыбка и перекос волатильности (Skew)",
            signal_name="skew_otm_call",
            score=round(score, 1),
            level="neutral",
            title=f"OTM колл Δ={delta:.2f}: дешев относительно путов из-за skew + низкий IV Rank",
            body=(
                f"При equity skew OTM коллы торгуются с дисконтом к путам. "
                f"В сочетании с IV Rank {iv_rank:.0f}/100 (исторически дёшево) "
                f"это создаёт двойное преимущество для покупателей коллов: "
                f"низкая абсолютная IV + скидка от skew. "
                f"Bull call spread снижает стоимость позиции при сохранении направленного потенциала."
            ),
            strategy_hint="Bull call spread: купить этот колл, продать более дорогой колл выше",
            profit_catalyst="Рост акции выше страйка + возможный рост IV к среднему",
            data_evidence=evidence,
            entry_rules=(
                "1. Купите этот OTM колл (Δ ≈ 0.25–0.35).\n"
                "2. Продайте колл на 5–10% выше для снижения стоимости (bull call spread).\n"
                "3. DTE: 30–60 дней — время для реализации бычьего движения.\n"
                "4. Стоимость спреда: не более 30% ширины (иначе risk/reward неприемлемый)."
            ),
            exit_rules=(
                "• Цель: 50–75% от ширины спреда.\n"
                "• Стоп: потеря 50% уплаченного дебета.\n"
                "• Временной стоп: за 14 дней до экспирации — если нет движения, выйти."
            ),
            risk_note="Покупаете время — тета работает против вас. Нужно движение в разумные сроки.",
        )

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Chapter 4 — Greeks Management (Theta/Vega Efficiency)
# ─────────────────────────────────────────────────────────────────────────────

def chapter4_greeks_signal(
    delta: Optional[float],
    gamma: Optional[float],
    theta: Optional[float],
    vega: Optional[float],
    market_price: float,
    days_to_expiry: int,
) -> Optional[ChapterSignal]:
    if theta is None or vega is None or market_price <= 0:
        return None

    abs_theta = abs(theta)
    if vega > 0 and abs_theta > 0:
        tv_ratio = abs_theta / vega
    else:
        return None

    if tv_ratio > 0.15 and days_to_expiry <= 45:
        score = min(100, 45 + tv_ratio * 200 + max(0, (45 - days_to_expiry)))
        theta_pct = abs_theta / market_price * 100
        total_theta = abs_theta * days_to_expiry * 100  # per contract

        evidence = [
            EvidenceItem(
                label="Theta (Θ) — распад в день",
                value=f"−${abs_theta:.3f}/день",
                status="good",
                meaning=f"Длинный опцион теряет ${abs_theta:.3f} в день. "
                        f"Это {theta_pct:.1f}% от цены опциона — {'высокий' if theta_pct > 1.5 else 'умеренный'} распад.",
                threshold="Высокий: > 1.5% в день",
            ),
            EvidenceItem(
                label="Vega (V) — чувствительность к IV",
                value=f"${vega:.3f} / 1% IV",
                status="neutral",
                meaning=f"При изменении IV на 1% цена опциона меняется на ${vega:.3f}. "
                        f"Продавец несёт vega-риск.",
                threshold="—",
            ),
            EvidenceItem(
                label="Θ/Vega — эффективность сбора",
                value=f"{tv_ratio:.3f}",
                status="good",
                meaning=f"Ключевая метрика Беннетта: сколько тета вы собираете на единицу vega-риска. "
                        f"{tv_ratio:.3f} — {'высокая' if tv_ratio > 0.20 else 'умеренная'} эффективность.",
                threshold="Порог: > 0.15 = хорошая эффективность",
            ),
            EvidenceItem(
                label="DTE (дней до экспирации)",
                value=f"{days_to_expiry} дн.",
                status="good",
                meaning=f"Нелинейное ускорение тета в последние {days_to_expiry} дней. "
                        f"До экспирации позиция потеряет ещё ~${total_theta:.0f} на контракт.",
                threshold="Зона ускоренного распада: ≤ 45 дней",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 4",
            chapter_title="Управление греками (Θ/Vega эффективность)",
            signal_name="greeks_theta_vega",
            score=round(score, 1),
            level="bullish",
            title=f"Θ/V={tv_ratio:.2f}: высокая эффективность тета-сбора при DTE={days_to_expiry}",
            body=(
                f"Θ/Vega = {tv_ratio:.3f} — Беннетт выделяет это как ключевую метрику "
                f"для оценки эффективности продажи опционов. "
                f"Θ ${abs_theta:.3f}/день при Vega ${vega:.3f}/1%IV: "
                f"за {days_to_expiry} дней контракт потеряет ~${total_theta:.0f} временной стоимости. "
                f"Нелинейное ускорение тета после 30 DTE — продавец максимизирует сбор."
            ),
            strategy_hint="Удерживать до 50% прибыли, закрывать и переоткрывать следующий цикл",
            profit_catalyst="Каждый торговый день без движения = прибыль для продавца",
            data_evidence=evidence,
            entry_rules=(
                "1. Продавайте опционы с Θ/Vega > 0.15 и DTE 21–45 дней.\n"
                "2. Используйте спред для ограничения vega-риска (не голые опционы).\n"
                "3. Открывайте в начале торгового дня для максимального тета за день.\n"
                "4. Размер: стандартный лот, риск ≤ 2% депозита."
            ),
            exit_rules=(
                "• 50% прибыли = сигнал закрытия (правило 21 DTE + 50% P&L).\n"
                "• Не держать до экспирации — гамма-риск в последние 5 дней слишком высок.\n"
                "• Если IV резко выросла (> +20%) — пересмотреть и, возможно, закрыть."
            ),
            risk_note=(
                f"Vega-риск: при росте IV на 5% позиция потеряет ~${vega*5*100:.0f} на контракт. "
                f"Компенсируется только при отсутствии движения."
            ),
        )

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Chapter 5 — Volatility Strategies (Straddles, Strangles, Butterflies)
# ─────────────────────────────────────────────────────────────────────────────

def chapter5_strategy_signal(
    iv_rank: Optional[float],
    iv: Optional[float],
    hv_30: Optional[float],
    delta: Optional[float],
    days_to_expiry: int,
) -> Optional[ChapterSignal]:
    if iv_rank is None or iv is None or delta is None:
        return None

    abs_delta = abs(delta)

    if 0.4 <= abs_delta <= 0.6:
        T = max(days_to_expiry, 1) / 365.0
        straddle_be = iv * math.sqrt(T) * 100  # % move needed

        if iv_rank < 25:
            score = 60 + (25 - iv_rank) * 1.5
            evidence = [
                EvidenceItem(
                    label="Дельта (ATM зона)",
                    value=f"{delta:.2f}",
                    status="good",
                    meaning=f"Дельта {delta:.2f} — опцион около денег (ATM): максимальная гамма, "
                            f"чистая ставка на волатильность.",
                    threshold="ATM зона: |Δ| 0.40–0.60",
                ),
                EvidenceItem(
                    label="IV Rank",
                    value=f"{iv_rank:.0f}/100",
                    status="good",
                    meaning=f"Нижние {iv_rank:.0f}% истории — стрэддл исторически дёшев.",
                    threshold="Порог дешёвого стрэддла: < 25",
                ),
                EvidenceItem(
                    label="Безубыток стрэддла",
                    value=f"±{straddle_be:.1f}%",
                    status="good",
                    meaning=f"Акции нужно пройти {straddle_be:.1f}% в любую сторону. "
                            f"При низкой IV это порог ниже исторического среднего.",
                    threshold=f"IV × √(DTE/365) = {iv*100:.1f}% × √({days_to_expiry}/365)",
                ),
            ]
            return ChapterSignal(
                chapter="Гл. 5",
                chapter_title="Стратегии волатильности",
                signal_name="strategy_straddle_cheap",
                score=round(score, 1),
                level="neutral",
                title=f"ATM опцион + IV Rank {iv_rank:.0f}: стрэддл дёшев, порог безубытка ±{straddle_be:.1f}%",
                body=(
                    f"ATM опцион (Δ={delta:.2f}) при IV Rank {iv_rank:.0f}/100 — "
                    f"Беннетт называет стрэддл «чистой ставкой на реализованную волатильность». "
                    f"Порог безубытка: акции нужно пройти ±{straddle_be:.1f}% до экспирации. "
                    f"При исторически низкой IV этот порог меньше, чем реализовывалось раньше."
                ),
                strategy_hint="Длинный стрэддл (купить колл + пут на одном ATM страйке)",
                profit_catalyst="Движение акции > ±{straddle_be:.1f}% в любую сторону, или рост IV",
                data_evidence=evidence,
                entry_rules=(
                    f"1. Купить ATM колл И ATM пут (одинаковый страйк ближайший к цене).\n"
                    f"2. DTE: 30–45 дней оптимально.\n"
                    f"3. Общая стоимость стрэддла = размер вашей ставки на волатильность.\n"
                    f"4. Нет необходимости угадывать направление — ставка на ДВИЖЕНИЕ."
                ),
                exit_rules=(
                    "• Цель: 25–50% от уплаченной суммы при резком движении.\n"
                    "• Стоп по времени: за 14 дней до экспирации — продать, если нет движения.\n"
                    "• Стоп по деньгам: потеря 40% суммы стрэддла."
                ),
                risk_note="Тета работает против вас каждый день. Нужно движение быстро.",
            )

        elif iv_rank > 65:
            score = 55 + (iv_rank - 65) * 0.9
            evidence = [
                EvidenceItem(
                    label="Дельта (ATM зона)",
                    value=f"{delta:.2f}",
                    status="good",
                    meaning="ATM опцион — максимальная временная стоимость для продажи.",
                    threshold="ATM зона: |Δ| 0.40–0.60",
                ),
                EvidenceItem(
                    label="IV Rank",
                    value=f"{iv_rank:.0f}/100",
                    status="good",
                    meaning=f"Верхние {100-iv_rank:.0f}% — стрэддл исторически дорог. "
                            f"Рынок закладывает движение больше исторического среднего.",
                    threshold="Порог дорогого стрэддла: > 65",
                ),
                EvidenceItem(
                    label="Безубыток стрэддла",
                    value=f"±{straddle_be:.1f}%",
                    status="warning",
                    meaning=f"Покупателю нужно ±{straddle_be:.1f}% — при высокой IV это много. "
                            f"Продавцу выгодно: рынок переоценил ожидаемое движение.",
                    threshold=f"{iv*100:.1f}% × √({days_to_expiry}/365)",
                ),
            ]
            return ChapterSignal(
                chapter="Гл. 5",
                chapter_title="Стратегии волатильности",
                signal_name="strategy_straddle_sell",
                score=round(score, 1),
                level="bullish",
                title=f"ATM опцион + IV Rank {iv_rank:.0f}: продажа стрэддла, порог ±{straddle_be:.1f}%",
                body=(
                    f"IV Rank {iv_rank:.0f}/100 — рынок переоценил ожидаемое движение. "
                    f"Покупателю стрэддла нужно ±{straddle_be:.1f}% до экспирации. "
                    f"По Беннетту, при высоком IV Rank стрэддл стоит дороже, "
                    f"чем исторически реализовывалось: преимущество на стороне продавца. "
                    f"Баттерфляй снижает риск vs голый стрэддл."
                ),
                strategy_hint="Продажа стрэнгла (OTM call + OTM put) или железного баттерфляя",
                profit_catalyst="IV снижается, акция торгуется в диапазоне ±{straddle_be:.1f}%",
                data_evidence=evidence,
                entry_rules=(
                    "1. Стрэнгл: продать OTM колл (Δ≈0.25) и OTM пут (Δ≈−0.25).\n"
                    "2. Железный баттерфляй: продать ATM + купить крылья OTM для защиты.\n"
                    "3. DTE: 21–35 дней для оптимального Θ/Γ соотношения.\n"
                    "4. Кредит стрэнгла должен покрывать ожидаемое движение акции."
                ),
                exit_rules=(
                    "• 50% кредита = закрыть немедленно.\n"
                    "• SL: 2× полученный кредит убытка.\n"
                    "• Временной стоп: за 7 дней до экспирации — закрыть или ролл."
                ),
                risk_note="Гамма-риск растёт при приближении к экспирации. Не держать до конца.",
            )

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Chapter 6 — Probability and Expected Value (EV Framework)
# ─────────────────────────────────────────────────────────────────────────────

def chapter6_probability_signal(
    current_price: float,
    strike: float,
    iv: Optional[float],
    days_to_expiry: int,
    delta: Optional[float],
    market_price: float,
    option_type: str,
) -> Optional[ChapterSignal]:
    if iv is None or delta is None or current_price <= 0 or market_price <= 0:
        return None

    T = max(days_to_expiry, 1) / 365.0
    expected_move_1sd = current_price * iv * math.sqrt(T)

    p_itm = abs(delta)

    if option_type == "call":
        breakeven = strike + market_price
        move_to_be = breakeven - current_price
    else:
        breakeven = strike - market_price
        move_to_be = current_price - breakeven

    move_pct = move_to_be / current_price * 100
    be_vs_1sd = move_to_be / expected_move_1sd if expected_move_1sd > 0 else 999
    ev_estimate = p_itm * (move_to_be * 0.5) * 100 - (1 - p_itm) * market_price * 100

    if be_vs_1sd < 0.7 and p_itm > 0.25:
        score = min(100, 50 + p_itm * 60 + (1 - be_vs_1sd) * 30)
        evidence = [
            EvidenceItem(
                label="Вероятность прибыли (≈ |Δ|)",
                value=f"{p_itm*100:.0f}%",
                status="good",
                meaning=f"Дельта {delta:.2f} ≈ вероятность истечения ITM. "
                        f"{p_itm*100:.0f}% шанс оказаться в прибыли к экспирации.",
                threshold="Минимум: > 25%",
            ),
            EvidenceItem(
                label="Безубыток (BEP)",
                value=f"${breakeven:.2f} (+{move_pct:.1f}%)",
                status="good",
                meaning=f"Акции нужно достичь ${breakeven:.2f} для безубытка. "
                        f"Это {move_pct:.1f}% от текущей цены.",
                threshold="—",
            ),
            EvidenceItem(
                label="BEP в единицах 1σ",
                value=f"{be_vs_1sd:.2f}σ",
                status="good",
                meaning=f"Безубыток = {be_vs_1sd:.2f} стандартных отклонения. "
                        f"Рынок ожидает движение ±1σ = ±${expected_move_1sd:.2f}. "
                        f"BEP < 1σ: математически достижимо без экстремального движения.",
                threshold="Хорошо: < 0.70σ",
            ),
            EvidenceItem(
                label="Ожидаемое движение (1σ)",
                value=f"±${expected_move_1sd:.2f} (±{expected_move_1sd/current_price*100:.1f}%)",
                status="neutral",
                meaning=f"IV × √(DTE/365) × цена = 1 стандартное отклонение движения акции. "
                        f"68% вероятность, что акция останется в этом диапазоне.",
                threshold=f"{iv*100:.1f}% × √({days_to_expiry}/365) × ${current_price:.2f}",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 6",
            chapter_title="Вероятность и ожидаемая стоимость (EV)",
            signal_name="prob_favorable",
            score=round(score, 1),
            level="bullish" if ev_estimate > 0 else "neutral",
            title=f"BEP={be_vs_1sd:.2f}σ < 1σ: математика на вашей стороне (P={p_itm*100:.0f}%)",
            body=(
                f"Безубыток ${breakeven:.2f} (+{move_pct:.1f}%) находится в пределах "
                f"1 стандартного отклонения ({be_vs_1sd:.2f}σ). "
                f"Рынок ожидает движение ±${expected_move_1sd:.2f} (1σ = {expected_move_1sd/current_price*100:.1f}%). "
                f"Вероятность прибыли ≈ {p_itm*100:.0f}% (по дельте). "
                f"Это означает: опцион структурно выгоден относительно заложенного движения."
            ),
            strategy_hint="Войти с чётким тезисом о направлении; использовать спред для снижения стоимости",
            profit_catalyst=f"Движение > {move_pct:.1f}% за {days_to_expiry} дней",
            data_evidence=evidence,
            entry_rules=(
                f"1. Убедитесь в наличии направленного тезиса (катализатор роста/падения).\n"
                f"2. Цена входа: mid-price между bid/ask.\n"
                f"3. Размер: не более 2% депозита на направленную ставку.\n"
                f"4. Рассмотреть спред: купить этот опцион + продать дальний для снижения BEP."
            ),
            exit_rules=(
                f"• Цель: акция достигает ${breakeven * 1.05:.2f} (+{move_pct*1.3:.1f}%).\n"
                f"• Стоп по опциону: потеря 40% уплаченной премии.\n"
                f"• Временной стоп: за 14 дней до экспирации при отсутствии движения."
            ),
            risk_note=(
                f"Тета-распад: ~${abs(market_price * 0.01):.2f}/день против вас. "
                f"Нужно движение в первые 2/3 срока жизни опциона."
            ),
        )

    elif be_vs_1sd > 1.5:
        evidence = [
            EvidenceItem(
                label="BEP в единицах 1σ",
                value=f"{be_vs_1sd:.2f}σ",
                status="bad",
                meaning=f"Безубыток требует {be_vs_1sd:.1f} стандартных отклонения. "
                        f"Это экстремальное движение — математика не в вашу пользу.",
                threshold="Плохо: > 1.5σ",
            ),
            EvidenceItem(
                label="Вероятность прибыли",
                value=f"{p_itm*100:.0f}%",
                status="bad",
                meaning=f"Только {p_itm*100:.0f}% шанс на прибыль к экспирации.",
                threshold="—",
            ),
        ]
        return ChapterSignal(
            chapter="Гл. 6",
            chapter_title="Вероятность и ожидаемая стоимость (EV)",
            signal_name="prob_unfavorable",
            score=max(10, 40 - be_vs_1sd * 10),
            level="warning",
            title=f"BEP={be_vs_1sd:.1f}σ — тяжёлая математика: нужно {move_pct:.1f}%, шанс {p_itm*100:.0f}%",
            body=(
                f"Безубыток ${breakeven:.2f} требует {move_pct:.1f}% движения "
                f"({be_vs_1sd:.1f}σ). Рынок ожидает ±{expected_move_1sd/current_price*100:.1f}% (1σ). "
                f"Вероятность прибыли ≈ {p_itm*100:.0f}%. "
                f"Математика против покупателя — рассмотрите спред для снижения BEP."
            ),
            strategy_hint="Использовать спред для снижения стоимости и точки безубытка",
            profit_catalyst="Требуется экстремальное движение или сильный рост IV",
            data_evidence=evidence,
            entry_rules="Рассмотреть спред или отказаться от сделки при BEP > 1.5σ.",
            exit_rules="Стоп: потеря 30% суммы. Не ждать экспирации.",
            risk_note="Высокий BEP в σ — опцион переоценён относительно вероятности. Избегать.",
        )

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Aggregate
# ─────────────────────────────────────────────────────────────────────────────

def get_all_chapter_signals(
    ticker: str,
    iv: Optional[float],
    hv_30: Optional[float],
    iv_rank: Optional[float],
    days_to_expiry: int,
    days_to_earnings: Optional[int],
    delta: Optional[float],
    gamma: Optional[float],
    theta: Optional[float],
    vega: Optional[float],
    market_price: float,
    current_price: float,
    strike: float,
    option_type: str,
) -> list[ChapterSignal]:
    signals = []
    for fn, args in [
        (chapter1_vrp_signal, (iv, hv_30, iv_rank)),
        (chapter2_term_structure_signal, (iv_rank, days_to_expiry, days_to_earnings)),
        (chapter3_skew_signal, (iv, hv_30, iv_rank, option_type, delta)),
        (chapter4_greeks_signal, (delta, gamma, theta, vega, market_price, days_to_expiry)),
        (chapter5_strategy_signal, (iv_rank, iv, hv_30, delta, days_to_expiry)),
        (chapter6_probability_signal, (current_price, strike, iv, days_to_expiry, delta, market_price, option_type)),
    ]:
        s = fn(*args)
        if s:
            signals.append(s)
    return signals


def compute_composite_score(signals: list[ChapterSignal]) -> float:
    if not signals:
        return 0.0
    return round(sum(s.score for s in signals) / len(signals), 1)
