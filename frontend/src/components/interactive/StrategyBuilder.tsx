import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface Leg {
  id: string
  optionType: 'call' | 'put'
  strike: number
  premium: number
  direction: 'long' | 'short'
  contracts: number
}

interface StrategyBuilderProps {
  currentPrice?: number
}

function computeLegPayoff(leg: Leg, stockPrice: number): number {
  let intrinsic = 0
  if (leg.optionType === 'call') {
    intrinsic = Math.max(0, stockPrice - leg.strike)
  } else {
    intrinsic = Math.max(0, leg.strike - stockPrice)
  }
  const profitPerShare = leg.direction === 'long'
    ? intrinsic - leg.premium
    : leg.premium - intrinsic
  return profitPerShare * 100 * leg.contracts
}

const STRATEGY_LABELS: Record<string, string> = {
  'Long Call': 'Длинный колл',
  'Bull Call Spread': 'Бычий колл-спрэд',
  'Straddle': 'Стрэддл',
  'Iron Condor': 'Железный кондор',
}

const DEFAULT_STRATEGIES: Record<string, Leg[]> = {
  'Long Call': [
    { id: '1', optionType: 'call', strike: 185, premium: 5, direction: 'long', contracts: 1 },
  ],
  'Bull Call Spread': [
    { id: '1', optionType: 'call', strike: 180, premium: 8, direction: 'long', contracts: 1 },
    { id: '2', optionType: 'call', strike: 190, premium: 3, direction: 'short', contracts: 1 },
  ],
  'Straddle': [
    { id: '1', optionType: 'call', strike: 185, premium: 5, direction: 'long', contracts: 1 },
    { id: '2', optionType: 'put', strike: 185, premium: 4.5, direction: 'long', contracts: 1 },
  ],
  'Iron Condor': [
    { id: '1', optionType: 'put', strike: 170, premium: 2, direction: 'long', contracts: 1 },
    { id: '2', optionType: 'put', strike: 175, premium: 4, direction: 'short', contracts: 1 },
    { id: '3', optionType: 'call', strike: 195, premium: 4, direction: 'short', contracts: 1 },
    { id: '4', optionType: 'call', strike: 200, premium: 2, direction: 'long', contracts: 1 },
  ],
}

const OPTION_TYPE_LABELS: Record<string, string> = {
  call: 'КОЛЛ',
  put: 'ПУТ',
}

const DIRECTION_LABELS: Record<string, string> = {
  long: 'ПОКУПКА',
  short: 'ПРОДАЖА',
}

export function StrategyBuilder({ currentPrice = 185 }: StrategyBuilderProps) {
  const [legs, setLegs] = useState<Leg[]>(DEFAULT_STRATEGIES['Long Call'])
  const [selectedPreset, setSelectedPreset] = useState('Long Call')

  const minStrike = Math.min(...legs.map((l) => l.strike), currentPrice) * 0.85
  const maxStrike = Math.max(...legs.map((l) => l.strike), currentPrice) * 1.15

  const chartData = []
  const steps = 60
  for (let i = 0; i <= steps; i++) {
    const sp = minStrike + (i / steps) * (maxStrike - minStrike)
    const totalPnl = legs.reduce((sum, leg) => sum + computeLegPayoff(leg, sp), 0)
    chartData.push({ stockPrice: parseFloat(sp.toFixed(2)), pnl: parseFloat(totalPnl.toFixed(2)) })
  }

  const netPremium = legs.reduce((sum, leg) => {
    return sum + (leg.direction === 'long' ? -leg.premium : leg.premium) * 100 * leg.contracts
  }, 0)

  const maxPnl = Math.max(...chartData.map((d) => d.pnl))
  const minPnl = Math.min(...chartData.map((d) => d.pnl))

  const loadPreset = (name: string) => {
    setSelectedPreset(name)
    setLegs(DEFAULT_STRATEGIES[name])
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const pnl = payload[0].value
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm">
          <div className="text-gray-400">Акция: ${payload[0].payload.stockPrice}</div>
          <div className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
            П/У: {pnl >= 0 ? '+' : ''}${pnl}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">Конструктор стратегий</h3>

      <div className="flex flex-wrap gap-2">
        {Object.keys(DEFAULT_STRATEGIES).map((name) => (
          <button
            key={name}
            onClick={() => loadPreset(name)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedPreset === name
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {STRATEGY_LABELS[name] || name}
          </button>
        ))}
      </div>

      {/* Legs table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left pb-2">Тип</th>
              <th className="text-left pb-2">Направление</th>
              <th className="text-right pb-2">Страйк</th>
              <th className="text-right pb-2">Премия</th>
              <th className="text-right pb-2">Стоим./нога</th>
            </tr>
          </thead>
          <tbody>
            {legs.map((leg) => (
              <tr key={leg.id} className="border-b border-gray-800">
                <td className="py-1.5">
                  <span className={leg.optionType === 'call' ? 'text-blue-400' : 'text-orange-400'}>
                    {OPTION_TYPE_LABELS[leg.optionType] || leg.optionType.toUpperCase()}
                  </span>
                </td>
                <td className="py-1.5">
                  <span className={leg.direction === 'long' ? 'text-green-400' : 'text-red-400'}>
                    {DIRECTION_LABELS[leg.direction] || leg.direction.toUpperCase()}
                  </span>
                </td>
                <td className="text-right py-1.5 font-mono">${leg.strike}</td>
                <td className="text-right py-1.5 font-mono">${leg.premium}</td>
                <td className={`text-right py-1.5 font-mono ${
                  leg.direction === 'long' ? 'text-red-400' : 'text-green-400'
                }`}>
                  {leg.direction === 'long' ? '-' : '+'}${(leg.premium * 100 * leg.contracts).toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right text-gray-400 pt-2 text-xs">Чистая премия:</td>
              <td className={`text-right pt-2 font-mono font-bold ${netPremium >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {netPremium >= 0 ? '+' : ''}${netPremium.toFixed(0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="stockPrice" tickFormatter={(v) => `$${v}`} stroke="#9CA3AF" tick={{ fontSize: 10 }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 4" />
          <ReferenceLine x={currentPrice} stroke="#3B82F6" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="pnl" stroke="#60A5FA" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="card bg-gray-800">
          <div className="text-xs text-gray-400">Макс. прибыль</div>
          <div className="font-mono font-bold text-green-400">
            {maxPnl > 10000 ? 'Неограниченно' : `$${maxPnl.toFixed(0)}`}
          </div>
        </div>
        <div className="card bg-gray-800">
          <div className="text-xs text-gray-400">Макс. убыток</div>
          <div className="font-mono font-bold text-red-400">${minPnl.toFixed(0)}</div>
        </div>
        <div className="card bg-gray-800">
          <div className="text-xs text-gray-400">Чистая премия</div>
          <div className={`font-mono font-bold ${netPremium >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {netPremium >= 0 ? '+' : ''}${netPremium.toFixed(0)}
          </div>
        </div>
      </div>
    </div>
  )
}
