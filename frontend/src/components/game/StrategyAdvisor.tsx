import { GameLeg } from '../../hooks/useGameSession'

interface StrategyInfo {
  name: string
  emoji: string
  what: string
  profit_when: string
  breakevens: number[]
  max_profit: string
  max_loss: string
  good_when: string
  risk_level: 'low' | 'medium' | 'high'
}

function identifyStrategy(legs: GameLeg[]): StrategyInfo | null {
  if (legs.length === 0) return null

  const lc = legs.filter(l => l.direction === 'long' && l.option_type === 'call')
  const sc = legs.filter(l => l.direction === 'short' && l.option_type === 'call')
  const lp = legs.filter(l => l.direction === 'long' && l.option_type === 'put')
  const sp = legs.filter(l => l.direction === 'short' && l.option_type === 'put')

  // ── Single leg ──────────────────────────────────────────────────────────────
  if (legs.length === 1) {
    const leg = legs[0]
    const prem = leg.entry_premium
    const strike = leg.strike
    const qty = leg.contracts

    if (leg.direction === 'long' && leg.option_type === 'call') {
      const be = strike + prem
      return {
        name: 'Long Call', emoji: '📈',
        what: `Вы купили право КУПИТЬ акцию по $${strike}. Заплатили $${prem.toFixed(2)}/акцию = $${(prem * 100 * qty).toFixed(0)} за ${qty} контракт(а).`,
        profit_when: `Цена поднимется ВЫШЕ $${be.toFixed(2)} (страйк $${strike} + премия $${prem.toFixed(2)})`,
        breakevens: [be],
        max_profit: 'Неограничен — чем выше цена, тем больше прибыль',
        max_loss: `$${(prem * 100 * qty).toFixed(0)} (вся премия) — если цена ниже $${strike} на экспирацию`,
        good_when: 'Ждёте сильный рост. IV невысокая — опционы не переоценены.',
        risk_level: 'low',
      }
    }
    if (leg.direction === 'long' && leg.option_type === 'put') {
      const be = strike - prem
      return {
        name: 'Long Put', emoji: '📉',
        what: `Вы купили право ПРОДАТЬ акцию по $${strike}. Заплатили $${prem.toFixed(2)}/акцию = $${(prem * 100 * qty).toFixed(0)} за ${qty} контракт(а).`,
        profit_when: `Цена упадёт НИЖЕ $${be.toFixed(2)} (страйк $${strike} − премия $${prem.toFixed(2)})`,
        breakevens: [be],
        max_profit: `До $${(be * 100 * qty).toFixed(0)} (если акция упадёт до $0)`,
        max_loss: `$${(prem * 100 * qty).toFixed(0)} (вся премия) — если цена выше $${strike} на экспирацию`,
        good_when: 'Ждёте падение или хеджируете портфель. IV невысокая.',
        risk_level: 'low',
      }
    }
    if (leg.direction === 'short' && leg.option_type === 'call') {
      const be = strike + prem
      return {
        name: 'Short Call', emoji: '⚠️',
        what: `Вы ПРОДАЛИ право купить акцию по $${strike}. Получили $${prem.toFixed(2)}/акцию = $${(prem * 100 * qty).toFixed(0)} кредит.`,
        profit_when: `Цена останется НИЖЕ $${be.toFixed(2)} к экспирации — премия ваша`,
        breakevens: [be],
        max_profit: `$${(prem * 100 * qty).toFixed(0)} — полная премия при цене ≤ $${strike}`,
        max_loss: 'Неограничен! Акция может расти бесконечно (без покрытия — очень рискованно)',
        good_when: 'Боковик или падение. IV высокая — продаёте дорого. Лучше использовать как покрытый колл.',
        risk_level: 'high',
      }
    }
    if (leg.direction === 'short' && leg.option_type === 'put') {
      const be = strike - prem
      return {
        name: 'Short Put', emoji: '💰',
        what: `Вы ПРОДАЛИ право продать акцию по $${strike}. Получили $${prem.toFixed(2)}/акцию = $${(prem * 100 * qty).toFixed(0)} кредит.`,
        profit_when: `Цена останется ВЫШЕ $${be.toFixed(2)} к экспирации`,
        breakevens: [be],
        max_profit: `$${(prem * 100 * qty).toFixed(0)} — полная премия при цене ≥ $${strike}`,
        max_loss: `До $${(be * 100 * qty).toFixed(0)} если акция → $0. Обязуетесь купить акцию по $${strike}.`,
        good_when: 'Рост или боковик. Готовы купить акции по $' + strike + '. IV высокая.',
        risk_level: 'medium',
      }
    }
  }

  // ── Two-leg spreads ─────────────────────────────────────────────────────────
  if (lc.length === 1 && sc.length === 1 && lp.length === 0 && sp.length === 0) {
    const long = lc[0]; const short = sc[0]
    const qty = long.contracts
    if (long.strike < short.strike) {
      // Bull Call Spread
      const net = long.entry_premium - short.entry_premium
      const be = long.strike + net
      const maxP = (short.strike - long.strike - net) * 100 * qty
      return {
        name: 'Bull Call Spread', emoji: '🐂',
        what: `Покупаете колл $${long.strike} (право купить), продаёте колл $${short.strike} (ограничиваете прибыль). Чистая стоимость: $${net.toFixed(2)}/акцию = $${(net * 100 * qty).toFixed(0)}.`,
        profit_when: `Цена поднимется выше $${be.toFixed(2)}. Максимум при цене ≥ $${short.strike}`,
        breakevens: [be],
        max_profit: `$${maxP.toFixed(0)} (при цене ≥ $${short.strike})`,
        max_loss: `$${(net * 100 * qty).toFixed(0)} — если цена ≤ $${long.strike}`,
        good_when: 'Умеренный рост. Дешевле Long Call — верхний страйк снижает затраты, но ограничивает прибыль.',
        risk_level: 'low',
      }
    } else {
      // Bear Call Spread
      const credit = short.entry_premium - long.entry_premium
      const be = short.strike + credit
      const maxL = (long.strike - short.strike - credit) * 100 * qty
      return {
        name: 'Bear Call Spread', emoji: '🐻',
        what: `Продаёте колл $${short.strike}, покупаете колл $${long.strike} для защиты. Получаете: $${credit.toFixed(2)}/акцию = $${(credit * 100 * qty).toFixed(0)} кредит.`,
        profit_when: `Цена останется НИЖЕ $${be.toFixed(2)} к экспирации`,
        breakevens: [be],
        max_profit: `$${(credit * 100 * qty).toFixed(0)} (при цене ≤ $${short.strike})`,
        max_loss: `$${maxL.toFixed(0)} (при цене ≥ $${long.strike})`,
        good_when: 'Умеренное снижение или боковик. Ограниченный риск благодаря покупному коллу.',
        risk_level: 'low',
      }
    }
  }

  if (lp.length === 1 && sp.length === 1 && lc.length === 0 && sc.length === 0) {
    const long = lp[0]; const short = sp[0]
    const qty = long.contracts
    if (short.strike > long.strike) {
      // Bull Put Spread (sell high put, buy low put)
      const credit = short.entry_premium - long.entry_premium
      const be = short.strike - credit
      const maxL = (short.strike - long.strike - credit) * 100 * qty
      return {
        name: 'Bull Put Spread', emoji: '🐂',
        what: `Продаёте пут $${short.strike}, покупаете пут $${long.strike} для защиты. Получаете: $${credit.toFixed(2)}/акцию = $${(credit * 100 * qty).toFixed(0)} кредит.`,
        profit_when: `Цена останется ВЫШЕ $${be.toFixed(2)} к экспирации`,
        breakevens: [be],
        max_profit: `$${(credit * 100 * qty).toFixed(0)} (при цене ≥ $${short.strike})`,
        max_loss: `$${maxL.toFixed(0)} (при цене ≤ $${long.strike})`,
        good_when: 'Умеренный рост или боковик. Кредитная стратегия — деньги получаете сразу.',
        risk_level: 'low',
      }
    } else {
      // Bear Put Spread
      const net = long.entry_premium - short.entry_premium
      const be = long.strike - net
      const maxP = (long.strike - short.strike - net) * 100 * qty
      return {
        name: 'Bear Put Spread', emoji: '🐻',
        what: `Покупаете пут $${long.strike}, продаёте пут $${short.strike} для снижения стоимости. Чистый дебет: $${net.toFixed(2)}/акцию = $${(net * 100 * qty).toFixed(0)}.`,
        profit_when: `Цена упадёт ниже $${be.toFixed(2)}. Максимум при цене ≤ $${short.strike}`,
        breakevens: [be],
        max_profit: `$${maxP.toFixed(0)} (при цене ≤ $${short.strike})`,
        max_loss: `$${(net * 100 * qty).toFixed(0)} — если цена ≥ $${long.strike}`,
        good_when: 'Умеренное снижение. Дешевле Long Put — нижний страйк снижает затраты.',
        risk_level: 'low',
      }
    }
  }

  // ── Straddle / Strangle ─────────────────────────────────────────────────────
  if (lc.length === 1 && lp.length === 1 && sc.length === 0 && sp.length === 0) {
    const call = lc[0]; const put = lp[0]
    const total = call.entry_premium + put.entry_premium
    const qty = call.contracts
    if (Math.abs(call.strike - put.strike) < 0.5) {
      return {
        name: 'Long Straddle', emoji: '🎯',
        what: `Покупаете колл и пут на одном страйке $${call.strike}. Суммарная стоимость: $${total.toFixed(2)}/акцию = $${(total * 100 * qty).toFixed(0)}.`,
        profit_when: `Цена сильно движется В ЛЮБУЮ сторону — выше $${(call.strike + total).toFixed(2)} или ниже $${(put.strike - total).toFixed(2)}`,
        breakevens: [put.strike - total, call.strike + total],
        max_profit: 'Неограничен (вверх) или до $0 цены (вниз)',
        max_loss: `$${(total * 100 * qty).toFixed(0)} — если цена = $${call.strike} точно на экспирации`,
        good_when: 'Ждёте крупное движение (отчёт, новость), но не знаете направление. Покупайте при низкой IV.',
        risk_level: 'medium',
      }
    } else {
      return {
        name: 'Long Strangle', emoji: '🌊',
        what: `Покупаете колл $${call.strike} и пут $${put.strike}. Суммарная стоимость: $${total.toFixed(2)}/акцию = $${(total * 100 * qty).toFixed(0)}.`,
        profit_when: `Цена сильно движется — выше $${(call.strike + total).toFixed(2)} или ниже $${(put.strike - total).toFixed(2)}`,
        breakevens: [put.strike - total, call.strike + total],
        max_profit: 'Неограничен вверх; существенный вниз',
        max_loss: `$${(total * 100 * qty).toFixed(0)} — если цена между страйками`,
        good_when: 'Ждёте крупное движение. Дешевле страддла, но нужно бо́льшее движение для прибыли.',
        risk_level: 'medium',
      }
    }
  }

  if (sc.length === 1 && sp.length === 1 && lc.length === 0 && lp.length === 0) {
    const call = sc[0]; const put = sp[0]
    const total = call.entry_premium + put.entry_premium
    const qty = call.contracts
    if (Math.abs(call.strike - put.strike) < 0.5) {
      return {
        name: 'Short Straddle', emoji: '⚠️',
        what: `Продаёте колл и пут на страйке $${call.strike}. Получаете: $${total.toFixed(2)}/акцию = $${(total * 100 * qty).toFixed(0)} кредит.`,
        profit_when: `Цена останется вблизи $${call.strike} — между $${(put.strike - total).toFixed(2)} и $${(call.strike + total).toFixed(2)}`,
        breakevens: [put.strike - total, call.strike + total],
        max_profit: `$${(total * 100 * qty).toFixed(0)} — если цена = $${call.strike} на экспирацию`,
        max_loss: 'Неограничен вверх и очень большой вниз — ВЫСОКИЙ РИСК',
        good_when: 'Боковик + высокая IV. Опасная стратегия — требует активного управления.',
        risk_level: 'high',
      }
    } else {
      return {
        name: 'Short Strangle', emoji: '⚠️',
        what: `Продаёте колл $${call.strike} и пут $${put.strike}. Получаете: $${total.toFixed(2)}/акцию = $${(total * 100 * qty).toFixed(0)} кредит.`,
        profit_when: `Цена останется между $${(put.strike - total).toFixed(2)} и $${(call.strike + total).toFixed(2)}`,
        breakevens: [put.strike - total, call.strike + total],
        max_profit: `$${(total * 100 * qty).toFixed(0)} — если цена между страйками`,
        max_loss: 'Неограничен вверх — ВЫСОКИЙ РИСК',
        good_when: 'Боковик + очень высокая IV. Широкий диапазон, но неограниченный риск.',
        risk_level: 'high',
      }
    }
  }

  // Generic fallback
  return {
    name: `Комбинация (${legs.length} ног)`, emoji: '🔀',
    what: 'Многоногая стратегия. Суммарный результат = сумма П/У по всем ногам.',
    profit_when: 'Зависит от комбинации — смотрите дельту позиции',
    breakevens: [],
    max_profit: 'Зависит от структуры',
    max_loss: 'Зависит от структуры',
    good_when: 'Определите цель: хеджирование, нейтральная позиция, направленная ставка.',
    risk_level: 'medium',
  }
}

