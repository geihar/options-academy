import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useBlackScholes } from '../hooks/useBlackScholes'
import { PayoffDiagram } from '../components/interactive/PayoffDiagram'
import { GreeksDashboard } from '../components/interactive/GreeksDashboard'
import { ThetaDecayChart } from '../components/interactive/ThetaDecayChart'
import { VolatilitySlider } from '../components/interactive/VolatilitySlider'
import { runStrategyWizard, WizardMatch, WizardExcluded, WizardResponse, StrategyLeg } from '../api/client'
import { computeMultiLegPayoff, findBreakevens } from '../lib/blackScholes'

// ── Greek direction tooltips ────────────────────────────────────────────────────

const GREEK_TOOLTIPS: Record<string, Record<string, string>> = {
  delta: {
    positive: "Position gains when the stock rises. You need the stock to go your direction — delta works with you. Rule: ATM options have delta ≈ 0.50; deep-ITM approaches 1.0.",
    negative: "Position gains when the stock falls. You profit from declines. Rule: Put delta runs from 0 to −1; −0.50 means you gain $50 per $1 fall on 1 contract.",
    near_zero: "Minimal exposure to stock direction — this strategy profits from time decay or IV changes, not from the stock moving. Rule: Stay neutral if the stock stays range-bound.",
  },
  gamma: {
    positive: "Your delta accelerates as the stock moves in your favor. Gains compound when right, but losses compound when wrong. Rule: Gamma spikes sharply in the last 2 weeks — extra caution near expiry.",
    negative: "Your position stays relatively stable as the stock moves. This is the premium-seller's advantage: no runaway losses from delta alone. Rule: Negative gamma = prefer slow, calm markets.",
  },
  theta: {
    positive: "Every calendar day adds money to this position from time decay alone — even if the stock doesn't move. This is the premium-seller's income stream. Rule: At 21 DTE, theta accelerates; close before then to lock in gains.",
    negative: "Every day costs this position money from time decay alone. The stock must move fast enough to overcome this daily drag. Rule: Theta doubles in the last 30 days — never hold long options past 21 DTE without a plan.",
  },
  vega: {
    positive: "Rising implied volatility benefits this position. If IV expands after entry, you gain on two fronts: stock move + IV expansion. Rule: Buy options when IVR < 30 — cheap insurance that can appreciate.",
    negative: "Rising implied volatility hurts this position. A sudden IV spike is your enemy. Rule: Sell premium when IVR > 50 — you collect inflated premium that deflates as IV normalizes.",
    near_zero: "This position has low sensitivity to IV changes. The spread structure neutralizes most vega. Rule: Spreads are less affected by IV environment than naked long or short positions.",
  },
}

function greekTooltip(greek: string, dir: string): string {
  return GREEK_TOOLTIPS[greek]?.[dir] ?? `${greek} direction: ${dir}`
}

// ── Greek direction badge ───────────────────────────────────────────────────────

