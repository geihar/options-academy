import { useState, useRef } from 'react'
import { runSqueezeScan, fetchSqueezeUniverse, SqueezeMetrics, PricePoint, UniverseItem } from '../api/client'

// ── Presets ───────────────────────────────────────────────────────────────────

const WATCHLISTS: Record<string, string[]> = {
  'Исторические сквизы': ['GME', 'AMC', 'BBBY', 'SPCE', 'MVIS', 'CLOV', 'WKHS'],
  'Высокий шортинтерес': ['CVNA', 'BYND', 'W', 'UPST', 'PTON', 'RIVN', 'LCID'],
  'Малый флоат': ['SMCI', 'MSTR', 'COIN', 'PLTR', 'RBLX', 'SQ', 'AFRM'],
  'Мегавзрывы 2021–24': ['GME', 'AMC', 'CAR', 'SPCE', 'BBBY', 'MSTR', 'NVDA'],
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPct(v: number | null, decimals = 1): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`
}

function fmtNum(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return v.toFixed(0)
}

function pctColor(v: number | null): string {
  if (v == null) return 'text-gray-400'
  if (v > 0) return 'text-green-400'
  if (v < 0) return 'text-red-400'
  return 'text-gray-300'
}

function scoreColor(s: number): string {
  if (s >= 70) return 'text-red-400'
  if (s >= 50) return 'text-orange-400'
  if (s >= 30) return 'text-yellow-400'
  return 'text-gray-400'
}

function scoreBg(s: number): string {
  if (s >= 70) return 'border-red-500/40 bg-red-500/8'
  if (s >= 50) return 'border-orange-500/40 bg-orange-500/8'
  if (s >= 30) return 'border-yellow-500/30 bg-yellow-500/6'
  return 'border-gray-700/40 bg-gray-800/30'
}

function phaseStyle(phase: string): string {
  switch (phase) {
    case 'Ускорение': return 'bg-red-500/20 text-red-300 border-red-500/40'
    case 'Триггер':   return 'bg-orange-500/20 text-orange-300 border-orange-500/40'
    case 'Накопление': return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
    case 'Истощение': return 'bg-gray-700/50 text-gray-400 border-gray-600/30'
    default: return 'bg-gray-700/30 text-gray-500 border-gray-600/30'
  }
}

function siPctColor(si: number | null): string {
  if (si == null) return 'text-gray-400'
  if (si >= 30) return 'text-red-400'
  if (si >= 20) return 'text-orange-400'
  if (si >= 10) return 'text-yellow-400'
  return 'text-gray-300'
}

// ── Mini sparkline (pure SVG, no deps) ────────────────────────────────────────

function Sparkline({ data, width = 120, height = 36 }: { data: PricePoint[]; width?: number; height?: number }) {
  if (data.length < 2) return null
  const prices = data.map(d => d.close)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width
    const y = height - ((p - min) / range) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const last = prices[prices.length - 1]
  const first = prices[0]
  const isUp = last >= first
  const color = isUp ? '#4ade80' : '#f87171'

  return (
    <svg width={width} height={height} className="opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── Squeeze Score Gauge ────────────────────────────────────────────────────────

function SqueezeGauge({ score }: { score: number }) {
  const pct = Math.min(100, score)
  const radius = 28
  const circ = 2 * Math.PI * radius
  const dash = (pct / 100) * circ * 0.75  // 3/4 arc
  const gap = circ - dash

  const color = score >= 70 ? '#f87171' : score >= 50 ? '#fb923c' : score >= 30 ? '#facc15' : '#6b7280'

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg width="64" height="64" className="-rotate-[135deg]">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#374151" strokeWidth="5" strokeDasharray={`${circ * 0.75} ${circ}`} />
        <circle cx="32" cy="32" r={radius} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${gap + circ * 0.25}`}
          strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold leading-none ${scoreColor(score)}`}>{score.toFixed(0)}</span>
      </div>
    </div>
  )
}

// ── Squeeze Phase Explainer ────────────────────────────────────────────────────

const PHASE_EXPLAINER: Record<string, { icon: string; desc: string }> = {
  'Накопление': {
    icon: '⚡',
    desc: 'Шортисты набрали позиции, топливо накоплено. Ждём катализатор — новость, объёмный прорыв.',
  },
  'Триггер': {
    icon: '🔥',
    desc: 'Цена начала движение, объём растёт. Шортисты начинают нервничать. Сквиз в процессе запуска.',
  },
  'Ускорение': {
    icon: '🚀',
    desc: 'Резкий рост, шортисты вынуждены закрываться, что ещё больше толкает цену вверх.',
  },
  'Истощение': {
    icon: '📉',
    desc: 'Рост замедляется или разворачивается. Шортинтерес снижается, сквиз выгорает.',
  },
  'Нейтральный': {
    icon: '💤',
    desc: 'Недостаточно условий для сквиза в данный момент.',
  },
}

// ── Squeeze Card ───────────────────────────────────────────────────────────────

function SqueezeCard({ m }: { m: SqueezeMetrics }) {
  const [expanded, setExpanded] = useState(false)
  const phase = PHASE_EXPLAINER[m.squeeze_phase] ?? PHASE_EXPLAINER['Нейтральный']

  const floatM = m.float_shares != null ? (m.float_shares / 1_000_000).toFixed(1) : null
  const mcapStr = m.market_cap != null ? `$${fmtNum(m.market_cap)}` : null

  return (
    <div className={`border rounded-2xl overflow-hidden ${scoreBg(m.squeeze_score)}`}>
      {/* ── Header ── */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <SqueezeGauge score={m.squeeze_score} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-bold text-white">{m.ticker}</span>
                <span className="text-gray-400 text-sm truncate max-w-[200px]">{m.name}</span>
                {m.sector && (
                  <span className="text-xs text-gray-600 px-2 py-0.5 bg-gray-800 rounded-full">{m.sector}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-white font-mono font-semibold">
                  ${m.current_price.toFixed(2)}
                </span>
                {m.change_1d != null && (
                  <span className={`text-sm font-medium ${pctColor(m.change_1d)}`}>{fmtPct(m.change_1d)}</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${phaseStyle(m.squeeze_phase)}`}>
                  {phase.icon} {m.squeeze_phase}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${scoreColor(m.squeeze_score)} bg-current/8 border-current/30`}>
                  {m.squeeze_potential}
                </span>
              </div>
            </div>
          </div>

          {/* Sparkline */}
          {m.price_history.length > 5 && (
            <div className="shrink-0 hidden sm:block">
              <Sparkline data={m.price_history.slice(-30)} />
              <div className="text-xs text-gray-600 text-center mt-0.5">30 дней</div>
            </div>
          )}
        </div>

        {/* ── Key metrics grid ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 text-xs">
          {[
            {
              label: 'Шорт %',
              value: m.short_interest_pct != null ? `${m.short_interest_pct.toFixed(1)}%` : '—',
              color: siPctColor(m.short_interest_pct),
              hint: '% флоата в шорт',
            },
            {
              label: 'Days-to-Cover',
              value: m.days_to_cover != null ? `${m.days_to_cover.toFixed(1)}д` : '—',
              color: (m.days_to_cover ?? 0) >= 5 ? 'text-orange-400' : 'text-white',
              hint: 'дней закрывать при текущем объёме',
            },
            {
              label: 'Флоат',
              value: floatM != null ? `${floatM}M` : '—',
              color: parseFloat(floatM ?? '999') < 20 ? 'text-yellow-400' : 'text-white',
              hint: 'акций в обращении',
            },
            {
              label: 'Объём ×',
              value: m.volume_ratio != null ? `${m.volume_ratio.toFixed(1)}×` : '—',
              color: (m.volume_ratio ?? 1) >= 3 ? 'text-orange-400' : 'text-white',
              hint: 'к среднему 20d',
            },
            {
              label: '5 дней',
              value: fmtPct(m.change_5d),
              color: pctColor(m.change_5d),
              hint: 'изменение цены',
            },
            {
              label: 'IV Rank',
              value: m.iv_rank != null ? `${m.iv_rank.toFixed(0)}` : '—',
              color: (m.iv_rank ?? 0) >= 50 ? 'text-purple-400' : 'text-white',
              hint: 'опционный рынок',
            },
          ].map(({ label, value, color, hint }) => (
            <div key={label} className="bg-gray-800/50 rounded-xl p-2 text-center" title={hint}>
              <div className="text-gray-500 mb-0.5">{label}</div>
              <div className={`font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Key factors (always visible) ── */}
      {m.key_factors.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {m.key_factors.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-green-300 bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-1.5">
              <span className="shrink-0 mt-0.5 text-green-500">▲</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Expand toggle ── */}
      <div className="border-t border-gray-700/40">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
        >
          {expanded ? 'Свернуть ▲' : 'Детали и риски ▼'}
        </button>
      </div>

      {/* ── Expanded section ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-700/20">

          {/* Phase explanation */}
          <div className={`rounded-xl p-3 text-xs border ${phaseStyle(m.squeeze_phase)}`}>
            <div className="font-semibold mb-1">Фаза: {phase.icon} {m.squeeze_phase}</div>
            <p className="opacity-80 leading-relaxed">{phase.desc}</p>
          </div>

          {/* Full stats */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {[
              ['Короткие позиции (шт.)', m.shares_short != null ? fmtNum(m.shares_short) : '—'],
              ['Короткие месяц назад', m.shares_short_prev != null ? fmtNum(m.shares_short_prev) : '—'],
              ['Изменение шорт MoM', m.si_change_pct != null ? fmtPct(m.si_change_pct) : '—'],
              ['Флоат (акций)', m.float_shares != null ? fmtNum(m.float_shares) : '—'],
              ['В обращении', m.shares_outstanding != null ? fmtNum(m.shares_outstanding) : '—'],
              ['Market Cap', mcapStr ?? '—'],
              ['Beta', m.beta != null ? m.beta.toFixed(2) : '—'],
              ['Объём сегодня', m.volume_today != null ? fmtNum(m.volume_today) : '—'],
              ['Среднедн. объём 20d', m.avg_volume_20d != null ? fmtNum(m.avg_volume_20d) : '—'],
              ['Изменение 1 день', fmtPct(m.change_1d)],
              ['Изменение 5 дней', fmtPct(m.change_5d)],
              ['Изменение 20 дней', fmtPct(m.change_20d)],
              ['52w High', m.week_52_high != null ? `$${m.week_52_high.toFixed(2)}` : '—'],
              ['52w Low', m.week_52_low != null ? `$${m.week_52_low.toFixed(2)}` : '—'],
              ['От 52w минимума', m.change_52w_low_pct != null ? fmtPct(m.change_52w_low_pct) : '—'],
              ['До 52w максимума', m.change_52w_high_pct != null ? fmtPct(m.change_52w_high_pct) : '—'],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between border-b border-gray-700/20 py-1">
                <span className="text-gray-500">{label}</span>
                <span className="text-gray-200 font-medium">{val}</span>
              </div>
            ))}
          </div>

          {/* Risk factors */}
          {m.risk_factors.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Риски</div>
              {m.risk_factors.map((rf, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-orange-300 bg-orange-500/6 border border-orange-500/20 rounded-lg px-3 py-1.5">
                  <span className="shrink-0 mt-0.5 text-orange-500">▼</span>
                  <span>{rf}</span>
                </div>
              ))}
            </div>
          )}

          {/* Full sparkline */}
          {m.price_history.length > 10 && (
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">График за 60 дней</div>
              <div className="bg-gray-900/60 rounded-xl p-3">
                <Sparkline data={m.price_history} width={480} height={80} />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>{m.price_history[0]?.date}</span>
                  <span>{m.price_history[m.price_history.length - 1]?.date}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Squeeze Mechanics Explainer ────────────────────────────────────────────────

function SqueezeMechanicsPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="card">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <span className="text-sm font-semibold text-white">Как работает short squeeze — механика</span>
        </div>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 text-sm text-gray-300">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              {
                phase: '1. Накопление',
                color: 'border-yellow-500/40 bg-yellow-500/5',
                title: 'Шортисты набирают позиции',
                desc: 'Много трейдеров ставит на падение акции. Шорт-интерес растёт до 20-40%+ флоата. Акция торгуется вяло.',
                example: 'CAR 2021: хедж-фонды шортили 40%+ флоата, ожидая банкротства',
              },
              {
                phase: '2. Катализатор',
                color: 'border-orange-500/40 bg-orange-500/6',
                title: 'Появляется триггер',
                desc: 'Хорошая новость, объёмная покупка, соцсети или просто нехватка продавцов запускает рост.',
                example: 'CAR объявила инвестиции в электромобили — неожиданно позитивно',
              },
              {
                phase: '3. Ускорение',
                color: 'border-red-500/40 bg-red-500/8',
                title: 'Принудительное закрытие',
                desc: 'Цена растёт → убытки шортистов → margin calls → вынужденная покупка → ещё больший рост. Само себя усиливает.',
                example: 'CAR: $30 → $540 за 3 дня (+1700%)',
              },
              {
                phase: '4. Истощение',
                color: 'border-gray-600/30 bg-gray-700/20',
                title: 'Сквиз выгорает',
                desc: 'Шортисты закрылись, покупатели фиксируют прибыль. Цена резко падает.',
                example: 'CAR упала с $540 обратно к $200 за неделю',
              },
            ].map(({ phase, color, title, desc, example }) => (
              <div key={phase} className={`border rounded-xl p-3 text-xs space-y-2 ${color}`}>
                <div className="font-bold text-white text-sm">{phase}</div>
                <div className="font-semibold text-gray-200">{title}</div>
                <div className="text-gray-400 leading-relaxed">{desc}</div>
                <div className="text-gray-600 italic border-t border-gray-700/30 pt-2">{example}</div>
              </div>
            ))}
          </div>

          <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 text-xs space-y-2">
            <div className="text-blue-400 font-semibold">Что искать в сканере:</div>
            <ul className="space-y-1 text-gray-400 list-disc list-inside">
              <li><strong className="text-gray-300">Short Interest ≥ 20%</strong> — топливо накоплено</li>
              <li><strong className="text-gray-300">Days-to-Cover ≥ 3</strong> — шортистам нужно время чтобы выйти</li>
              <li><strong className="text-gray-300">Малый флоат</strong> — меньше акций = сильнее движение</li>
              <li><strong className="text-gray-300">Объём × ≥ 2</strong> — аномальная активность, что-то происходит</li>
              <li><strong className="text-gray-300">IV Rank высокий</strong> — рынок опционов уже закладывает движение</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

