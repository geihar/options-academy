import clsx from 'clsx'
import { GameLeg } from '../../hooks/useGameSession'
import { blackScholes } from '../../lib/blackScholes'
import { StrategyAdvisor } from './StrategyAdvisor'

interface TradeLegBuilderProps {
  legs: GameLeg[]
  currentPrice: number
  onRemove: (index: number) => void
  onUpdate: (index: number, updates: Partial<GameLeg>) => void
  forwardDays: 7 | 14 | 30
  onForwardDaysChange: (days: 7 | 14 | 30) => void
}

export function TradeLegBuilder({
  legs, currentPrice, onRemove, onUpdate, forwardDays, onForwardDaysChange,
}: TradeLegBuilderProps) {
  const netDebitCredit = legs.reduce((sum, leg) => {
    const sign = leg.direction === 'long' ? -1 : 1
    return sum + sign * leg.entry_premium * 100 * leg.contracts
  }, 0)

  const maxRisk = Math.abs(
    legs.filter(l => l.direction === 'long')
      .reduce((sum, l) => sum + l.entry_premium * 100 * l.contracts, 0)
  )

  const totalGreeks = legs.reduce((acc, leg) => {
    const T = Math.max(forwardDays / 365, 7 / 365)
    const sign = leg.direction === 'long' ? 1 : -1
    const res = blackScholes({ S: currentPrice, K: leg.strike, T, r: 0.05, sigma: 0.30, optionType: leg.option_type })
    if (res) {
      acc.delta += sign * res.delta * leg.contracts * 100
      acc.theta += sign * res.theta * leg.contracts * 100
      acc.vega  += sign * res.vega  * leg.contracts * 100
    }
    return acc
  }, { delta: 0, theta: 0, vega: 0 })

  if (legs.length === 0) {
    return (
      <div className="card text-center py-8 text-gray-500">
        <div className="text-3xl mb-2">📋</div>
        <div className="text-sm">Добавьте ноги из цепочки опционов</div>
        <div className="text-xs text-gray-600 mt-1">Нажмите «Купить» или «Продать» на строке</div>
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="text-sm font-semibold text-gray-300">Ваша позиция</div>

      <div className="space-y-2">
        {legs.map((leg, i) => (
          <div
            key={i}
            className={clsx(
              'flex items-center gap-3 p-3 rounded-xl border text-sm',
              leg.direction === 'long'
                ? 'bg-green-900/10 border-green-800/30'
                : 'bg-red-900/10 border-red-800/30',
            )}
          >
            <div className="flex-1 min-w-0">
              <span className={clsx('font-semibold', leg.direction === 'long' ? 'text-green-400' : 'text-red-400')}>
                {leg.direction === 'long' ? 'Покупка' : 'Продажа'}
              </span>
              <span className="text-white ml-2 font-mono text-xs">
                ${leg.strike} {leg.option_type === 'call' ? 'Колл' : 'Пут'} {leg.expiry}
              </span>
              <span className="text-gray-500 ml-2 text-xs">
                @ ${leg.entry_premium.toFixed(2)} × {leg.contracts} = ${(leg.entry_premium * 100 * leg.contracts).toFixed(0)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => onUpdate(i, { contracts: Math.max(1, leg.contracts - 1) })}
                className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs">-</button>
              <span className="text-white font-mono w-4 text-center text-sm">{leg.contracts}</span>
              <button onClick={() => onUpdate(i, { contracts: Math.min(10, leg.contracts + 1) })}
                className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs">+</button>
              <button onClick={() => onRemove(i)} className="text-gray-500 hover:text-red-400 ml-1 text-xl leading-none">×</button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="card bg-gray-800 text-center">
          <div className="text-xs text-gray-400">Дебет / кредит</div>
          <div className={clsx('font-mono font-bold text-lg', netDebitCredit >= 0 ? 'text-green-400' : 'text-red-400')}>
            {netDebitCredit >= 0 ? '+' : ''}${netDebitCredit.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">{netDebitCredit >= 0 ? 'получен кредит' : 'уплачен дебет'}</div>
        </div>
        <div className="card bg-gray-800 text-center">
          <div className="text-xs text-gray-400">Макс. риск (дебет)</div>
          <div className="font-mono font-bold text-lg text-orange-400">${maxRisk.toFixed(0)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-gray-400">Дельта</div>
          <div className="font-mono text-blue-300">{totalGreeks.delta.toFixed(1)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-gray-400">Тета/день</div>
          <div className={clsx('font-mono', totalGreeks.theta >= 0 ? 'text-green-400' : 'text-red-400')}>
            ${totalGreeks.theta.toFixed(2)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-gray-400">Вега</div>
          <div className="font-mono text-yellow-400">${totalGreeks.vega.toFixed(2)}</div>
        </div>
      </div>

      <StrategyAdvisor legs={legs} currentPrice={currentPrice} />

      <div>
        <div className="text-xs text-gray-400 mb-2">Через сколько дней узнать результат?</div>
        <div className="flex gap-2">
          {([7, 14, 30] as const).map(d => (
            <button
              key={d}
              onClick={() => onForwardDaysChange(d)}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                forwardDays === d ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
              )}
            >
              {d} дней
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
