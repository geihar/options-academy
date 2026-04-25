import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { fetchIVHistory, HVHistoryPoint } from '../../api/client'

interface Props {
  ticker: string
  currentIV?: number | null   // current option IV (from advice endpoint)
}

function formatDate(d: string): string {
  const dt = new Date(d)
  return `${dt.toLocaleString('ru', { month: 'short' })} ${dt.getFullYear().toString().slice(2)}`
}

// Show only every N-th tick to avoid crowding
function tickFormatter(value: string, index: number): string {
  if (index % 30 !== 0) return ''
  return formatDate(value)
}

export function HVChart({ ticker, currentIV }: Props) {
  const [data, setData] = useState<HVHistoryPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [min, setMin] = useState(0)
  const [max, setMax] = useState(100)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(false)
    fetchIVHistory(ticker)
      .then(res => {
        setData(res.data)
        setMin(Math.max(0, res.hv30_min - 5))
        setMax(res.hv30_max + 5)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Загрузка HV данных...
      </div>
    )
  }

  if (error || data.length === 0) return null

  const currentHV = data[data.length - 1]?.hv30

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs space-y-1 shadow-xl">
        <div className="text-gray-400">{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex gap-2 items-center">
            <span style={{ color: p.color }}>■</span>
            <span className="text-gray-400">{p.name}:</span>
            <span className="text-white font-semibold">{p.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-gray-300">
          Историческая волатильность {ticker}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-gray-500">
            HV30 сейчас: <span className="text-blue-400 font-semibold">{currentHV?.toFixed(1)}%</span>
          </span>
          {currentIV != null && (
            <span className="text-gray-500">
              IV опциона: <span className="text-orange-400 font-semibold">{(currentIV * 100).toFixed(1)}%</span>
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.4} />
          <XAxis
            dataKey="date"
            tickFormatter={tickFormatter}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[min, max]}
            tickFormatter={v => `${v}%`}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: '11px', color: '#9ca3af', paddingTop: '4px' }}
          />

          {/* HV30 line */}
          <Line
            type="monotone"
            dataKey="hv30"
            name="HV30"
            stroke="#60a5fa"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
          {/* HV10 line */}
          <Line
            type="monotone"
            dataKey="hv10"
            name="HV10"
            stroke="#a78bfa"
            strokeWidth={1}
            dot={false}
            strokeDasharray="4 2"
            activeDot={{ r: 3 }}
          />

          {/* Current IV reference line */}
          {currentIV != null && (
            <ReferenceLine
              y={currentIV * 100}
              stroke="#f97316"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: `IV ${(currentIV * 100).toFixed(0)}%`, position: 'right', fill: '#f97316', fontSize: 10 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-600">
        HV30 = реализованная 30-дневная волатильность. Когда IV опциона выше HV30 — продавцы имеют структурное преимущество.
      </p>
    </div>
  )
}