// ── Universe Picker ────────────────────────────────────────────────────────────

function UniversePicker({
  onConfirm,
}: {
  onConfirm: (tickers: string[]) => void
}) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<UniverseItem[] | null>(null)
  const [source, setSource] = useState<'finviz' | 'fallback' | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [minSI, setMinSI] = useState(10)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = async () => {
    setLoading(true)
    setError(null)
    setItems(null)
    setSelected(new Set())
    try {
      const res = await fetchSqueezeUniverse(minSI)
      setItems(res.items)
      setSource(res.source)
      // Auto-select top 20 by short_float
      const top = res.items.slice(0, 20).map(i => i.ticker)
      setSelected(new Set(top))
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (t: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    return next
  })

  const selectAll = () => setSelected(new Set(items?.map(i => i.ticker) ?? []))
  const clearAll = () => setSelected(new Set())

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 whitespace-nowrap">Min Short Float %</label>
          <input
            type="number"
            value={minSI}
            onChange={e => setMinSI(Number(e.target.value))}
            min={5} max={80} step={5}
            className="w-16 bg-gray-800 text-white rounded-lg px-2 py-1.5 text-sm border border-gray-700 focus:outline-none focus:border-orange-500"
          />
        </div>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {loading ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Загружаю...</>
          ) : (
            <><span>⚡</span>Авто-поиск с Finviz</>
          )}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</div>
      )}

      {items && (
        <div className="space-y-2">
          {/* Source badge + controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                source === 'finviz'
                  ? 'bg-green-500/15 border-green-500/30 text-green-400'
                  : 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
              }`}>
                {source === 'finviz' ? '✓ Данные Finviz' : '⚠ Резервный список (Finviz недоступен)'}
              </span>
              <span className="text-xs text-gray-500">{items.length} акций найдено</span>
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-orange-400 hover:text-orange-300">Все</button>
              <span className="text-gray-600">·</span>
              <button onClick={clearAll} className="text-gray-500 hover:text-gray-300">Сбросить</button>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400">{selected.size} выбрано</span>
            </div>
          </div>

          {/* Ticker grid with SI info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-64 overflow-y-auto pr-1">
            {items.map(item => {
              const isSelected = selected.has(item.ticker)
              return (
                <button
                  key={item.ticker}
                  onClick={() => toggle(item.ticker)}
                  className={`text-left rounded-lg px-3 py-2 border text-xs transition-colors ${
                    isSelected
                      ? 'bg-orange-600/20 border-orange-500/40 text-orange-200'
                      : 'bg-gray-800/50 border-gray-700/40 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  <div className="font-bold text-sm">{item.ticker}</div>
                  {item.short_float_pct != null && (
                    <div className={`font-semibold mt-0.5 ${
                      item.short_float_pct >= 30 ? 'text-red-400' :
                      item.short_float_pct >= 20 ? 'text-orange-400' :
                      item.short_float_pct >= 10 ? 'text-yellow-400' : 'text-gray-500'
                    }`}>
                      SI: {item.short_float_pct.toFixed(1)}%
                    </div>
                  )}
                  {item.short_ratio != null && (
                    <div className="text-gray-600 mt-0.5">{item.short_ratio.toFixed(1)}д покр.</div>
                  )}
                </button>
              )
            })}
          </div>

          {selected.size > 0 && (
            <button
              onClick={() => onConfirm([...selected])}
              className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors"
            >
              Добавить {selected.size} тикер{selected.size === 1 ? '' : 'ов'} для анализа →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SqueezeScanner() {
  const [tickerInput, setTickerInput] = useState('')
  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SqueezeMetrics[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanTime, setScanTime] = useState<number | null>(null)
  const [showUniverse, setShowUniverse] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addTicker = (raw: string) => {
    const tickers = raw.toUpperCase().split(/[\s,;]+/).map(t => t.trim()).filter(t => /^[A-Z]{1,6}$/.test(t))
    setSelectedTickers(prev => [...new Set([...prev, ...tickers])].slice(0, 30))
    setTickerInput('')
    inputRef.current?.focus()
  }

  const handleUniverseConfirm = (tickers: string[]) => {
    setSelectedTickers(prev => [...new Set([...prev, ...tickers])].slice(0, 30))
    setShowUniverse(false)
  }

  const handleScan = async () => {
    if (selectedTickers.length === 0) return
    setLoading(true)
    setError(null)
    setResults(null)
    const t0 = Date.now()
    try {
      const res = await runSqueezeScan(selectedTickers)
      setResults(res.results)
      setScanTime(Date.now() - t0)
    } catch (e: any) {
      const d = e?.response?.data?.detail
      setError((Array.isArray(d) ? d[0]?.msg : d) || e?.message || 'Ошибка сканирования')
    } finally {
      setLoading(false)
    }
  }

  // Summary stats
  const explosive = results?.filter(r => r.squeeze_score >= 70).length ?? 0
  const high = results?.filter(r => r.squeeze_score >= 50 && r.squeeze_score < 70).length ?? 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🚀</span> Short Squeeze Сканер
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Аналитика по акциям с высоким потенциалом принудительного закрытия коротких позиций.
          Пример: CAR +1700% за 3 дня (ноябрь 2021).
        </p>
      </div>

      <SqueezeMechanicsPanel />

      {/* Config */}
      <div className="card space-y-4">
        {/* Auto-discover section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              Авто-поиск кандидатов
            </div>
            <button
              onClick={() => setShowUniverse(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showUniverse
                  ? 'bg-orange-600/20 border-orange-500/40 text-orange-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {showUniverse ? '▲ Скрыть' : '⚡ Найти по Finviz'}
            </button>
          </div>

          {showUniverse && (
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Автоматически парсит <strong className="text-gray-400">Finviz Screener</strong> — находит акции с
                высоким шортинтересом без ввода тикеров вручную. Выбери нужные и добавь в список.
              </p>
              <UniversePicker onConfirm={handleUniverseConfirm} />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <div className="flex-1 border-t border-gray-700/40" />
          <span>или введите вручную</span>
          <div className="flex-1 border-t border-gray-700/40" />
        </div>

        {/* Manual presets */}
        <div>
          <div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Готовые списки</div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(WATCHLISTS).map(([name, tickers]) => (
              <button
                key={name}
                onClick={() => setSelectedTickers(tickers)}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Ticker input */}
        <div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={tickerInput}
              onChange={e => setTickerInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                  e.preventDefault()
                  if (tickerInput.trim()) addTicker(tickerInput)
                }
              }}
              placeholder="GME, AMC, CAR... (Enter для добавления)"
              className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={() => tickerInput.trim() && addTicker(tickerInput)}
              className="px-4 py-2 text-sm rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Selected tickers */}
        {selectedTickers.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {selectedTickers.map(t => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-300 text-xs"
              >
                {t}
                <button
                  onClick={() => setSelectedTickers(p => p.filter(x => x !== t))}
                  className="hover:text-white ml-0.5"
                >×</button>
              </span>
            ))}
            <button
              onClick={() => setSelectedTickers([])}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Очистить
            </button>
          </div>
        )}

        {/* Note about slow fetch */}
        {selectedTickers.length > 5 && (
          <div className="text-xs text-gray-600 bg-gray-800/30 rounded-lg px-3 py-2">
            ⏱ ~3–5 сек/тикер — для {selectedTickers.length} тикеров ≈ {Math.round(selectedTickers.length * 4 / 60)} мин.
            Результаты кешируются на 4 часа.
          </div>
        )}

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={loading || selectedTickers.length === 0}
          className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Анализирую {selectedTickers.length} тикер{selectedTickers.length > 1 ? 'ов' : ''}...
            </>
          ) : (
            <>
              <span>🔍</span>
              Сканировать {selectedTickers.length > 0 ? `${selectedTickers.length} тикер${selectedTickers.length > 1 ? 'ов' : ''}` : ''}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      )}

      {/* Summary bar */}
      {results !== null && (
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-sm">
            <span className="text-gray-400">
              Просканировано <span className="text-white font-semibold">{results.length}</span> тикеров
            </span>
            {explosive > 0 && (
              <span className="text-red-400 font-semibold">🔥 {explosive} взрывных</span>
            )}
            {high > 0 && (
              <span className="text-orange-400 font-semibold">⚡ {high} высоких</span>
            )}
          </div>
          {scanTime !== null && (
            <span className="text-gray-600 text-sm">за {(scanTime / 1000).toFixed(1)}с</span>
          )}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div className="space-y-4">
          {results.map((m, i) => (
            m.error
              ? (
                <div key={i} className="card text-sm text-red-400 flex items-center gap-2">
                  <span>{m.ticker}</span>
                  <span className="text-gray-500">—</span>
                  <span>{m.error}</span>
                </div>
              )
              : <SqueezeCard key={i} m={m} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {results === null && !loading && (
        <div className="text-center py-20 text-gray-600">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-xl font-semibold text-gray-500 mb-2">Готов к поиску squeeze-кандидатов</h2>
          <p className="text-sm max-w-md mx-auto">
            Выберите список или введите тикеры вручную. Сканер покажет шорт-интерес,
            days-to-cover, объёмные аномалии и фазу сквиза.
          </p>
          <div className="mt-4 text-xs text-gray-700 max-w-lg mx-auto leading-relaxed">
            Пример: CAR (Avis Budget) в ноябре 2021 — шортинтерес ~40% флоата,
            объявление про электромобили запустило сквиз с $30 до $540 за 3 дня.
          </div>
        </div>
      )}
    </div>
  )
}