function GreekBadge({ name, dir }: { name: string; dir: string }) {
  const [show, setShow] = useState(false)
  const color = dir === 'positive' ? 'text-green-400 border-green-500/40 bg-green-500/10'
    : dir === 'negative' ? 'text-red-400 border-red-500/40 bg-red-500/10'
    : 'text-gray-400 border-gray-600 bg-gray-800/50'
  const symbol = dir === 'positive' ? '+' : dir === 'negative' ? '−' : '≈'
  const tooltip = greekTooltip(name, dir)

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-help ${color}`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <span className="font-mono">{symbol}</span>
        <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
        <span className="opacity-50 text-xs">ℹ</span>
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-gray-200 shadow-xl pointer-events-none leading-relaxed">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 border-r border-b border-gray-700 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  )
}

// ── Multi-leg payoff chart ──────────────────────────────────────────────────────

function MultiLegPayoffChart({ S, legs }: { S: number; legs: StrategyLeg[] }) {
  const data = useMemo(
    () => computeMultiLegPayoff(S, legs as any),
    [S, legs],
  )
  const breakevens = useMemo(() => findBreakevens(data), [data])
  const maxProfit = useMemo(() => Math.max(...data.map(d => d.pnl)), [data])
  const maxLoss = useMemo(() => Math.min(...data.map(d => d.pnl)), [data])

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const pnl = payload[0].value as number
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs">
        <div className="text-gray-400">Stock: ${payload[0].payload.stockPrice.toFixed(2)}</div>
        <div className={`font-bold mt-0.5 ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          P&L: {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="stockPrice" tickFormatter={v => `$${v.toFixed(0)}`} stroke="#9CA3AF" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={v => `$${v.toFixed(0)}`} stroke="#9CA3AF" tick={{ fontSize: 10 }} />
          <RTooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 4" />
          <ReferenceLine x={S} stroke="#3B82F6" strokeDasharray="4 4" label={{ value: 'Сейчас', fill: '#3B82F6', fontSize: 10 }} />
          {breakevens.map((bp, i) => (
            <ReferenceLine key={i} x={bp} stroke="#10B981" strokeDasharray="4 4"
              label={{ value: `BE $${bp.toFixed(0)}`, fill: '#10B981', fontSize: 10 }} />
          ))}
          <Line type="monotone" dataKey="pnl" stroke="#60A5FA" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-xs mt-2 justify-center text-gray-400 flex-wrap">
        {maxProfit > 0 && maxProfit < 1e6 && (
          <span className="text-green-400">Макс. прибыль: +${maxProfit.toFixed(0)}</span>
        )}
        {maxProfit >= 1e6 && <span className="text-green-400">Макс. прибыль: Неограничена</span>}
        {breakevens.length > 0 && (
          <span className="text-emerald-400">Безубыток: {breakevens.map(b => `$${b.toFixed(0)}`).join(' / ')}</span>
        )}
        <span className="text-red-400">Макс. убыток: ${Math.abs(maxLoss).toFixed(0)}</span>
      </div>
    </div>
  )
}

// ── Scenario P&L row ────────────────────────────────────────────────────────────

