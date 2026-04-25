from typing import Optional
from dataclasses import dataclass


@dataclass
class AdviceItem:
    level: str  # "warning", "info", "success"
    title: str
    body: str
    lesson_link: Optional[str] = None


def generate_advice(
    ticker: str,
    iv_rank: Optional[float],
    iv_percentile: Optional[float],
    current_iv: Optional[float],
    hv_30: Optional[float],
    days_to_expiry: int,
    theta: float,
    market_price: float,
    days_to_earnings: Optional[int],
    expected_move: Optional[float],
    current_price: float,
    delta: float,
    vega: float = 0.0,
    gamma: float = 0.0,
    option_type: str = "call",
    strike: float = 0.0,
) -> list[AdviceItem]:
    """
    Rule-based, transparent advice engine.
    Each rule has a clear condition and explains its reasoning.
    """
    advice = []

    # ── IV Rank advice ──────────────────────────────────────────────────────────
    if iv_rank is not None:
        if iv_rank > 70:
            advice.append(AdviceItem(
                level="warning",
                title=f"Ранг ИВ {iv_rank:.0f}/100 — Опционы дороги",
                body=(
                    f"Для {ticker} подразумеваемая волатильность находится в верхних "
                    f"{100 - iv_rank:.0f}% 52-недельного диапазона. Стратегии, которые "
                    f"ПРОДАЮТ волатильность, имеют структурное преимущество прямо сейчас: покрытые коллы, "
                    f"обеспеченные путы или кредитные спрэды. Покупка опционов здесь означает "
                    f"оплату выше среднего премии — вам нужно более крупное движение для получения прибыли."
                ),
                lesson_link="/academy/6",
            ))
        elif iv_rank < 30:
            advice.append(AdviceItem(
                level="success",
                title=f"Ранг ИВ {iv_rank:.0f}/100 — Опционы дёшевы",
                body=(
                    f"Для {ticker} опционы исторически недороги "
                    f"(Ранг ИВ {iv_rank:.0f} = нижний {iv_rank:.0f}-й перцентиль прошлого года). "
                    f"Стратегии покупки (длинные коллы, длинные путы, дебетовые спрэды) имеют "
                    f"структурное преимущество. Вы платите ниже среднего за опциональность."
                ),
                lesson_link="/academy/6",
            ))
        else:
            advice.append(AdviceItem(
                level="info",
                title=f"Ранг ИВ {iv_rank:.0f}/100 — Нейтральная среда волатильности",
                body=(
                    f"ИВ находится в среднем диапазоне для {ticker} — ни покупатели, ни продавцы "
                    f"не имеют чёткого структурного преимущества от волатильности. Сосредоточьтесь на "
                    f"вашем направленном тезисе и соотношении риска/доходности, а не на соображениях ИВ."
                ),
                lesson_link="/academy/6",
            ))

    # ── IV vs HV premium ────────────────────────────────────────────────────────
    if current_iv is not None and hv_30 is not None:
        iv_premium = current_iv - hv_30
        if iv_premium > 0.05:
            advice.append(AdviceItem(
                level="info",
                title=f"Премия ИВ: {iv_premium * 100:.1f}% выше исторической волатильности",
                body=(
                    f"Текущая ИВ ({current_iv * 100:.1f}%) на {iv_premium * 100:.1f}% выше "
                    f"30-дневной исторической волатильности ({hv_30 * 100:.1f}%). Продавцы опционов собирают "
                    f"премию сверх фактической реализованной волатильности — потенциальное преимущество для продавцов премии."
                ),
                lesson_link="/academy/6",
            ))
        elif iv_premium < -0.05:
            advice.append(AdviceItem(
                level="info",
                title=f"Скидка ИВ: {abs(iv_premium) * 100:.1f}% ниже исторической волатильности",
                body=(
                    f"ИВ ({current_iv * 100:.1f}%) ниже 30-дневной ИВ исторической ({hv_30 * 100:.1f}%). "
                    f"Опционы закладывают меньшую волатильность, чем происходила недавно — "
                    f"потенциальное преимущество для покупателей опционов."
                ),
                lesson_link="/academy/6",
            ))

    # ── Earnings warning ────────────────────────────────────────────────────────
    if days_to_earnings is not None and days_to_earnings <= 14 and days_to_earnings >= 0:
        em_text = f"±${expected_move:.2f}" if expected_move else "неизвестную сумму"
        advice.append(AdviceItem(
            level="warning",
            title=f"Отчётность через {days_to_earnings} дней — риск коллапса ИВ",
            body=(
                f"Отчётность приближается через {days_to_earnings} дней. ИВ обычно взлетает "
                f"перед отчётностью и обваливается на 40-60% после (коллапс ИВ). "
                f"Опционный рынок сейчас закладывает движение {em_text}. "
                f"При покупке опционов акция должна двигаться БОЛЬШЕ {em_text} для получения прибыли "
                f"с учётом коллапса ИВ."
            ),
            lesson_link="/academy/8",
        ))

    # ── Time decay warning ──────────────────────────────────────────────────────
    if market_price > 0 and theta != 0:
        theta_pct = abs(theta) / market_price
        if theta_pct > 0.015:
            advice.append(AdviceItem(
                level="warning",
                title=f"Высокий временной распад: потеря ${abs(theta):.2f}/день",
                body=(
                    f"Этот опцион теряет ${abs(theta):.2f} в день от временного распада "
                    f"({theta_pct * 100:.1f}% премии в день). При {days_to_expiry} днях "
                    f"до экспирации темп распада ускоряется — особенно в последние 30 дней. "
                    f"Вам нужно быстрое движение акции, чтобы компенсировать этот распад."
                ),
                lesson_link="/academy/5",
            ))
        elif theta_pct > 0.005:
            advice.append(AdviceItem(
                level="info",
                title=f"Временной распад: ${abs(theta):.2f}/день",
                body=(
                    f"Тета составляет ${abs(theta):.2f}/день ({theta_pct * 100:.1f}% премии). "
                    f"При {days_to_expiry} днях до экспирации время — фактор, требующий внимания."
                ),
                lesson_link="/academy/5",
            ))

    # ── Delta / moneyness context ────────────────────────────────────────────────
    abs_delta = abs(delta)
    if abs_delta > 0.7:
        advice.append(AdviceItem(
            level="info",
            title=f"Глубоко в деньгах (Дельта: {delta:.2f})",
            body=(
                f"При дельте {delta:.2f} этот опцион ведёт себя как {abs_delta * 100:.0f} "
                f"акций. У него высокая внутренняя стоимость, но меньше рычага. "
                f"Рассмотрите, не предпочтёте ли вы прямое владение акцией для этой экспозиции."
            ),
            lesson_link="/academy/4",
        ))
    elif abs_delta < 0.2:
        advice.append(AdviceItem(
            level="info",
            title=f"Далеко вне денег (Дельта: {delta:.2f})",
            body=(
                f"При дельте {delta:.2f} этот опцион имеет {abs_delta * 100:.0f}% "
                f"вероятность истечения в деньгах. Это преимущественно временная стоимость — "
                f"высокая доходность при низкой вероятности. Часто называется позицией «лотерейного билета»."
            ),
            lesson_link="/academy/4",
        ))

    # ── DTE context ─────────────────────────────────────────────────────────────
    if days_to_expiry <= 7:
        advice.append(AdviceItem(
            level="warning",
            title=f"Очень короткая экспирация: {days_to_expiry} дней осталось",
            body=(
                f"Опционы в последнюю неделю перед экспирацией испытывают наиболее быстрый тета-распад. "
                f"Гамма-риск также повышен — дельта позиции может быстро меняться при "
                f"небольших движениях акции. Высокорисковая территория с бинарным исходом."
            ),
            lesson_link="/academy/5",
        ))

    # ── Gamma risk (ATM + short DTE) ─────────────────────────────────────────
    if gamma > 0 and abs_delta >= 0.35 and abs_delta <= 0.65 and days_to_expiry <= 21:
        advice.append(AdviceItem(
            level="warning",
            title=f"Высокий гамма-риск: Дельта меняется быстро (Γ={gamma:.4f})",
            body=(
                f"Этот опцион около денег (дельта {delta:.2f}) с {days_to_expiry} дн. до экспирации — "
                f"зона максимальной гаммы. Гамма {gamma:.4f} означает, что при движении акции на $1 "
                f"дельта изменится примерно на {gamma:.4f}. Если акция быстро движется в нужную сторону — "
                f"вы выигрываете экспоненциально. В противном случае позиция быстро теряет стоимость. "
                f"Гамма — это ускорение дельты: ваш «педаль газа»."
            ),
            lesson_link="/academy/4",
        ))

    # ── Vega sensitivity ────────────────────────────────────────────────────
    if vega > 0:
        vega_iv_impact = vega * 5  # 5% IV change impact
        if vega > 0.15:
            advice.append(AdviceItem(
                level="info",
                title=f"Высокая чувствительность к волатильности: Вега={vega:.3f}",
                body=(
                    f"Вега {vega:.3f} означает: при изменении ИВ на 1% цена опциона меняется на ${vega:.3f}. "
                    f"При колебании ИВ на 5% позиция может изменить стоимость на ±${vega_iv_impact:.2f}. "
                    f"Это «опцион на волатильность» — ваша прибыль зависит не только от направления "
                    f"движения акции, но и от того, вырастет ли ИВ (выгодно покупателю) или упадёт "
                    f"(выгодно продавцу). Перед отчётностью ИВ обычно растёт — потенциально выгодно для покупателей."
                ),
                lesson_link="/academy/6",
            ))
        elif vega > 0.05:
            advice.append(AdviceItem(
                level="info",
                title=f"Вега={vega:.3f}: умеренная чувствительность к ИВ",
                body=(
                    f"Изменение ИВ на 1% → цена опциона меняется на ${vega:.3f}. "
                    f"При значимом сдвиге ИВ (±5%) позиция изменится на ±${vega_iv_impact:.2f}. "
                    f"Следите за уровнем ИВ относительно исторических значений."
                ),
                lesson_link="/academy/6",
            ))

    # ── Strategy recommendation based on IV environment ──────────────────────
    if iv_rank is not None:
        if iv_rank > 60:
            if option_type == "call":
                advice.append(AdviceItem(
                    level="info",
                    title="Альтернатива при высокой ИВ: Бычий колл-спрэд",
                    body=(
                        f"Вы покупаете колл при Ранге ИВ {iv_rank:.0f}/100 — опционы дороги. "
                        f"Рассмотрите бычий колл-спрэд (купить колл + продать более дорогой колл выше): "
                        f"короткий колл субсидирует до 30-50% стоимости длинного. "
                        f"Например, купить колл $X, продать колл $X+5 — снижаете стоимость, "
                        f"ограничиваете потенциал, но улучшаете Risk/Reward в среде высокой ИВ."
                    ),
                    lesson_link="/academy/11",
                ))
            elif option_type == "put":
                advice.append(AdviceItem(
                    level="info",
                    title="Альтернатива при высокой ИВ: Медвежий пут-спрэд",
                    body=(
                        f"Вы покупаете пут при Ранге ИВ {iv_rank:.0f}/100 — опционы дороги. "
                        f"Рассмотрите медвежий пут-спрэд (купить пут + продать более дешёвый пут ниже): "
                        f"короткий пут субсидирует часть стоимости длинного, снижая безубыточность. "
                        f"Это защищает от потерь за счёт коллапса ИВ после движения."
                    ),
                    lesson_link="/academy/11",
                ))
        elif iv_rank < 30:
            if option_type in ("call", "put"):
                long_name = "колл" if option_type == "call" else "пут"
                advice.append(AdviceItem(
                    level="success",
                    title=f"Оптимальная среда для покупки {long_name}а",
                    body=(
                        f"Ранг ИВ {iv_rank:.0f}/100 — исторически низкая волатильность. "
                        f"Длинный {long_name} — структурно выгодная позиция: вы покупаете «дешёвую» "
                        f"волатильность. Если ИВ вернётся к среднему — вы получаете дополнительный tailwind "
                        f"от роста веги. При стрэддле (низкая ИВ) вы делаете ставку на большое движение "
                        f"в любую сторону — также актуально при ожидании отчётности."
                    ),
                    lesson_link="/academy/7",
                ))

    # ── Breakeven move required ───────────────────────────────────────────────
    if current_price > 0 and market_price > 0 and strike > 0:
        if option_type == "call":
            breakeven = strike + market_price
            move_needed = breakeven - current_price
            move_pct = move_needed / current_price * 100
            direction = "вырасти"
        else:
            breakeven = strike - market_price
            move_needed = current_price - breakeven
            move_pct = move_needed / current_price * 100
            direction = "упасть"

        if move_pct > 0:
            if move_pct > 15:
                level = "warning"
                comment = "Это значительное движение — убедитесь, что ваш тезис обоснован."
            elif move_pct > 7:
                level = "info"
                comment = "Умеренное движение — оцените реалистичность сценария."
            else:
                level = "success"
                comment = "Небольшое движение для выхода в прибыль — относительно достижимо."

            advice.append(AdviceItem(
                level=level,
                title=f"Точка безубыточности: акция должна {direction} на {move_pct:.1f}% (${move_needed:.2f})",
                body=(
                    f"Вы заплатили ${market_price:.2f} премии. Точка безубыточности: ${breakeven:.2f}. "
                    f"При текущей цене ${current_price:.2f} акции нужно {direction} на ${move_needed:.2f} "
                    f"({move_pct:.1f}%) до экспирации ({days_to_expiry} дн.), чтобы вы вышли в ноль. "
                    f"{comment} "
                    f"Тета-распад каждый день повышает «порог» — чем дольше вы ждёте, тем большее "
                    f"движение нужно для безубыточности."
                ),
                lesson_link="/academy/3",
            ))

    # ── Assignment risk for deep ITM near expiry ─────────────────────────────
    if abs(delta) > 0.75 and days_to_expiry <= 14:
        if option_type == "call" and delta > 0:
            advice.append(AdviceItem(
                level="warning",
                title=f"Риск исполнения: глубоко в деньгах (Δ={delta:.2f}), {days_to_expiry} дн.",
                body=(
                    f"Глубоко ITM колл (дельта {delta:.2f}) вблизи экспирации имеет почти 100% "
                    f"внутренней стоимости и почти нулевую временную. Если вы держите длинный колл — "
                    f"рассмотрите исполнение или продажу позиции: временная стоимость практически "
                    f"исчезла, и дальнейший рост рычага минимален. "
                    f"Если вы держите короткий колл — риск досрочного исполнения высок."
                ),
                lesson_link="/academy/12",
            ))
        elif option_type == "put" and delta < 0:
            advice.append(AdviceItem(
                level="warning",
                title=f"Риск исполнения: глубоко в деньгах (Δ={delta:.2f}), {days_to_expiry} дн.",
                body=(
                    f"Глубоко ITM пут (дельта {delta:.2f}) вблизи экспирации — временная стоимость "
                    f"минимальна. Рычаг длинного пута снизился. Для короткого пута — высокий риск "
                    f"досрочного исполнения: держатель может потребовать продать акции по страйку. "
                    f"Оцените, стоит ли роллировать или закрывать позицию."
                ),
                lesson_link="/academy/12",
            ))

    # ── Risk/Reward context via probability ───────────────────────────────────
    if market_price > 0 and current_price > 0:
        itm_prob = abs(delta)
        if 0.05 < itm_prob < 0.95:
            otm_prob = 1 - itm_prob
            theoretical_rr = otm_prob / itm_prob if itm_prob > 0 else 0
            premium_pct = market_price / current_price * 100
            if itm_prob < 0.35 and theoretical_rr > 1.5:
                advice.append(AdviceItem(
                    level="info",
                    title=f"Соотношение риск/доходность: вероятность ITM ~{itm_prob*100:.0f}%",
                    body=(
                        f"Вы платите ${market_price:.2f} ({premium_pct:.1f}% от цены акции) за опцион "
                        f"с ~{itm_prob*100:.0f}% вероятностью истечения в деньгах. "
                        f"По теории вероятностей справедливое соотношение ≈ {theoretical_rr:.1f}:1 "
                        f"(риск на потенциальную прибыль). "
                        f"Это «лотерейный тип» позиции — редкие крупные выигрыши при частых небольших потерях. "
                        f"Чем ниже вероятность — тем выше должна быть потенциальная доходность при срабатывании."
                    ),
                    lesson_link="/academy/7",
                ))

    return advice
