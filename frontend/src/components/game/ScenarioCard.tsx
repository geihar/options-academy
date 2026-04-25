import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { ScenarioData } from '../../hooks/useGameSession'

interface ScenarioCardProps {
  scenario: ScenarioData
}

interface TooltipPayloadEntry {
  value: number
  payload: { day: number; price: number }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: number
}

function PriceTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs">
      <div className="text-gray-400">День {label}</div>
      <div className="text-white font-mono">${payload[0].value.toFixed(2)}</div>
    </div>
  )
}

export function ScenarioCard({ scenario }: ScenarioCardProps) {
  const prices = scenario.past_prices_30d
  const chartData = prices.map((price, i) => ({ day: i + 1, price }))
  const minPrice = Math.min(...prices) * 0.99
  const maxPrice = Math.max(...prices) * 1.01
  const returnPct = scenario.market_context.return_30d
  const isPositive = returnPct >= 0

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">
            Исторический сценарий
          </div>
          <h2 className="text-2xl font-bold text-white">{scenario.ticker}</h2>
          <div className="text-sm text-gray-400 mt-0.5">{scenario.scenario_date}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono font-bold text-green-400">
            ${scenario.entry_price.toFixed(2)}
          </div>
          <div
            className={`text-sm font-mono mt-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}
          >
            {isPositive ? '+' : ''}
            {returnPct.toFixed(1)}% за 30 дней
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="bg-gray-800/50 rounded-xl p-3">
        <div className="text-xs text-gray-400 mb-2">Цена за последние 30 дней</div>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <XAxis dataKey="day" hide />
            <YAxis domain={[minPrice, maxPrice]} hide />
            <Tooltip content={<PriceTooltip />} />
            <ReferenceLine y={scenario.entry_price} stroke="#60A5FA" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="price"
              stroke={isPositive ? '#34D399' : '#F87171'}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Narrative */}
      <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
        <p className="text-gray-200 leading-relaxed text-sm">{scenario.narrative}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card bg-gray-800 text-center">
          <div className="text-xs text-gray-400">ИВ (используется)</div>
          <div className="text-lg font-mono font-bold text-yellow-400">
            {scenario.market_context.iv_used_pct.toFixed(1)}%
          </div>
        </div>
        <div className="card bg-gray-800 text-center">
          <div className="text-xs text-gray-400">Ист. волатильность</div>
          <div className="text-lg font-mono font-bold text-blue-400">
            {scenario.market_context.hv_30_pct.toFixed(1)}%
          </div>
        </div>
        <div className="card bg-gray-800 text-center">
          <div className="text-xs text-gray-400">Тренд (30д)</div>
          <div className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {scenario.market_context.trend_description}
          </div>
        </div>
        <div className="card bg-gray-800 text-center">
          <div className="text-xs text-gray-400">Изменение</div>
          <div
            className={`text-lg font-mono font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}
          >
            {isPositive ? '+' : ''}
            {returnPct.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}
