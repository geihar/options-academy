import { useState } from 'react'
import { AdviceItem, AdviceResponse } from '../../api/client'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

interface AdvicePanelProps {
  advice: AdviceResponse
}

const levelStyles = {
  warning: {
    bg: 'bg-orange-900/20',
    border: 'border-orange-700/40',
    headerBg: 'bg-orange-900/30',
    icon: '⚠️',
    title: 'text-orange-300',
    body: 'text-orange-100/90',
    badge: 'bg-orange-800/50 text-orange-300',
    chevron: 'text-orange-400',
  },
  info: {
    bg: 'bg-blue-900/20',
    border: 'border-blue-700/40',
    headerBg: 'bg-blue-900/30',
    icon: 'ℹ️',
    title: 'text-blue-300',
    body: 'text-blue-100/90',
    badge: 'bg-blue-800/50 text-blue-300',
    chevron: 'text-blue-400',
  },
  success: {
    bg: 'bg-green-900/20',
    border: 'border-green-700/40',
    headerBg: 'bg-green-900/30',
    icon: '✅',
    title: 'text-green-300',
    body: 'text-green-100/90',
    badge: 'bg-green-800/50 text-green-300',
    chevron: 'text-green-400',
  },
}

const lessonLabels: Record<string, string> = {
  '/academy/3': 'Урок 3: Ценообразование',
  '/academy/4': 'Урок 4: Греки',
  '/academy/5': 'Урок 5: Тета',
  '/academy/6': 'Урок 6: ИВ',
  '/academy/7': 'Урок 7: Стратегии',
  '/academy/8': 'Урок 8: Отчётность',
  '/academy/9': 'Урок 9: Покрытый колл',
  '/academy/10': 'Урок 10: Обеспеченный пут',
  '/academy/11': 'Урок 11: Кредитные спрэды',
  '/academy/12': 'Урок 12: Риск исполнения',
  '/academy/13': 'Урок 13: Управление позицией',
}

function AdviceCard({ item }: { item: AdviceItem }) {
  const [expanded, setExpanded] = useState(true)
  const s = levelStyles[item.level as keyof typeof levelStyles] || levelStyles.info

  return (
    <div className={clsx('rounded-xl border overflow-hidden', s.bg, s.border)}>
      {/* Header — always visible, clickable to collapse */}
      <button
        className={clsx(
          'w-full flex items-center gap-2 px-4 py-3 text-left transition-colors',
          s.headerBg,
          'hover:brightness-110'
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-base flex-shrink-0">{s.icon}</span>
        <h4 className={clsx('font-semibold text-sm flex-1 leading-snug', s.title)}>
          {item.title}
        </h4>
        <span className={clsx('text-xs transition-transform flex-shrink-0', s.chevron, expanded ? 'rotate-180' : '')}>
          ▼
        </span>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="px-4 py-3 space-y-2">
          <p className={clsx('text-xs leading-relaxed', s.body)}>{item.body}</p>
          {item.lesson_link && (
            <div className="flex items-center gap-2 pt-1">
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', s.badge)}>
                {lessonLabels[item.lesson_link] ?? 'Академия'}
              </span>
              <Link
                to={item.lesson_link}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Подробнее →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GreekBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card bg-gray-800 text-center py-2 px-2">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className={clsx('font-mono font-bold text-sm', color)}>{value}</div>
    </div>
  )
}

export function AdvicePanel({ advice }: AdvicePanelProps) {
  const warnings = advice.advice.filter((a) => a.level === 'warning')
  const successes = advice.advice.filter((a) => a.level === 'success')
  const infos = advice.advice.filter((a) => a.level === 'info')
  const sorted = [...warnings, ...successes, ...infos]

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <GreekBadge
          label="Ранг ИВ"
          value={advice.iv_rank !== null ? `${advice.iv_rank?.toFixed(0)}/100` : '—'}
          color={
            advice.iv_rank == null ? 'text-white' :
            advice.iv_rank > 70 ? 'text-orange-400' :
            advice.iv_rank < 30 ? 'text-green-400' :
            'text-white'
          }
        />
        <GreekBadge
          label="Текущая ИВ"
          value={advice.iv !== null ? `${((advice.iv ?? 0) * 100).toFixed(1)}%` : '—'}
          color="text-yellow-400"
        />
        <GreekBadge
          label="ИВ 30д (HV)"
          value={advice.hv_30 !== null ? `${((advice.hv_30 ?? 0) * 100).toFixed(1)}%` : '—'}
          color="text-blue-400"
        />
        <GreekBadge
          label="Цена BS"
          value={`$${advice.bs_price.toFixed(3)}`}
          color="text-green-400"
        />
      </div>

      {/* Greeks row */}
      <div className="grid grid-cols-5 gap-2">
        <GreekBadge label="Δ Дельта" value={advice.greeks.delta.toFixed(3)} color="text-blue-300" />
        <GreekBadge label="Γ Гамма" value={advice.greeks.gamma.toFixed(4)} color="text-purple-300" />
        <GreekBadge label="θ Тета/д" value={`$${advice.greeks.theta.toFixed(3)}`} color="text-red-400" />
        <GreekBadge label="ν Вега" value={advice.greeks.vega.toFixed(3)} color="text-cyan-300" />
        <GreekBadge label="DTE" value={`${advice.days_to_expiry}д`} color="text-white" />
      </div>

      {/* Breakeven + earnings */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="card bg-gray-800 py-2">
          <div className="text-gray-400 mb-0.5">Безубыточность</div>
          <div className="font-mono font-bold text-white">${advice.breakeven.toFixed(2)}</div>
        </div>
        <div className="card bg-gray-800 py-2">
          <div className="text-gray-400 mb-0.5">Вероятность ITM</div>
          <div className="font-mono font-bold text-white">
            {(Math.abs(advice.greeks.delta) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {advice.next_earnings_date && (
        <div className="bg-orange-900/20 border border-orange-700/30 rounded-lg p-3 text-sm">
          <span className="text-orange-300 font-semibold">Следующая отчётность:</span>
          <span className="text-orange-100 ml-2">
            {advice.next_earnings_date}
            {advice.days_to_earnings !== null && ` (${advice.days_to_earnings} дней)`}
          </span>
        </div>
      )}

      {/* Advice items grouped by priority */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Торговые рекомендации</h3>
          {sorted.length > 0 && (
            <div className="flex gap-1.5 text-xs">
              {warnings.length > 0 && (
                <span className="bg-orange-900/40 text-orange-300 px-2 py-0.5 rounded-full">
                  {warnings.length} предупр.
                </span>
              )}
              {successes.length > 0 && (
                <span className="bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full">
                  {successes.length} хорошо
                </span>
              )}
            </div>
          )}
        </div>
        {sorted.length === 0 ? (
          <p className="text-gray-400 text-sm">Рекомендации не сформированы.</p>
        ) : (
          sorted.map((item, i) => <AdviceCard key={i} item={item} />)
        )}
      </div>
    </div>
  )
}