function ScenarioRow({ S, legs }: { S: number; legs: StrategyLeg[] }) {
  const data = useMemo(() => computeMultiLegPayoff(S, legs as any), [S, legs])
  const findPnl = (targetS: number) => {
    const point = data.reduce((best, curr) =>
      Math.abs(curr.stockPrice - targetS) < Math.abs(best.stockPrice - targetS) ? curr : best
    )
    return point.pnl
  }
  const scenarios = [
    { label: '−10%', price: S * 0.90 },
    { label: '−5%',  price: S * 0.95 },
    { label: 'Флэт', price: S },
    { label: '+5%',  price: S * 1.05 },
    { label: '+10%', price: S * 1.10 },
  ]

  return (
    <div>
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">P&L при экспирации (1 контракт)</div>
      <div className="grid grid-cols-5 gap-1.5 text-xs">
        {scenarios.map(s => {
          const pnl = findPnl(s.price)
          return (
            <div key={s.label} className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-gray-500 mb-0.5">{s.label}</div>
              <div className={`font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Exit guidance ───────────────────────────────────────────────────────────────

const SELLER_IDS = new Set(['covered_call', 'cash_secured_put', 'iron_condor', 'short_straddle'])

function ExitGuidance({ strategy_id }: { strategy_id: string }) {
  const isSeller = SELLER_IDS.has(strategy_id)
  return (
    <div className="space-y-2 text-xs">
      <div className="bg-green-500/8 border border-green-500/20 rounded-lg p-3">
        <div className="text-green-400 font-semibold mb-1">Цель по прибыли</div>
        <div className="text-gray-400 leading-relaxed">
          {isSeller
            ? 'Закрывайте при достижении 50% от максимальной прибыли. Это резко снижает риск разворота, сохраняя большую часть дохода.'
            : 'Зафиксируйте прибыль когда позиция удвоилась. Не держите до экспирации — тета и гамма делают последние дни непредсказуемыми.'}
        </div>
      </div>
      <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3">
        <div className="text-red-400 font-semibold mb-1">Стоп-лосс</div>
        <div className="text-gray-400 leading-relaxed">
          {isSeller
            ? 'Закрывайте если позиция показывает убыток 2× от собранной премии — это ограничивает потери до управляемого уровня.'
            : 'Закрывайте если позиция потеряла 50% уплаченной премии. Потеря $100 из $200 — разумный стоп для сохранения капитала.'}
        </div>
      </div>
      <div className="bg-orange-500/8 border border-orange-500/20 rounded-lg p-3">
        <div className="text-orange-400 font-semibold mb-1">Правило 21 DTE</div>
        <div className="text-gray-400 leading-relaxed">
          {isSeller
            ? 'При 21 днях до экспирации тета ускоряется, но резко растёт и гамма-риск. Фиксируйте прибыль или роллируйте позицию до этой даты.'
            : 'При 21 DTE тета поедает стоимость с ускорением. Если движения нет — закройтесь и пересмотрите тезис, не держите до нуля.'}
        </div>
      </div>
    </div>
  )
}

// ── Strategy card (enhanced) ────────────────────────────────────────────────────

type CardTab = 'use' | 'payoff' | 'greeks' | 'mistakes'

function StrategyCard({ match, S }: { match: WizardMatch; S: number }) {
  const [tab, setTab] = useState<CardTab>('use')
  const isAdvanced = match.is_advanced

  return (
    <div className={`border rounded-xl overflow-hidden ${isAdvanced ? 'border-red-500/40 bg-red-900/10' : 'border-blue-500/30 bg-blue-500/5'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">{match.icon}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold text-lg leading-none">{match.name}</span>
                {isAdvanced && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 font-semibold">
                    ⚠️ ADVANCED
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">
                  ✓ Совпадение
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{match.fit_reason}</div>
            </div>
          </div>
        </div>

        {/* IV warning */}
        {match.iv_warning && (
          <div className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/25 rounded-lg px-3 py-2">
            ⚡ {match.iv_warning}
          </div>
        )}

        {/* Advanced warning */}
        {isAdvanced && match.warning && (
          <div className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 leading-relaxed">
            {match.warning}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-t border-gray-700/40">
        {([
          { id: 'use',      label: 'Когда использовать' },
          { id: 'payoff',   label: 'Диаграмма' },
          { id: 'greeks',   label: 'Греки' },
          { id: 'mistakes', label: 'Ошибки + Выход' },
        ] as { id: CardTab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              tab === t.id ? 'text-white bg-gray-700/50 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: When to Use */}
      {tab === 'use' && (
        <div className="p-4 space-y-3">
          <div className="text-xs text-gray-300 leading-relaxed">{match.when_to_use}</div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="bg-gray-800/60 rounded-lg p-2.5 flex justify-between">
              <span className="text-gray-500">Макс. прибыль</span>
              <span className="text-green-400 font-medium text-right max-w-[55%]">{match.max_profit_label}</span>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2.5 flex justify-between">
              <span className="text-gray-500">Макс. убыток</span>
              <span className="text-red-400 font-medium text-right max-w-[55%]">{match.max_loss_label}</span>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2.5 flex justify-between">
              <span className="text-gray-500">Безубыток</span>
              <span className="text-blue-400 font-medium text-right max-w-[55%]">{match.breakeven_label}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Payoff Diagram */}
      {tab === 'payoff' && (
        <div className="p-4 space-y-4">
          <div className="text-xs text-gray-500">
            Диаграмма выплат при экспирации. Акция: <span className="text-white font-mono">${S.toFixed(2)}</span> (изменяйте в калькуляторе ниже).
          </div>
          <MultiLegPayoffChart S={S} legs={match.legs} />
          <ScenarioRow S={S} legs={match.legs} />
        </div>
      )}

      {/* Tab: Greeks */}
      {tab === 'greeks' && (
        <div className="p-4 space-y-3">
          <div className="text-xs text-gray-500 leading-relaxed mb-3">
            Знаки греков при входе в позицию. Наведите курсор для объяснения что это значит для этой конкретной стратегии.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <GreekBadge name="delta" dir={match.greeks.delta} />
            <GreekBadge name="gamma" dir={match.greeks.gamma} />
            <GreekBadge name="theta" dir={match.greeks.theta} />
            <GreekBadge name="vega"  dir={match.greeks.vega}  />
          </div>
          <div className="text-xs text-gray-600 pt-2 border-t border-gray-700/30 leading-relaxed">
            + положительный = позиция выигрывает при росте этого параметра<br/>
            − отрицательный = позиция выигрывает при падении<br/>
            ≈ нейтральный = малая чувствительность
          </div>
        </div>
      )}

      {/* Tab: Mistakes + Exit */}
      {tab === 'mistakes' && (
        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Типичные ошибки</div>
            <div className="space-y-2">
              {match.common_mistakes.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-orange-300 bg-orange-500/8 border border-orange-500/20 rounded-lg px-3 py-2">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Управление позицией</div>
            <ExitGuidance strategy_id={match.id} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Wizard question selector ────────────────────────────────────────────────────

function PillSelector({
  label, options, value, onChange,
}: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">{label}</div>
      <div className="flex gap-2 flex-wrap">
        {options.map(o => (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              value === o.value
                ? 'bg-blue-600/30 border-blue-500/50 text-blue-200'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const OUTLOOK_OPTIONS = [
  { value: 'bullish',       label: 'Сильный рост' },
  { value: 'mildly_bullish',label: 'Умеренный рост' },
  { value: 'neutral',       label: 'Боковик / Нейтрально' },
  { value: 'mildly_bearish',label: 'Умеренное падение' },
  { value: 'bearish',       label: 'Сильное падение' },
  { value: 'volatile',      label: 'Резкое движение (любое)' },
]

const RISK_OPTIONS = [
  { value: 'defined', label: 'Ограниченный риск — знаю макс. убыток с первого дня' },
  { value: 'open',    label: 'Открытый риск — готов к большему риску ради большей прибыли' },
]

const IV_OPTIONS = [
  { value: 'high',   label: 'IV высокий (IVR > 50)' },
  { value: 'low',    label: 'IV низкий (IVR < 30)' },
  { value: 'unsure', label: 'Не знаю — покажи универсальные' },
]

// ── Strategy wizard ─────────────────────────────────────────────────────────────

function StrategyWizard({ defaultIvEnv, S }: { defaultIvEnv: string; S: number }) {
  const [outlook,  setOutlook]  = useState('')
  const [riskType, setRiskType] = useState('')
  const [ivEnv,    setIvEnv]    = useState(defaultIvEnv)
  const [result,   setResult]   = useState<WizardResponse | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [showExcl, setShowExcl] = useState(false)

  const allSelected = outlook && riskType && ivEnv

  useEffect(() => {
    if (!allSelected) return
    setLoading(true)
    runStrategyWizard({ outlook, risk_type: riskType, iv_env: ivEnv })
      .then(setResult)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [outlook, riskType, ivEnv])

  // Update ivEnv when parent's defaultIvEnv changes (scanner pre-fill)
  useEffect(() => {
    if (defaultIvEnv) setIvEnv(defaultIvEnv)
  }, [defaultIvEnv])

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Выбор стратегии: 3 вопроса</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Ответьте на 3 вопроса — система отфильтрует подходящие стратегии с объяснением почему.
        </p>
      </div>

      <PillSelector label="1. Ваш взгляд на рынок" options={OUTLOOK_OPTIONS}  value={outlook}  onChange={setOutlook} />
      <PillSelector label="2. Риск-аппетит"         options={RISK_OPTIONS}    value={riskType} onChange={setRiskType} />
      <PillSelector label="3. Среда волатильности"  options={IV_OPTIONS}      value={ivEnv}    onChange={setIvEnv} />

      {riskType === 'open' && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 leading-relaxed">
          ⚠️ <strong>Открытый риск</strong> включает стратегии с теоретически неограниченным убытком (напр. Short Straddle).
          Только для трейдеров с опытом управления позицией и чётким стоп-лоссом.
        </div>
      )}

      {!allSelected && (
        <div className="text-center py-6 text-gray-600 text-sm">
          Ответьте на все 3 вопроса чтобы увидеть подходящие стратегии
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-sm">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Подбираем стратегии…
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            Найдено <span className="text-white font-semibold">{result.matched.length}</span> подходящих стратегий
          </div>

          <div className="space-y-4">
            {result.matched.map(m => (
              <StrategyCard key={m.id} match={m} S={S} />
            ))}
          </div>

          {result.excluded.length > 0 && (
            <div>
              <button
                onClick={() => setShowExcl(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
              >
                {showExcl ? '▲' : '▼'} Почему не показаны другие стратегии ({result.excluded.length})
              </button>
              {showExcl && (
                <div className="mt-3 space-y-1.5">
                  {result.excluded.map(ex => (
                    <div key={ex.id} className="flex items-center gap-2 text-xs text-gray-600 border border-gray-800 rounded-lg px-3 py-2">
                      <span>{ex.icon}</span>
                      <span className="text-gray-500 font-medium">{ex.name}</span>
                      <span>—</span>
                      <span>{ex.exclude_reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pre-fill banner ─────────────────────────────────────────────────────────────

function PreFillBanner({ ticker, price, ivr }: { ticker: string; price: number; ivr: number | null }) {
  const ivrText = ivr != null
    ? `, IVR ${ivr.toFixed(0)} → ${ivr > 50 ? 'продажа премии' : ivr < 30 ? 'покупка опционов' : 'нейтрально'}`
    : ''
  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-sm flex items-center gap-3">
      <span className="text-blue-400 text-lg shrink-0">📡</span>
      <div>
        <span className="text-blue-300 font-semibold">Предзаполнено из сканера: </span>
        <span className="text-gray-300">{ticker} ${price.toFixed(2)}{ivrText}</span>
        <span className="text-gray-500 text-xs ml-2">— параметры загружены автоматически</span>
      </div>
    </div>
  )
}

// ── Main Simulator ──────────────────────────────────────────────────────────────

export default function Simulator() {
  const [searchParams] = useSearchParams()

  // Read scanner pre-fill from URL params
  const urlS     = parseFloat(searchParams.get('S')      ?? '') || 0
  const urlSigma = parseFloat(searchParams.get('sigma')  ?? '') || 0
  const urlTicker = searchParams.get('ticker') ?? ''
  const urlIvr   = parseFloat(searchParams.get('ivr')    ?? '') || 0

  const hasPreFill = urlS > 0 && urlTicker !== ''

  // Default IV env from scanner ivr param
  const defaultIvEnv = urlIvr > 50 ? 'high' : urlIvr > 0 && urlIvr < 30 ? 'low' : ''

  // B/S Calculator state — pre-filled from URL if available
  const [S, setS]               = useState(urlS > 0 ? urlS : 185)
  const [K, setK]               = useState(urlS > 0 ? Math.round(urlS) : 185)
  const [days, setDays]         = useState(30)
  const [sigma, setSigma]       = useState(urlSigma > 0 ? urlSigma : 0.30)
  const [r, setR]               = useState(0.05)
  const [optionType, setOptionType] = useState<'call' | 'put'>('call')

  const T = days / 365
  const result = useBlackScholes({ S, K, T, r, sigma, optionType })
  const premium = result?.price ?? 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Симулятор опционов</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Мастер стратегий подберёт подходящий подход за 3 вопроса. Калькулятор ниже — для детального анализа конкретного опциона.
        </p>
      </div>

      {/* Pre-fill banner */}
      {hasPreFill && (
        <PreFillBanner ticker={urlTicker} price={urlS} ivr={urlIvr > 0 ? urlIvr : null} />
      )}

      {/* Strategy Wizard — takes stock price S so payoff charts are aligned */}
      <StrategyWizard defaultIvEnv={defaultIvEnv} S={S} />

      {/* ── Black-Scholes Calculator (unchanged from original) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Inputs */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-gray-200">Параметры опциона</h2>

          {/* Option Type */}
          <div>
            <label className="label block mb-2">Тип опциона</label>
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setOptionType('call')}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  optionType === 'call' ? 'bg-blue-600 text-white' : 'text-gray-400'
                }`}
              >
                Колл
              </button>
              <button
                onClick={() => setOptionType('put')}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  optionType === 'put' ? 'bg-orange-600 text-white' : 'text-gray-400'
                }`}
              >
                Пут
              </button>
            </div>
          </div>

          {/* Stock Price */}
          <div>
            <label className="label flex justify-between">
              <span>Цена акции (S)</span>
              <span className="text-white font-mono">${S}</span>
            </label>
            <input
              type="range" min="50" max="500" step="1"
              value={S} onChange={(e) => setS(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
            <input
              type="number" value={S} onChange={(e) => setS(parseFloat(e.target.value) || 0)}
              className="input w-full mt-2 text-sm"
            />
          </div>

          {/* Strike */}
          <div>
            <label className="label flex justify-between">
              <span>Цена страйка (K)</span>
              <span className="text-white font-mono">${K}</span>
            </label>
            <input
              type="range" min="50" max="500" step="1"
              value={K} onChange={(e) => setK(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
            <input
              type="number" value={K} onChange={(e) => setK(parseFloat(e.target.value) || 0)}
              className="input w-full mt-2 text-sm"
            />
          </div>

          {/* Days to Expiry */}
          <div>
            <label className="label flex justify-between">
              <span>Дней до экспирации</span>
              <span className="text-white font-mono">{days}d</span>
            </label>
            <input
              type="range" min="1" max="365" step="1"
              value={days} onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full mt-1"
            />
          </div>

          {/* Volatility */}
          <div>
            <label className="label flex justify-between">
              <span>Подразумеваемая волатильность (σ)</span>
              <span className="text-white font-mono">{(sigma * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range" min="0.05" max="2.0" step="0.01"
              value={sigma} onChange={(e) => setSigma(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
          </div>

          {/* Risk-free Rate */}
          <div>
            <label className="label flex justify-between">
              <span>Безрисковая ставка</span>
              <span className="text-white font-mono">{(r * 100).toFixed(1)}%</span>
            </label>
            <input
              type="range" min="0" max="0.15" step="0.001"
              value={r} onChange={(e) => setR(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
          </div>

          {/* Summary box */}
          {result && (
            <div className="bg-gray-800 rounded-xl p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Цена опциона</span>
                <span className="font-mono font-bold text-green-400">${result.price.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Точка безубыточности</span>
                <span className="font-mono text-blue-400">${result.breakeven.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Вероятность ВДК</span>
                <span className="font-mono">{(result.itmProbability * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Charts and Greeks */}
        <div className="lg:col-span-2 space-y-4">
          {result && (
            <>
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Выплата при экспирации</h3>
                <PayoffDiagram
                  K={K}
                  premium={result.price}
                  optionType={optionType}
                  currentPrice={S}
                />
              </div>

              <GreeksDashboard result={result} stockPrice={S} optionType={optionType} />

              <div className="card">
                <ThetaDecayChart
                  S={S} K={K} r={r} sigma={sigma} optionType={optionType}
                  maxDays={Math.min(days + 10, 90)}
                />
              </div>

              <VolatilitySlider
                S={S} K={K} T={T} r={r}
                optionType={optionType}
                initialSigma={sigma}
              />
            </>
          )}

          {!result && (
            <div className="card text-center py-12 text-gray-500">
              Установите корректные параметры для отображения диаграммы и греков
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
