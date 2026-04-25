import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from 'recharts'
import { blackScholes } from '../../lib/blackScholes'

interface ThetaDecayChartProps {
  S: number
  K: number
  r?: number
  sigma: number
  optionType: 'call' | 'put'
  maxDays?: number
}

export function ThetaDecayChart({
  S,
  K,
  r = 0.05,
  sigma,
  optionType,
  maxDays = 90,
}: ThetaDecayChartProps) {
  const data: Array<{ daysLeft: number; price: number; theta: number }> = []

  for (let d = maxDays; d >= 1; d--) {
    const T = d / 365
    const result = blackScholes({ S, K, T, r, sigma, optionType })
    if (result) {
      data.push({
        daysLeft: d,
        price: parseFloat(result.price.toFixed(4)),
        theta: parseFloat(result.theta.toFixed(4)),
      })
    }
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const daysLeft = payload[0].payload.daysLeft
      const price = payload[0].value
      const theta = payload[0].payload.theta
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
          <div className="text-gray-400">{daysLeft} дней осталось</div>
          <div className="text-white font-mono">Стоимость: ${price.toFixed(4)}</div>
          <div className="text-red-400 font-mono">Тета: ${theta.toFixed(4)}/день</div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-gray-400 mb-3">
        Распад стоимости опциона со временем (Тета)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="daysLeft"
            reversed
            stroke="#9CA3AF"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}d`}
          >
            <Label value="Дней до экспирации" offset={-10} position="insideBottom" fill="#9CA3AF" fontSize={12} />
          </XAxis>
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `$${v.toFixed(2)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={30} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: '30d', fill: '#F59E0B', fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#EF4444"
            strokeWidth={2}
            fill="url(#priceGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-yellow-400 text-center">
        Распад ускоряется в последние 30 дней (отмечено жёлтой линией)
      </div>
    </div>
  )
}
