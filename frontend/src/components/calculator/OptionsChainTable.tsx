import { useState } from 'react'
import { OptionContract } from '../../api/client'
import clsx from 'clsx'

interface OptionsChainTableProps {
  calls: OptionContract[]
  puts: OptionContract[]
  currentPrice: number
  expirations: string[]
  onSelectOption: (option: OptionContract) => void
  selectedOption: OptionContract | null
}

type TabType = 'calls' | 'puts'

function moneyness(strike: number, currentPrice: number): 'itm' | 'atm' | 'otm' {
  const pct = Math.abs(strike - currentPrice) / currentPrice
  if (pct < 0.01) return 'atm'
  return strike < currentPrice ? 'itm' : 'otm'
}

function Row({
  option,
  currentPrice,
  isSelected,
  onClick,
}: {
  option: OptionContract
  currentPrice: number
  isSelected: boolean
  onClick: () => void
}) {
  const m = moneyness(option.strike, currentPrice)
  const rowClass = clsx(
    'cursor-pointer transition-colors text-sm border-b border-gray-800',
    isSelected && 'bg-blue-900/40',
    !isSelected && m === 'itm' && 'bg-blue-900/10 hover:bg-blue-900/20',
    !isSelected && m === 'atm' && 'bg-yellow-900/10 hover:bg-yellow-900/20',
    !isSelected && m === 'otm' && 'hover:bg-gray-800/50',
  )

  return (
    <tr className={rowClass} onClick={onClick}>
      <td className="py-2 px-3 font-mono font-bold">
        <span className={clsx(
          m === 'itm' && 'text-blue-400',
          m === 'atm' && 'text-yellow-400',
          m === 'otm' && 'text-gray-300',
        )}>
          ${option.strike}
        </span>
        {m === 'atm' && <span className="ml-1 text-xs text-yellow-500">ATM</span>}
        {m === 'itm' && option.option_type === 'call' && <span className="ml-1 text-xs text-blue-500">ITM</span>}
      </td>
      <td className="py-2 px-3 font-mono text-right">${option.bid.toFixed(2)}</td>
      <td className="py-2 px-3 font-mono text-right">${option.ask.toFixed(2)}</td>
      <td className="py-2 px-3 font-mono text-right text-yellow-400">
        {option.iv ? `${(option.iv * 100).toFixed(1)}%` : '—'}
      </td>
      <td className="py-2 px-3 font-mono text-right text-blue-300">
        {option.delta ? option.delta.toFixed(3) : '—'}
      </td>
      <td className="py-2 px-3 text-right text-gray-400">
        {option.volume > 0 ? option.volume.toLocaleString() : '—'}
      </td>
      <td className="py-2 px-3 text-right text-gray-500">
        {option.open_interest > 0 ? option.open_interest.toLocaleString() : '—'}
      </td>
    </tr>
  )
}

export function OptionsChainTable({
  calls,
  puts,
  currentPrice,
  expirations,
  onSelectOption,
  selectedOption,
}: OptionsChainTableProps) {
  const [tab, setTab] = useState<TabType>('calls')
  const [selectedExpiry, setSelectedExpiry] = useState<string>(expirations[0] || '')

  const filtered = (tab === 'calls' ? calls : puts).filter(
    (o) => !selectedExpiry || o.expiry === selectedExpiry
  )

  // Sort by strike
  const sorted = [...filtered].sort((a, b) => a.strike - b.strike)

  return (
    <div className="space-y-3">
      {/* Expiry selector */}
      <div className="flex gap-2 flex-wrap">
        {expirations.slice(0, 8).map((exp) => (
          <button
            key={exp}
            onClick={() => setSelectedExpiry(exp)}
            className={clsx(
              'px-2 py-1 text-xs rounded-md font-mono transition-colors',
              selectedExpiry === exp
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            )}
          >
            {exp}
          </button>
        ))}
      </div>

      {/* Calls/Puts tab */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('calls')}
          className={clsx(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'calls' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          )}
        >
          Коллы
        </button>
        <button
          onClick={() => setTab('puts')}
          className={clsx(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'puts' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
          )}
        >
          Путы
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-900/40 inline-block" /> ВДК</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-900/40 inline-block" /> УДК</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-800 inline-block" /> ВДН</span>
      </div>

      <div className="overflow-auto max-h-[420px] rounded-xl border border-gray-800">
        <table className="w-full min-w-[520px]">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="text-xs text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 px-3">Страйк</th>
              <th className="text-right py-2 px-3">Бид</th>
              <th className="text-right py-2 px-3">Аск</th>
              <th className="text-right py-2 px-3">ИВ</th>
              <th className="text-right py-2 px-3">Дельта</th>
              <th className="text-right py-2 px-3">Объём</th>
              <th className="text-right py-2 px-3">ОИ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">Нет данных по опционам</td>
              </tr>
            ) : (
              sorted.map((opt) => (
                <Row
                  key={`${opt.expiry}-${opt.strike}-${opt.option_type}`}
                  option={opt}
                  currentPrice={currentPrice}
                  isSelected={
                    selectedOption?.strike === opt.strike &&
                    selectedOption?.expiry === opt.expiry &&
                    selectedOption?.option_type === opt.option_type
                  }
                  onClick={() => onSelectOption(opt)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
