import { useState, useRef } from 'react'
import { runScan, ScannerCandidate, ScanTickerResult, ChapterSignal, EvidenceItem } from '../api/client'

// ── Preset watchlists ──────────────────────────────────────────────────────────
const WATCHLISTS: Record<string, string[]> = {
  'Мегакапы': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'],
  'ETF': ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT', 'XLE', 'XLF'],
  'Волатильные': ['TSLA', 'NVDA', 'AMD', 'COIN', 'MSTR', 'PLTR', 'RBLX'],
  'Дивидендные': ['JNJ', 'KO', 'PEP', 'PG', 'VZ', 'T', 'MO'],
}

const STRATEGIES = [
  { value: 'any', label: 'Все стратегии' },
  { value: 'sell_premium', label: 'Продажа премии (все)' },
  { value: 'sell_puts', label: 'Продажа путов' },
  { value: 'sell_calls', label: 'Продажа коллов' },
  { value: 'buy_calls', label: 'Покупка коллов' },
  { value: 'buy_puts', label: 'Покупка путов' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 72) return 'text-green-400'
  if (score >= 55) return 'text-yellow-400'
  if (score >= 38) return 'text-orange-400'
  return 'text-gray-400'
}

function scoreBg(score: number): string {
  if (score >= 72) return 'bg-green-500/15 border-green-500/30'
  if (score >= 55) return 'bg-yellow-500/15 border-yellow-500/30'
  if (score >= 38) return 'bg-orange-500/15 border-orange-500/30'
  return 'bg-gray-800/50 border-gray-700/30'
}

function levelColor(level: string): string {
  switch (level) {
    case 'bullish': return 'text-green-400 bg-green-500/10 border-green-500/30'
    case 'bearish': return 'text-red-400 bg-red-500/10 border-red-500/30'
    case 'warning': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    default: return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
  }
}

function pnlColor(val: number): string {
  if (val > 0) return 'text-green-400'
  if (val < 0) return 'text-red-400'
  return 'text-gray-400'
}

function fmt$(val: number): string {
  const sign = val >= 0 ? '+' : ''
  return `${sign}$${Math.abs(val).toFixed(0)}`
}

// ── Evidence Item ─────────────────────────────────────────────────────────────

function evidenceStatusStyle(status: string): string {
  switch (status) {
    case 'good':    return 'border-green-500/40 bg-green-500/8'
    case 'bad':     return 'border-red-500/40 bg-red-500/8'
    case 'warning': return 'border-yellow-500/40 bg-yellow-500/8'
    default:        return 'border-gray-600/40 bg-gray-800/40'
  }
}

function evidenceValueStyle(status: string): string {
  switch (status) {
    case 'good':    return 'text-green-400'
    case 'bad':     return 'text-red-400'
    case 'warning': return 'text-yellow-400'
    default:        return 'text-gray-300'
  }
}

