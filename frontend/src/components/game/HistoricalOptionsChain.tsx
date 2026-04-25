import { useState } from 'react'
import clsx from 'clsx'
import { OptionContract } from '../../hooks/useGameSession'

interface HistoricalOptionsChainProps {
  calls: OptionContract[]
  puts: OptionContract[]
  expirations: string[]
  currentPrice: number
  onAddLeg: (contract: OptionContract, direction: 'long' | 'short') => void
}

function moneyness(strike: number, price: number): 'itm' | 'atm' | 'otm' {
  const pct = Math.abs(strike - price) / price
  if (pct < 0.015) return 'atm'
  return strike < price ? 'itm' : 'otm'
}

function moneynessLabel(m: 'itm' | 'atm' | 'otm', type: 'call' | 'put') {
  if (m === 'atm') return { label: 'ATM', tip: 'At the Money — страйк рядом с текущей ценой' }
  if (type === 'call') {
    return m === 'itm'
      ? { label: 'ITM', tip: 'In the Money — страйк ниже цены, колл имеет внутреннюю стоимость' }
      : { label: 'OTM', tip: 'Out of the Money — страйк выше цены, только временна́я стоимость' }
  } else {
    return m === 'itm'
      ? { label: 'ITM', tip: 'In the Money — страйк выше цены, пут имеет внутреннюю стоимость' }
      : { label: 'OTM', tip: 'Out of the Money — страйк ниже цены, только временна́я стоимость' }
  }
}

const GREEK_TIPS: Record<string, string> = {
  iv: 'Implied Volatility (Подразумеваемая волатильность) — ожидаемые колебания акции, заложенные в цену опциона. Высокая IV = дорогой опцион.',
  delta: 'Delta (Δ) — насколько изменится цена опциона при движении акции на $1. Δ=0.50 → при росте акции на $1 опцион подорожает на $0.50.',
  theta: 'Theta (Θ) — сколько стоимости теряет опцион каждый день (временно́й распад). Θ=−0.05 → опцион дешевеет на $0.05 в день при прочих равных.',
}

interface ContractInfoPanelProps {
  contract: OptionContract
  currentPrice: number
  tab: 'calls' | 'puts'
  onBuy: () => void
  onSell: () => void
}

