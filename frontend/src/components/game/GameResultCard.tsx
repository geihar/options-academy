import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import clsx from 'clsx'
import { GameResult } from '../../hooks/useGameSession'

interface GameResultCardProps {
  result: GameResult
  onPlayAgain: () => void
}

export function GameResultCard({ result, onPlayAgain }: GameResultCardProps) {
  const isWin = result.pnl >= 0
  const priceChangePct = ((result.exit_price - result.entry_price) / result.entry_price) * 100

  return (
    <div className="space-y-5">
      {/* P&L header */}
      <div className={clsx(
        'card text-center border-2',
        isWin ? 'border-green-600/50 bg-green-900/10' : 'border-red-600/50 bg-red-900/10',
      )}>
        <div className="text-4xl mb-2">{isWin ? '🎯' : '📉'}</div>
        <h2 className="text-xl font-bold text-white mb-1">
          {isWin ? 'Прибыльная сделка!' : 'Убыточная сделка'}
        </h2>
        <div className={clsx('text-4xl font-mono font-bold', isWin ? 'text-green-400' : 'text-red-400')}>
          {isWin ? '+' : ''}${result.pnl.toFixed(2)}
        </div>
        <div className="text-gray-400 text-sm mt-1">
          {result.ticker}: ${result.entry_price.toFixed(2)} → ${result.exit_price.toFixed(2)}&nbsp;
          ({priceChangePct > 0 ? '+' : ''}{priceChangePct.toFixed(1)}%) за {result.forward_days} дней
        </div>
      </div>

      {/* Price chart */}
      <div className="card">
        <div className="text-sm font-semibold text-gray-300 mb-3">Движение цены</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={result.price_history} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isWin ? '#34D399' : '#F87171'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isWin ? '#34D399' : '#F87171'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#9CA3AF" tickFormatter={d => d.slice(5)} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} stroke="#9CA3AF" tickFormatter={v => `$${v}`} />
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(2)}`, 'Цена']}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
            />
            <ReferenceLine y={result.entry_price} stroke="#3B82F6" strokeDasharray="4 4"
              label={{ value: 'Вход', fill: '#3B82F6', fontSize: 10 }} />
            <Area type="monotone" dataKey="price" stroke={isWin ? '#34D399' : '#F87171'}
              strokeWidth={2} fill="url(#priceFill)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* P&L per leg */}
      <div className="card">
        <div className="text-sm font-semibold text-gray-300 mb-3">П/У по ногам</div>
        <div className="space-y-2">
          {result.pnl_per_leg.map((leg, i) => (
            <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-gray-800 last:border-0">
              <div>
                <span className={clsx('font-semibold', leg.direction === 'long' ? 'text-green-400' : 'text-red-400')}>
                  {leg.direction === 'long' ? 'Покупка' : 'Продажа'}
                </span>
                <span className="text-white ml-2 font-mono text-xs">
                  ${leg.strike} {leg.option_type === 'call' ? 'Колл' : 'Пут'}
                </span>
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-xs">${leg.entry_premium.toFixed(2)} → ${leg.exit_value.toFixed(2)}</div>
                <div className={clsx('font-mono font-bold', leg.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {leg.pnl >= 0 ? '+' : ''}${leg.pnl.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score breakdown */}
      <div className="card bg-blue-900/10 border-blue-700/30">
        <div className="text-sm font-semibold text-gray-300 mb-3">Оценка раунда</div>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Результат П/У',         value: result.score_breakdown.base_pnl,            max: 60 },
            { label: 'Качество стратегии',     value: result.score_breakdown.strategy_quality,    max: 25 },
            { label: 'Точность направления',   value: result.score_breakdown.direction_accuracy,  max: 15 },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-36 text-gray-400 text-xs flex-shrink-0">{item.label}</div>
              <div className="flex-1 bg-gray-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(item.value / item.max) * 100}%` }} />
              </div>
              <div className="text-white font-mono w-12 text-right text-xs">{item.value}/{item.max}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-blue-800/30">
          <div>
            <div className="text-xs text-gray-400">За раунд</div>
            <div className="text-2xl font-bold text-blue-300">+{result.score_awarded}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Всего очков</div>
            <div className="text-2xl font-bold text-white">{result.total_score}</div>
            <div className="text-xs text-blue-400">{result.rank}</div>
          </div>
        </div>
      </div>

      <button onClick={onPlayAgain}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-lg">
        Следующий раунд →
      </button>
    </div>
  )
}