function EvidenceGrid({ items }: { items: EvidenceItem[] }) {
  if (!items.length) return null
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className={`border rounded-lg px-3 py-2 ${evidenceStatusStyle(item.status)}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-gray-400 font-medium">{item.label}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-snug">{item.meaning}</div>
              {item.threshold && item.threshold !== '—' && (
                <div className="text-xs text-gray-600 mt-0.5 italic">{item.threshold}</div>
              )}
            </div>
            <div className={`text-sm font-bold shrink-0 ${evidenceValueStyle(item.status)}`}>
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Chapter Signal Card ────────────────────────────────────────────────────────

function ChapterSignalCard({ signal, defaultOpen = false }: { signal: ChapterSignal; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen)

  // Score bar width
  const barWidth = `${Math.min(100, signal.score)}%`
  const barColor = signal.score >= 70 ? 'bg-green-500' : signal.score >= 50 ? 'bg-yellow-500' : 'bg-orange-500'

  return (
    <div className={`border rounded-xl overflow-hidden ${levelColor(signal.level)}`}>
      {/* Header — always visible */}
      <div
        className="p-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-bold opacity-60 shrink-0 border border-current/30 rounded px-1.5 py-0.5">
              {signal.chapter}
            </span>
            <span className="text-xs font-semibold leading-snug">{signal.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold">{signal.score.toFixed(0)}</span>
            <span className="text-xs opacity-50">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        {/* Score bar */}
        <div className="h-1 bg-current/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor} opacity-70`} style={{ width: barWidth }} />
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-current/10">
          {/* Analysis */}
          <div className="pt-3">
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Анализ</div>
            <p className="text-xs opacity-90 leading-relaxed">{signal.body}</p>
          </div>

          {/* Evidence */}
          {signal.data_evidence.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
                Данные, на основе которых принято решение
              </div>
              <EvidenceGrid items={signal.data_evidence} />
            </div>
          )}

          {/* Entry rules */}
          {signal.entry_rules && (
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-lg p-3">
              <div className="text-xs text-blue-400 font-semibold mb-1.5">Правила входа</div>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                {signal.entry_rules}
              </pre>
            </div>
          )}

          {/* Exit rules */}
          {signal.exit_rules && (
            <div className="bg-purple-500/8 border border-purple-500/20 rounded-lg p-3">
              <div className="text-xs text-purple-400 font-semibold mb-1.5">Правила выхода</div>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                {signal.exit_rules}
              </pre>
            </div>
          )}

          {/* Risk note */}
          {signal.risk_note && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3">
              <div className="text-xs text-red-400 font-semibold mb-1">Основной риск</div>
              <p className="text-xs text-gray-300 leading-relaxed">{signal.risk_note}</p>
            </div>
          )}

          {/* Catalyst */}
          <div className="flex gap-2 flex-wrap text-xs">
            <div className="bg-gray-800/60 rounded-lg px-3 py-1.5">
              <span className="text-gray-500">Стратегия: </span>
              <span className="text-gray-200">{signal.strategy_hint}</span>
            </div>
            <div className="bg-gray-800/60 rounded-lg px-3 py-1.5">
              <span className="text-gray-500">Катализатор: </span>
              <span className="text-gray-200">{signal.profit_catalyst}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Candidate Card ─────────────────────────────────────────────────────────────

type CardTab = 'overview' | 'analysis' | 'forecast'

