import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from 'recharts'
import { computePayoff } from '../../lib/blackScholes'

interface PayoffDiagramProps {
  K: number
  premium: number
  optionType: 'call' | 'put'
  currentPrice?: number
  contracts?: number
  title?: string
}

export function PayoffDiagram({
  K,
  premium,
  optionType,
  currentPrice,
  contracts = 1,
  title,
}: PayoffDiagramProps) {
  const data = computePayoff(K, premium, optionType, contracts)
  const breakeven = optionType === 'call' ? K + premium : K - premium

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const pnl = payload[0].value as number
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
          <div className="text-gray-400">Акция при экспирации:</div>
          <div className="text-white font-mono">${payload[0].payload.stockPrice.toFixed(2)}</div>
          <div className={`font-semibold mt-1 ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            П/У: {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full">
      {title && <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="stockPrice"
            tickFormatter={(v) => `$${v}`}
            stroke="#9CA3AF"
            tick={{ fontSize: 11 }}
          >
            <Label value="Цена акции при экспирации" offset={-10} position="insideBottom" fill="#9CA3AF" fontSize={12} />
          </XAxis>
          <YAxis
            tickFormatter={(v) => `$${v}`}
            stroke="#9CA3AF"
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 4" />
          {currentPrice && (
            <ReferenceLine
              x={parseFloat(currentPrice.toFixed(2))}
              stroke="#3B82F6"
              strokeDasharray="4 4"
              label={{ value: 'Текущая', fill: '#3B82F6', fontSize: 11 }}
            />
          )}
          <ReferenceLine
            x={parseFloat(breakeven.toFixed(2))}
            stroke="#10B981"
            strokeDasharray="4 4"
            label={{ value: `Безубыток $${breakeven.toFixed(0)}`, fill: '#10B981', fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="pnl"
            stroke="#60A5FA"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-xs text-gray-400 mt-2 justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-blue-400" /> П/У
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-green-400" style={{ borderTop: '2px dashed' }} /> Безубыток ${breakeven.toFixed(2)}
        </span>
        {currentPrice && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-blue-500" style={{ borderTop: '2px dashed' }} /> Текущая ${currentPrice.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
}