function ContractInfoPanel({ contract, currentPrice, tab, onBuy, onSell }: ContractInfoPanelProps) {
  const type = tab === 'calls' ? 'call' : 'put'
  const mid = (contract.bid + contract.ask) / 2
  const buyBe = type === 'call' ? contract.strike + mid : contract.strike - mid
  const sellBe = type === 'call' ? contract.strike + mid : contract.strike - mid
  const m = moneyness(contract.strike, currentPrice)
  const { label: mLabel } = moneynessLabel(m, type)
  const distPct = ((contract.strike / currentPrice - 1) * 100).toFixed(1)

  return (
    <div className="mt-3 rounded-xl border border-blue-600/40 bg-blue-900/10 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold font-mono">${contract.strike} {type === 'call' ? 'Колл' : 'Пут'}</span>
          <span className={clsx(
            'text-xs px-2 py-0.5 rounded-full font-semibold',
            m === 'atm' ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/40' :
            m === 'itm' ? 'bg-blue-900/40 text-blue-400 border border-blue-700/40' :
            'bg-gray-800 text-gray-400 border border-gray-700'
          )}>
            {mLabel}
          </span>
          <span className="text-xs text-gray-400">{distPct}% от текущей ${currentPrice.toFixed(2)}</span>
        </div>
        <div className="font-mono text-gray-300 text-sm">
          Мид: <span className="text-white font-bold">${mid.toFixed(2)}</span>
          <span className="text-gray-500 text-xs ml-2">(bid ${contract.bid.toFixed(2)} / ask ${contract.ask.toFixed(2)})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* BUY explanation */}
        <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
          <div className="text-green-400 font-semibold text-sm mb-1.5">
            🟢 Если КУПИТЬ (Long {type === 'call' ? 'Call' : 'Put'})
          </div>
          <div className="text-xs text-gray-300 space-y-1 leading-relaxed">
            <p>Платите: <span className="text-white font-mono">${mid.toFixed(2)}/акцию = ${(mid * 100).toFixed(0)}/контракт</span></p>
            <p>Прибыль когда:
              {type === 'call'
                ? <span className="text-green-300"> цена &gt; <strong>${buyBe.toFixed(2)}</strong> (страйк + премия)</span>
                : <span className="text-green-300"> цена &lt; <strong>${buyBe.toFixed(2)}</strong> (страйк − премия)</span>
              }
            </p>
            <p>Макс. убыток: <span className="text-red-400">${(mid * 100).toFixed(0)}</span> (вся премия если истечёт OTM)</p>
            <p className="text-blue-300 mt-1">
              {type === 'call'
                ? `Ставка на рост выше $${buyBe.toFixed(2)}`
                : `Ставка на падение ниже $${buyBe.toFixed(2)}`}
            </p>
          </div>
          <button onClick={onBuy}
            className="mt-2 w-full py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors">
            Купить по мид ${mid.toFixed(2)}
          </button>
        </div>

        {/* SELL explanation */}
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
          <div className="text-red-400 font-semibold text-sm mb-1.5">
            🔴 Если ПРОДАТЬ (Short {type === 'call' ? 'Call' : 'Put'})
          </div>
          <div className="text-xs text-gray-300 space-y-1 leading-relaxed">
            <p>Получаете: <span className="text-white font-mono">${mid.toFixed(2)}/акцию = ${(mid * 100).toFixed(0)}/контракт</span></p>
            <p>Прибыль когда:
              {type === 'call'
                ? <span className="text-green-300"> цена &lt; <strong>${sellBe.toFixed(2)}</strong></span>
                : <span className="text-green-300"> цена &gt; <strong>${sellBe.toFixed(2)}</strong></span>
              }
            </p>
            <p>Макс. прибыль: <span className="text-green-400">${(mid * 100).toFixed(0)}</span> (полная премия)</p>
            <p>Макс. убыток: <span className="text-red-400">
              {type === 'call' ? 'Неограничен (рост)' : `До $${(contract.strike * 100).toFixed(0)} при падении до $0`}
            </span></p>
            <p className="text-blue-300 mt-1">
              {type === 'call'
                ? `Ставка на боковик/падение ниже $${sellBe.toFixed(2)}`
                : `Ставка на боковик/рост выше $${sellBe.toFixed(2)}`}
            </p>
          </div>
          <button onClick={onSell}
            className="mt-2 w-full py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors">
            Продать по мид ${mid.toFixed(2)}
          </button>
        </div>
      </div>

      {/* Greeks mini-explanation */}
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div className="bg-gray-800/60 rounded-lg p-2">
          <div className="text-yellow-400 font-mono font-bold">{(contract.iv * 100).toFixed(1)}%</div>
          <div className="text-gray-400 mt-0.5">IV</div>
          <div className="text-gray-500 text-xs mt-0.5">
            {contract.iv > 0.4 ? 'Высокая — дорогой' : contract.iv < 0.2 ? 'Низкая — дёшевый' : 'Средняя'}
          </div>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-2">
          <div className="text-blue-300 font-mono font-bold">{contract.delta.toFixed(2)}</div>
          <div className="text-gray-400 mt-0.5">Δ Delta</div>
          <div className="text-gray-500 text-xs mt-0.5">+$1 в акции → +${contract.delta.toFixed(2)} в опц.</div>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-2">
          <div className="text-red-400 font-mono font-bold">{contract.theta.toFixed(3)}</div>
          <div className="text-gray-400 mt-0.5">Θ Theta</div>
          <div className="text-gray-500 text-xs mt-0.5">${Math.abs(contract.theta).toFixed(2)}/день распад</div>
        </div>
      </div>
    </div>
  )
}

function TooltipHeader({ label, tip }: { label: string; tip: string }) {
  return (
    <th className="text-right py-2 px-3">
      <span className="group relative inline-flex items-center gap-1 cursor-help">
        {label}
        <span className="text-gray-600 text-xs">ⓘ</span>
        <span className="absolute bottom-full right-0 mb-1 w-64 hidden group-hover:block bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 font-normal z-50 shadow-xl leading-relaxed text-left whitespace-normal">
          {tip}
        </span>
      </span>
    </th>
  )
}