function CandidateCard({ c }: { c: ScannerCandidate }) {
  const [tab, setTab] = useState<CardTab>('overview')
  const f = c.forecast
  const typeLabel = c.option_type === 'call' ? 'CALL' : 'PUT'
  const typeColor = c.option_type === 'call' ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'

  // Best signal for overview
  const topSignal = c.chapter_signals.length > 0
    ? [...c.chapter_signals].sort((a, b) => b.score - a.score)[0]
    : null

  return (
    <div className={`border rounded-xl overflow-hidden ${scoreBg(c.composite_score)}`}>
      {/* ── Header ── */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${typeColor}`}>{typeLabel}</span>
            <span className="text-white font-bold text-xl">${c.strike}</span>
            <span className="text-gray-400 text-sm">{c.expiry}</span>
            <span className="text-gray-500 text-xs">({c.days_to_expiry} дн.)</span>
            {c.days_to_earnings !== null && c.days_to_earnings <= 14 && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/30 text-yellow-400">
                Отчётность через {c.days_to_earnings} дн.
              </span>
            )}
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold leading-none ${scoreColor(c.composite_score)}`}>
              {c.composite_score.toFixed(0)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{c.setup_quality}</div>
          </div>
        </div>

        {/* Quick metrics */}
        <div className="grid grid-cols-5 gap-2 mt-3 text-xs">
          {[
            { label: 'Цена', value: `$${c.market_price.toFixed(2)}` },
            { label: 'IV', value: c.iv ? `${(c.iv * 100).toFixed(1)}%` : '—' },
            { label: 'IV Rank', value: c.iv_rank != null ? `${c.iv_rank.toFixed(0)}/100` : '—',
              color: (c.iv_rank ?? 50) > 60 ? 'text-yellow-400' : (c.iv_rank ?? 50) < 30 ? 'text-green-400' : 'text-white' },
            { label: 'Δ', value: c.delta?.toFixed(2) ?? '—' },
            { label: 'Θ/день', value: c.theta ? `-$${Math.abs(c.theta).toFixed(3)}` : '—', color: 'text-orange-400' },
          ].map(m => (
            <div key={m.label} className="bg-gray-800/50 rounded-lg p-2 text-center">
              <div className="text-gray-500 mb-0.5">{m.label}</div>
              <div className={`font-semibold ${m.color ?? 'text-white'}`}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-t border-gray-700/40">
        {([
          { id: 'overview', label: 'Обзор' },
          { id: 'analysis', label: `Анализ по книге (${c.chapter_signals.length})` },
          { id: 'forecast', label: 'Прогноз P&L' },
        ] as { id: CardTab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'text-white bg-gray-700/50 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {tab === 'overview' && (
        <div className="p-4 space-y-3">
          {/* Strategy recommendation */}
          <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3 space-y-1.5">
            <div className="text-xs text-blue-400 font-semibold uppercase tracking-wide">Рекомендованная стратегия</div>
            <div className="text-sm text-white font-medium">{c.recommended_strategy}</div>
            <div className="text-xs text-gray-400 leading-relaxed">{c.strategy_rationale}</div>
          </div>

          {/* Top signal preview */}
          {topSignal && (
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
                Сильнейший сигнал
              </div>
              <ChapterSignalCard signal={topSignal} defaultOpen={true} />
            </div>
          )}

          {/* Liquidity */}
          <div className="flex gap-4 text-xs text-gray-600 pt-1 border-t border-gray-700/30 flex-wrap">
            <span>Bid: ${c.bid.toFixed(2)}</span>
            <span>Ask: ${c.ask.toFixed(2)}</span>
            <span>Спред: ${(c.ask - c.bid).toFixed(2)}</span>
            <span>Объём: {c.volume.toLocaleString()}</span>
            <span>OI: {c.open_interest.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* ── Tab: Analysis ── */}
      {tab === 'analysis' && (
        <div className="p-4 space-y-3">
          <div className="text-xs text-gray-500 leading-relaxed mb-2">
            Каждый сигнал основан на главе книги «Trading Volatility» (Colin Bennett).
            Раскройте сигнал для просмотра данных, правил входа/выхода и основного риска.
          </div>
          {c.chapter_signals
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((sig, i) => (
              <ChapterSignalCard key={i} signal={sig} defaultOpen={i === 0} />
            ))
          }
          {c.chapter_signals.length === 0 && (
            <div className="text-gray-600 text-sm text-center py-4">Нет сигналов по главам</div>
          )}
        </div>
      )}

      {/* ── Tab: Forecast ── */}
      {tab === 'forecast' && (
        <div className="p-4 space-y-3">
          {/* Scenarios */}
          <div>
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">
              Сценарии P&L (1 контракт = 100 акций)
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { label: '+10% акция', val: f.scenario_bull, icon: '▲' },
                { label: 'Флэт (0%)', val: f.scenario_flat, icon: '—' },
                { label: '−10% акция', val: f.scenario_bear, icon: '▼' },
              ].map(s => (
                <div key={s.label} className="bg-gray-800/60 rounded-xl p-3 text-center">
                  <div className="text-gray-500 mb-1">{s.label}</div>
                  <div className={`text-lg font-bold ${pnlColor(s.val)}`}>{fmt$(s.val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-1.5 text-xs">
            {[
              { label: 'Ожидаемая стоимость (EV)',     val: fmt$(f.expected_value),   color: pnlColor(f.expected_value), hint: 'P(прибыль)×avg_gain − P(убыток)×премия' },
              { label: 'Вероятность прибыли (≈|Δ|)',   val: `${(f.prob_profit*100).toFixed(0)}%`,  color: 'text-white', hint: 'Дельта как прокси ITM вероятности' },
              { label: 'Безубыток (BEP)',               val: `$${f.breakeven.toFixed(2)} (${f.breakeven_move_pct > 0 ? '+' : ''}${f.breakeven_move_pct.toFixed(1)}%)`, color: 'text-white', hint: 'Цена акции для нулевого P&L' },
              { label: 'BEP в ед. σ',                  val: `${f.breakeven_vs_1sd.toFixed(2)}σ`,  color: f.breakeven_vs_1sd > 1.5 ? 'text-red-400' : f.breakeven_vs_1sd < 0.8 ? 'text-green-400' : 'text-white', hint: 'Меньше 1σ = достижимо в рамках ожид. движения' },
              { label: 'Ожидаемое движение (1σ)',       val: `±$${f.expected_move_1sd.toFixed(2)}`, color: 'text-gray-300', hint: `IV × √(DTE/365) × цена` },
              { label: 'Макс. прибыль (оценка)',        val: fmt$(f.max_profit),       color: 'text-green-400', hint: 'При движении 2× ожидаемого' },
              { label: 'Макс. убыток',                  val: `-$${f.max_loss.toFixed(0)}`, color: 'text-red-400', hint: 'Вся уплаченная премия' },
              { label: 'Тета-потери до экспирации',     val: `-$${f.theta_drag_total.toFixed(0)}`, color: 'text-orange-400', hint: 'Θ/день × DTE × 100' },
              { label: 'Годовая доходность (при 50%)',  val: `${f.annualized_return_if_target.toFixed(0)}%`, color: 'text-blue-400', hint: 'Аннуализированная при захвате 50% макс. прибыли' },
            ].map(m => (
              <div key={m.label} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-700/30">
                <div>
                  <div className="text-gray-400">{m.label}</div>
                  <div className="text-gray-600 text-xs">{m.hint}</div>
                </div>
                <span className={`font-semibold shrink-0 ${m.color}`}>{m.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ticker Result Section ──────────────────────────────────────────────────────

function TickerSection({ result }: { result: ScanTickerResult }) {
  const [collapsed, setCollapsed] = useState(false)
  const bestScore = result.candidates[0]?.composite_score ?? 0

  return (
    <div className="card space-y-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xl font-bold text-white">{result.ticker}</span>
            {result.current_price > 0 && (
              <span className="text-gray-400 ml-3 font-mono">${result.current_price.toFixed(2)}</span>
            )}
          </div>
          <div className="flex gap-3 text-xs">
            {result.iv_rank != null && (
              <span className={`px-2 py-0.5 rounded ${result.iv_rank > 60 ? 'bg-red-500/15 text-red-400' : result.iv_rank < 30 ? 'bg-green-500/15 text-green-400' : 'bg-gray-700 text-gray-300'}`}>
                IV Rank {result.iv_rank.toFixed(0)}
              </span>
            )}
            {result.hv_30 != null && (
              <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                HV30 {(result.hv_30 * 100).toFixed(1)}%
              </span>
            )}
            <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300">
              {result.candidates.length} кандидата
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {result.candidates.length > 0 && (
            <div className={`text-lg font-bold ${scoreColor(bestScore)}`}>
              {bestScore.toFixed(0)}
            </div>
          )}
          <span className="text-gray-500 text-sm">{collapsed ? '▼' : '▲'}</span>
        </div>
      </div>

      {result.error && (
        <div className="text-red-400 text-sm bg-red-900/20 rounded-lg p-3">
          Ошибка: {result.error}
        </div>
      )}

      {!collapsed && result.candidates.length === 0 && !result.error && (
        <div className="text-gray-500 text-sm text-center py-4">
          Нет подходящих кандидатов по заданным фильтрам
        </div>
      )}

      {!collapsed && result.candidates.map((c, i) => (
        <CandidateCard key={i} c={c} />
      ))}
    </div>
  )
}

// ── Main Scanner Page ──────────────────────────────────────────────────────────

export default function Scanner() {
  const [tickerInput, setTickerInput] = useState('')
  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  const [strategy, setStrategy] = useState('any')
  const [minDte, setMinDte] = useState(7)
  const [maxDte, setMaxDte] = useState(45)
  const [minVolume, setMinVolume] = useState(10)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ScanTickerResult[] | null>(null)
  const [totalCandidates, setTotalCandidates] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [scanTime, setScanTime] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addTicker = (raw: string) => {
    const tickers = raw
      .toUpperCase()
      .split(/[\s,;]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && /^[A-Z]{1,5}$/.test(t))
    const next = [...new Set([...selectedTickers, ...tickers])]
    setSelectedTickers(next.slice(0, 20))
    setTickerInput('')
    inputRef.current?.focus()
  }

  const removeTicker = (t: string) => {
    setSelectedTickers(prev => prev.filter(x => x !== t))
  }

  const loadWatchlist = (name: string) => {
    setSelectedTickers(WATCHLISTS[name])
  }

  const handleScan = async () => {
    if (selectedTickers.length === 0) return
    setLoading(true)
    setError(null)
    setResults(null)
    const t0 = Date.now()
    try {
      const res = await runScan({
        tickers: selectedTickers,
        min_dte: minDte,
        max_dte: maxDte,
        min_volume: minVolume,
        min_open_interest: 50,
        strategies: [strategy],
      })
      setResults(res.results)
      setTotalCandidates(res.total_candidates)
      setScanTime(Date.now() - t0)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Ошибка сканирования')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Сканер опционов</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Поиск лучших опционных сетапов с оценкой по главам книги «Trading Volatility» (Colin Bennett)
          и прогнозом прибыли.
        </p>
      </div>

      {/* Config panel */}
      <div className="card space-y-4">
        {/* Watchlist presets */}
        <div>
          <div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Вочлисты</div>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(WATCHLISTS).map(name => (
              <button
                key={name}
                onClick={() => loadWatchlist(name)}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Ticker input */}
        <div>
          <div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Тикеры</div>
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
              placeholder="AAPL, TSLA, SPY... (Enter для добавления)"
              className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => tickerInput.trim() && addTicker(tickerInput)}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Добавить
            </button>
          </div>

          {selectedTickers.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {selectedTickers.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs"
                >
                  {t}
                  <button onClick={() => removeTicker(t)} className="hover:text-white ml-0.5">×</button>
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
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">
              Стратегия
            </label>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
            >
              {STRATEGIES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">
              DTE мин.
            </label>
            <input
              type="number"
              value={minDte}
              onChange={e => setMinDte(Number(e.target.value))}
              min={1} max={90}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">
              DTE макс.
            </label>
            <input
              type="number"
              value={maxDte}
              onChange={e => setMaxDte(Number(e.target.value))}
              min={1} max={365}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">
              Мин. объём
            </label>
            <input
              type="number"
              value={minVolume}
              onChange={e => setMinVolume(Number(e.target.value))}
              min={0}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={loading || selectedTickers.length === 0}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Сканирование {selectedTickers.length} тикер{selectedTickers.length > 1 ? 'ов' : 'а'}...
            </>
          ) : (
            <>
              <span>🔍</span>
              Сканировать {selectedTickers.length > 0 ? `(${selectedTickers.length} тикер${selectedTickers.length > 1 ? 'ов' : ''})` : ''}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results summary */}
      {results !== null && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            Найдено <span className="text-white font-semibold">{totalCandidates}</span> кандидатов
            по <span className="text-white font-semibold">{results.length}</span> тикерам
          </span>
          {scanTime !== null && (
            <span>за {(scanTime / 1000).toFixed(1)}с</span>
          )}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div className="space-y-4">
          {results
            .slice()
            .sort((a, b) => (b.candidates[0]?.composite_score ?? 0) - (a.candidates[0]?.composite_score ?? 0))
            .map((result, i) => (
              <TickerSection key={i} result={result} />
            ))}
        </div>
      )}

      {/* Empty state */}
      {results === null && !loading && (
        <div className="text-center py-20 text-gray-600">
          <div className="text-5xl mb-4">📡</div>
          <h2 className="text-xl font-semibold text-gray-500 mb-2">Готов к сканированию</h2>
          <p className="text-sm">
            Выберите тикеры из вочлиста или введите вручную, настройте фильтры и нажмите «Сканировать».
          </p>
          <div className="mt-6 text-xs text-gray-700 max-w-lg mx-auto">
            Сканер оценивает каждый опцион по 6 главам книги «Trading Volatility» (Colin Bennett):
            VRP, Term Structure, Skew, Greeks Management, Стратегии, Вероятность/EV.
          </div>
        </div>
      )}
    </div>
  )
}