interface Props {
  legs: GameLeg[]
  currentPrice: number
}

const riskColors = {
  low: 'text-green-400 bg-green-900/20 border-green-700/40',
  medium: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/40',
  high: 'text-red-400 bg-red-900/20 border-red-700/40',
}
const riskLabel = { low: 'Низкий риск', medium: 'Средний риск', high: 'Высокий риск' }

export function StrategyAdvisor({ legs, currentPrice }: Props) {
  const info = identifyStrategy(legs)
  if (!info) return null

  return (
    <div className="rounded-xl border border-blue-700/30 bg-blue-900/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{info.emoji}</span>
          <span className="text-white font-bold text-base">{info.name}</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${riskColors[info.risk_level]}`}>
          {riskLabel[info.risk_level]}
        </span>
      </div>

      <p className="text-gray-300 text-sm leading-relaxed">{info.what}</p>

      <div className="grid grid-cols-1 gap-2 text-sm">
        <div className="bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2">
          <div className="text-xs text-gray-400 mb-0.5">✅ Прибыль когда:</div>
          <div className="text-green-300 font-medium">{info.profit_when}</div>
        </div>

        {info.breakevens.length > 0 && (
          <div className="bg-gray-800/60 rounded-lg px-3 py-2">
            <div className="text-xs text-gray-400 mb-1">Точка(и) безубыточности:</div>
            <div className="flex gap-3 flex-wrap">
              {info.breakevens.map((be, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-white font-mono font-bold">${be.toFixed(2)}</span>
                  <span className="text-xs text-gray-500">
                    ({be > currentPrice ? `+${((be / currentPrice - 1) * 100).toFixed(1)}%` : `${((be / currentPrice - 1) * 100).toFixed(1)}%`} от текущей)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800/60 rounded-lg px-3 py-2">
            <div className="text-xs text-gray-400 mb-0.5">Макс. прибыль:</div>
            <div className="text-green-400 text-xs font-medium">{info.max_profit}</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg px-3 py-2">
            <div className="text-xs text-gray-400 mb-0.5">Макс. убыток:</div>
            <div className="text-red-400 text-xs font-medium">{info.max_loss}</div>
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-700/20 rounded-lg px-3 py-2">
          <div className="text-xs text-gray-400 mb-0.5">💡 Подходит когда:</div>
          <div className="text-blue-300 text-xs">{info.good_when}</div>
        </div>
      </div>
    </div>
  )
}