export function HistoricalOptionsChain({
  calls,
  puts,
  expirations,
  currentPrice,
  onAddLeg,
}: HistoricalOptionsChainProps) {
  const [tab, setTab] = useState<'calls' | 'puts'>('calls')
  const [expiry, setExpiry] = useState<string>(expirations[2] ?? expirations[0] ?? '')
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null)

  const contracts = (tab === 'calls' ? calls : puts).filter(c => c.expiry === expiry)
  const sorted = [...contracts].sort((a, b) => a.strike - b.strike)
  const selectedContract = sorted.find(c => c.strike === selectedStrike) ?? null

  const handleRowClick = (strike: number) => {
    setSelectedStrike(prev => prev === strike ? null : strike)
  }

  const handleBuy = (contract: OptionContract) => {
    onAddLeg(contract, 'long')
    setSelectedStrike(null)
  }

  const handleSell = (contract: OptionContract) => {
    onAddLeg(contract, 'short')
    setSelectedStrike(null)
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
        Цепочка опционов
      </div>

      {/* Expiry selector */}
      <div className="flex flex-wrap gap-2">
        {expirations.map(exp => (
          <button
            key={exp}
            onClick={() => { setExpiry(exp); setSelectedStrike(null) }}
            className={clsx(
              'px-2 py-1 text-xs font-mono rounded-md transition-colors',
              expiry === exp
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            )}
          >
            {exp}
          </button>
        ))}
      </div>

      {/* Calls / Puts tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
        {(['calls', 'puts'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedStrike(null) }}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t
                ? t === 'calls'
                  ? 'bg-blue-600 text-white'
                  : 'bg-orange-600 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            {t === 'calls' ? 'Коллы' : 'Путы'}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500">
        Нажмите на строку, чтобы увидеть детали и объяснение контракта
      </div>

      <div className="overflow-auto max-h-[360px] rounded-xl border border-gray-800">
        <table className="w-full min-w-[480px]">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="text-xs text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 px-3">Страйк</th>
              <th className="text-right py-2 px-3">Бид</th>
              <th className="text-right py-2 px-3">Аск</th>
              <TooltipHeader label="ИВ" tip={GREEK_TIPS.iv} />
              <TooltipHeader label="Δ" tip={GREEK_TIPS.delta} />
              <TooltipHeader label="Θ" tip={GREEK_TIPS.theta} />
              <th className="py-2 px-3">Действие</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(contract => {
              const m = moneyness(contract.strike, currentPrice)
              const rowId = `${contract.expiry}-${contract.strike}-${contract.option_type}`
              const isSelected = selectedStrike === contract.strike
              return (
                <tr
                  key={rowId}
                  onClick={() => handleRowClick(contract.strike)}
                  className={clsx(
                    'border-b border-gray-800 text-sm cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-blue-900/25 border-blue-700/50'
                      : m === 'itm'
                      ? 'bg-blue-900/10 hover:bg-blue-900/20'
                      : m === 'atm'
                      ? 'bg-yellow-900/10 hover:bg-yellow-900/20'
                      : 'hover:bg-gray-800/60'
                  )}
                >
                  <td className="py-2 px-3 font-mono font-bold">
                    <span
                      className={clsx(
                        m === 'itm' && 'text-blue-400',
                        m === 'atm' && 'text-yellow-400',
                        m === 'otm' && 'text-gray-300'
                      )}
                    >
                      ${contract.strike}
                    </span>
                    {m === 'atm' && (
                      <span className="ml-1 text-xs text-yellow-500">ATM</span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-mono text-right">${contract.bid.toFixed(2)}</td>
                  <td className="py-2 px-3 font-mono text-right">${contract.ask.toFixed(2)}</td>
                  <td className="py-2 px-3 font-mono text-right text-yellow-400">
                    {(contract.iv * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 font-mono text-right text-blue-300">
                    {contract.delta.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 font-mono text-right text-red-400">
                    {contract.theta.toFixed(3)}
                  </td>
                  <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleBuy(contract)}
                        className="px-2 py-0.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
                      >
                        Купить
                      </button>
                      <button
                        onClick={() => handleSell(contract)}
                        className="px-2 py-0.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition-colors"
                      >
                        Продать
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Contract detail panel */}
      {selectedContract && (
        <ContractInfoPanel
          contract={selectedContract}
          currentPrice={currentPrice}
          tab={tab}
          onBuy={() => handleBuy(selectedContract)}
          onSell={() => handleSell(selectedContract)}
        />
      )}
    </div>
  )
}
