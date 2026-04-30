import { useState, useMemo } from 'react'

// ── Black-Scholes (client-side, no API) ───────────────────────────────────────

function normcdf(x: number): number {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)
  return 0.5 * (1 + sign * y)
}

function normpdf(x: number): number {
  return Math.exp(-x*x/2) / Math.sqrt(2*Math.PI)
}

interface BSOut {
  price: number
  delta: number
  theta: number      // per calendar day, in option units
  probITM: number    // probability of expiring ITM
  timeValue: number
}

function bsCalc(S: number, K: number, dte: number, r: number, sigma: number, type: 'call'|'put'): BSOut {
  const T = dte / 365
  const intrinsic = type==='call' ? Math.max(S-K,0) : Math.max(K-S,0)
  if (T <= 0.0001) return { price: intrinsic, delta: type==='call'?(S>=K?1:0):(S<=K?-1:0), theta: 0, probITM: S>=K?1:0, timeValue: 0 }
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S/K) + (r + sigma*sigma/2)*T) / (sigma*sqrtT)
  const d2 = d1 - sigma*sqrtT
  const phi = normpdf(d1)
  let price: number, delta: number, probITM: number
  if (type === 'call') {
    price = S*normcdf(d1) - K*Math.exp(-r*T)*normcdf(d2)
    delta = normcdf(d1)
    probITM = normcdf(d2)
  } else {
    price = K*Math.exp(-r*T)*normcdf(-d2) - S*normcdf(-d1)
    delta = normcdf(d1) - 1
    probITM = normcdf(-d2)
  }
  const theta = (-(S*phi*sigma)/(2*sqrtT) - r*K*Math.exp(-r*T)*(type==='call'?normcdf(d2):normcdf(-d2))) / 365
  return { price, delta, theta, probITM, timeValue: Math.max(price - intrinsic, 0) }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtPrice = (v: number) => v < 0.01 ? v.toFixed(3) : v < 1 ? v.toFixed(2) : v.toFixed(2)
const fmtPct = (v: number, decimals=1) => `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`
const fmtDelta = (v: number) => v.toFixed(2)

function pnlBg(pnl: number, cost: number): string {
  if (pnl > cost * 0.5) return 'bg-green-500/25 border-green-500/40 text-green-300'
  if (pnl > 0) return 'bg-green-500/12 border-green-500/25 text-green-400'
  if (pnl > -cost * 0.5) return 'bg-red-500/10 border-red-500/20 text-red-400'
  return 'bg-red-500/20 border-red-500/40 text-red-300'
}

// ── Section 1: What is a strike — visual ──────────────────────────────────────

function StrikeVisual({ S, type }: { S: number; type: 'call'|'put' }) {
  const zones = [
    { label: 'Глубокий ITM', pct: -30, color: 'bg-blue-600' },
    { label: 'ITM', pct: -15, color: 'bg-blue-500/70' },
    { label: 'Слегка ITM', pct: -7, color: 'bg-blue-400/50' },
    { label: 'ATM ≈', pct: 0, color: 'bg-yellow-500' },
    { label: 'Слегка OTM', pct: 7, color: 'bg-orange-400/50' },
    { label: 'OTM', pct: 15, color: 'bg-red-400/50' },
    { label: 'Глубокий OTM', pct: 30, color: 'bg-red-600/50' },
  ]
  const strikes = type === 'call' ? zones : [...zones].reverse()

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Карта страйков (текущая цена: ${S.toFixed(0)})</div>
      <div className="flex gap-1 items-stretch">
        {strikes.map((z, i) => {
          const K = S * (1 + (type==='call' ? z.pct : -z.pct) / 100)
          const isATM = z.pct === 0
          return (
            <div key={i} className={`flex-1 rounded-lg border text-center py-3 px-1 ${isATM ? 'border-yellow-500/60 bg-yellow-500/10' : 'border-gray-700/40 bg-gray-800/40'}`}>
              <div className="text-xs text-gray-500 mb-1 leading-tight">{z.label}</div>
              <div className={`text-sm font-bold ${isATM ? 'text-yellow-400' : 'text-gray-300'}`}>${K.toFixed(0)}</div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
          <div className="text-blue-400 font-semibold mb-1">ITM (в деньгах)</div>
          <div className="text-gray-400 leading-relaxed">
            {type==='call' ? 'Страйк ниже цены акции.' : 'Страйк выше цены акции.'}
            {' '}Высокая стоимость, высокая дельта (0.55–0.99). Движется почти 1:1 с акцией.
          </div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
          <div className="text-yellow-400 font-semibold mb-1">ATM (у денег)</div>
          <div className="text-gray-400 leading-relaxed">
            Страйк ≈ цена акции. Дельта ≈ 0.50. Максимальная тета-стоимость.
            Самый ликвидный, обычно самый большой спред bid/ask.
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <div className="text-red-400 font-semibold mb-1">OTM (вне денег)</div>
          <div className="text-gray-400 leading-relaxed">
            {type==='call' ? 'Страйк выше цены акции.' : 'Страйк ниже цены акции.'}
            {' '}Дешевле, дельта 0.05–0.45. Нужно большое движение для прибыли. 80%+ OTM-опционов истекают бесполезными.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section 2: Delta as probability ──────────────────────────────────────────

function DeltaGuide() {
  const examples = [
    { delta: 0.70, label: 'ITM 0.70Δ', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25',
      prob: '70%', char: 'Дорого, но «вероятно» принесёт прибыль. Двигается ~70 центов на $1 роста акции.' },
    { delta: 0.50, label: 'ATM 0.50Δ', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25',
      prob: '50%', char: 'Как подбрасывание монеты. Максимальная временная стоимость. Идеально для продавцов.' },
    { delta: 0.30, label: 'OTM 0.30Δ', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25',
      prob: '30%', char: 'Дешевле, 30% вероятность ITM. Нужно более сильное движение. Популярен у покупателей.' },
    { delta: 0.15, label: 'OTM 0.15Δ', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25',
      prob: '15%', char: 'Лотерейный билет. 85% шанс истечь в ноль. Иногда 5-10x, но очень редко.' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Дельта = вероятность прибыли</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Дельта не просто «скорость движения цены» — это приблизительная вероятность того, что опцион истечёт ITM.
          Дельта 0.30 означает ~30% шанс прибыли при удержании до экспирации.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {examples.map(e => (
          <div key={e.label} className={`border rounded-xl p-3 ${e.bg}`}>
            <div className={`text-sm font-bold mb-1 ${e.color}`}>{e.label}</div>
            <div className="text-2xl font-bold text-white mb-2">{e.prob}</div>
            <div className="text-xs text-gray-400 leading-relaxed">{e.char}</div>
          </div>
        ))}
      </div>
      <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4 text-sm text-gray-400 leading-relaxed">
        <span className="text-white font-medium">Ключевое правило: </span>
        Покупатели опционов хотят дельту 0.30–0.50 (достаточно шансов, но не слишком дорого).
        Продавцы опционов хотят дельту 0.20–0.30 (большинство сделок истечёт бесполезными — это и есть цель).
      </div>
    </div>
  )
}

// ── Section 3: Theta decay chart ─────────────────────────────────────────────

function ThetaChart({ S, sigma, r }: { S: number; sigma: number; r: number }) {
  const W = 560, H = 200, PAD = { l: 40, r: 16, t: 12, b: 32 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const curves = [
    { label: 'ATM (K=S)', K: S, color: '#eab308' },
    { label: '10% OTM', K: S * 1.10, color: '#f97316' },
    { label: '20% OTM', K: S * 1.20, color: '#ef4444' },
  ]

  const maxDte = 90
  const points = (K: number) =>
    Array.from({ length: maxDte + 1 }, (_, dte) => ({
      dte,
      tv: bsCalc(S, K, dte, r, sigma, 'call').timeValue,
    }))

  const allPoints = curves.flatMap(c => points(c.K))
  const maxTV = Math.max(...allPoints.map(p => p.tv))

  const toX = (dte: number) => PAD.l + ((maxDte - dte) / maxDte) * innerW
  const toY = (tv: number) => PAD.t + (1 - tv / maxTV) * innerH

  const pathFor = (K: number) => {
    const pts = points(K)
    return pts.map((p, i) => `${i===0?'M':'L'}${toX(p.dte).toFixed(1)},${toY(p.tv).toFixed(1)}`).join(' ')
  }

  // X-axis ticks at 0,7,14,21,30,45,60,90 DTE
  const xTicks = [0, 7, 14, 21, 30, 45, 60, 90]

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Тета-распад: как время уничтожает стоимость</h2>
        <p className="text-sm text-gray-400">Временная стоимость опциона (не учитывая движение цены акции) — от 90 до 0 DTE.</p>
      </div>
      <div className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-4 overflow-x-auto">
        <svg width={W} height={H} className="block" viewBox={`0 0 ${W} ${H}`}>
          {/* Acceleration zone: last 30 days */}
          <rect
            x={toX(30)} y={PAD.t}
            width={toX(0) - toX(30)} height={innerH}
            fill="rgba(239,68,68,0.08)"
          />
          <text x={toX(15)} y={PAD.t + 10} textAnchor="middle" fontSize={9} fill="#ef4444" opacity={0.7}>
            Зона ускорения
          </text>

          {/* Vertical guides at 45 and 21 */}
          {[45, 21].map(d => (
            <g key={d}>
              <line x1={toX(d)} y1={PAD.t} x2={toX(d)} y2={PAD.t + innerH} stroke="#6b7280" strokeWidth={1} strokeDasharray="4,3" />
              <text x={toX(d)} y={H - 4} textAnchor="middle" fontSize={9} fill="#6b7280">{d}d</text>
            </g>
          ))}

          {/* X axis ticks */}
          {xTicks.filter(d => d !== 45 && d !== 21).map(d => (
            <text key={d} x={toX(d)} y={H - 4} textAnchor="middle" fontSize={9} fill="#4b5563">{d}d</text>
          ))}

          {/* Y axis label */}
          <text x={8} y={PAD.t + innerH / 2} textAnchor="middle" fontSize={9} fill="#4b5563" transform={`rotate(-90,8,${PAD.t + innerH/2})`}>Врем. стоимость</text>

          {/* Curves */}
          {curves.map(c => (
            <path key={c.label} d={pathFor(c.K)} fill="none" stroke={c.color} strokeWidth={2} />
          ))}

          {/* Legend */}
          {curves.map((c, i) => (
            <g key={c.label} transform={`translate(${PAD.l + 8 + i * 120},${PAD.t + 4})`}>
              <line x1={0} y1={6} x2={14} y2={6} stroke={c.color} strokeWidth={2} />
              <text x={18} y={10} fontSize={9} fill={c.color}>{c.label}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-3">
          <div className="text-yellow-400 font-semibold text-xs mb-1">Правило 45 DTE</div>
          <div className="text-gray-400 text-xs leading-relaxed">
            Продавцы премии <strong className="text-white">открывают</strong> позиции около 45 DTE — тета начинает заметно работать, но ещё не слишком агрессивна.
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-3">
          <div className="text-orange-400 font-semibold text-xs mb-1">Правило 21 DTE</div>
          <div className="text-gray-400 text-xs leading-relaxed">
            Продавцы <strong className="text-white">закрывают</strong> при 21 DTE — фиксируют ~50-75% прибыли, избегают гамма-риска (дни перед экспирацией непредсказуемы).
          </div>
        </div>
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3">
          <div className="text-red-400 font-semibold text-xs mb-1">Последние 7 дней</div>
          <div className="text-gray-400 text-xs leading-relaxed">
            Тета-распад максимален, но и <strong className="text-white">гамма максимальна</strong> — небольшое движение может удвоить или обнулить позицию. Опасная зона.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section 4: Main interactive comparison tool ───────────────────────────────

const EXPIRY_OPTIONS = [7, 14, 21, 30, 45, 60, 90]

function ComparisonTool() {
  const [S, setS] = useState(100)
  const [ivPct, setIvPct] = useState(30)
  const [type, setType] = useState<'call'|'put'>('call')
  const [forecastPct, setForecastPct] = useState(10)
  const [forecastDays, setForecastDays] = useState(30)
  const [selExp, setSelExp] = useState<number[]>([14, 30, 45])
  const r = 0.05
  const sigma = ivPct / 100

  const toggleExp = (d: number) => {
    setSelExp(prev => prev.includes(d)
      ? prev.length > 1 ? prev.filter(x=>x!==d) : prev
      : [...prev, d].sort((a,b)=>a-b).slice(0,4))
  }

  // Strikes: ATM ± steps
  const strikeSteps = type === 'call'
    ? [-20, -15, -10, -7, -5, -3, 0, 3, 5, 7, 10, 15, 20, 30]
    : [-30, -20, -15, -10, -7, -5, 0, 3, 5, 7, 10, 15, 20]

  const targetPrice = type==='call'
    ? S * (1 + forecastPct/100)
    : S * (1 - forecastPct/100)

  const rows = useMemo(() => strikeSteps.map(pct => {
    const K = parseFloat((S * (1 + pct/100)).toFixed(2))
    const moneyness = pct
    const isATM = pct === 0
    const isITM = type==='call' ? pct < 0 : pct > 0
    return {
      K, moneyness, isATM, isITM,
      cols: selExp.map(dte => {
        if (dte === 0) return null
        const entry = bsCalc(S, K, dte, r, sigma, type)
        const remainDTE = Math.max(0, dte - forecastDays)
        const exitBS = remainDTE > 0
          ? bsCalc(targetPrice, K, remainDTE, r, sigma, type)
          : { price: type==='call' ? Math.max(targetPrice-K,0) : Math.max(K-targetPrice,0) }
        const pnl = exitBS.price - entry.price
        const pnlPct = entry.price > 0 ? (pnl / entry.price) * 100 : 0
        return { dte, entry, pnl, pnlPct }
      })
    }
  }), [S, sigma, type, forecastPct, forecastDays, selExp, r])

  // Find best P&L% among all profitable
  const bestPnlPct = Math.max(...rows.flatMap(r => r.cols.map(c => c ? c.pnlPct : -Infinity)))
  const bestAbsPnl = Math.max(...rows.flatMap(r => r.cols.map(c => c ? c.pnl : -Infinity)))

  const inputCls = 'bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500 w-full'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Интерактивный сравнитель</h2>
        <p className="text-sm text-gray-400">
          Задай параметры акции и свой прогноз — таблица покажет P&L для каждого страйка и экспирации.
          Зелёный = прибыль, красный = убыток при указанном движении.
        </p>
      </div>

      {/* Input panel */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">Цена акции ($)</label>
            <input type="number" value={S} onChange={e=>setS(Math.max(1,+e.target.value))} min={1} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">Волатильность IV (%)</label>
            <div className="flex items-center gap-2">
              <input type="range" min={5} max={120} value={ivPct} onChange={e=>setIvPct(+e.target.value)} className="flex-1 accent-blue-500" />
              <span className="text-white text-sm font-bold w-10 text-right">{ivPct}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">Тип опциона</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {(['call','put'] as const).map(t => (
                <button key={t} onClick={()=>setType(t)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${type===t ? (t==='call'?'bg-green-600 text-white':'bg-red-600 text-white') : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {t==='call' ? 'CALL ▲' : 'PUT ▼'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">Сценарий</label>
            <div className="text-xs text-gray-400 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-16">Движение:</span>
                <input type="number" value={forecastPct} onChange={e=>setForecastPct(Math.max(0.1,+e.target.value))} min={0.1} max={200} step={0.5}
                  className="flex-1 bg-gray-800 text-white rounded px-2 py-1 text-sm border border-gray-700 focus:outline-none focus:border-blue-500" />
                <span>%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16">Дней:</span>
                <input type="number" value={forecastDays} onChange={e=>setForecastDays(Math.max(1,+e.target.value))} min={1} max={365}
                  className="flex-1 bg-gray-800 text-white rounded px-2 py-1 text-sm border border-gray-700 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Scenario summary */}
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-3 ${type==='call'?'bg-green-500/10 border border-green-500/25':'bg-red-500/10 border border-red-500/25'}`}>
          <span className="text-2xl">{type==='call'?'📈':'📉'}</span>
          <div>
            <span className="text-white font-semibold">Прогноз: </span>
            <span className="text-gray-300">акция {type==='call'?'вырастет на':'упадёт на'} </span>
            <span className={`font-bold ${type==='call'?'text-green-400':'text-red-400'}`}>{forecastPct}%</span>
            <span className="text-gray-300"> → </span>
            <span className="text-white font-bold">${targetPrice.toFixed(2)}</span>
            <span className="text-gray-400"> за {forecastDays} дн.</span>
          </div>
        </div>

        {/* Expiry selector */}
        <div>
          <div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Экспирации для сравнения (до 4)</div>
          <div className="flex gap-2 flex-wrap">
            {EXPIRY_OPTIONS.map(d => (
              <button key={d} onClick={()=>toggleExp(d)}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                  selExp.includes(d) ? 'bg-blue-600/25 border-blue-500/50 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                }`}>
                {d} DTE
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded-xl border border-gray-700/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-800/80 border-b border-gray-700/50">
              <th className="px-3 py-3 text-left text-gray-400 font-semibold w-28">Страйк</th>
              <th className="px-2 py-3 text-center text-gray-400 font-semibold w-14">Зона</th>
              {selExp.map(d => (
                <th key={d} colSpan={2} className="px-2 py-3 text-center text-gray-300 font-semibold border-l border-gray-700/40">
                  {d} DTE
                </th>
              ))}
            </tr>
            <tr className="bg-gray-800/50 border-b border-gray-700/50">
              <th className="px-3 py-2 text-left text-gray-500 font-normal">K / монейнесс</th>
              <th className="px-2 py-2 text-center text-gray-500 font-normal">Δ</th>
              {selExp.map(d => (
                <>
                  <th key={`${d}p`} className="px-2 py-2 text-center text-gray-500 font-normal border-l border-gray-700/30">Цена</th>
                  <th key={`${d}pl`} className="px-2 py-2 text-center text-gray-500 font-normal">P&L</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const zoneLabel = row.isATM ? 'ATM' : row.isITM ? 'ITM' : 'OTM'
              const zoneCls = row.isATM ? 'text-yellow-400 bg-yellow-500/10' : row.isITM ? 'text-blue-400 bg-blue-500/8' : 'text-gray-400'
              const rowHighlight = row.isATM ? 'bg-yellow-500/4' : ''
              return (
                <tr key={row.K} className={`border-b border-gray-700/30 hover:bg-gray-800/40 transition-colors ${rowHighlight}`}>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-white">${row.K.toFixed(2)}</div>
                    <div className="text-gray-500">{row.moneyness > 0 ? '+' : ''}{row.moneyness}%</div>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${zoneCls}`}>{zoneLabel}</span>
                  </td>
                  {row.cols.map((col, ci) => {
                    if (!col) return <td key={ci} colSpan={2} className="text-center text-gray-700 border-l border-gray-700/30">—</td>
                    const isBestPnlPct = Math.abs(col.pnlPct - bestPnlPct) < 0.01
                    const isBestAbs = Math.abs(col.pnl - bestAbsPnl) < 0.01
                    const cellBg = col.pnl > 0
                      ? (isBestPnlPct ? 'bg-green-500/30 border-green-500/50' : 'bg-green-500/10 border-green-500/20')
                      : 'bg-red-500/8 border-red-500/15'
                    const pnlText = col.pnl > 0 ? 'text-green-400' : 'text-red-400'
                    return (
                      <>
                        <td key={`${ci}p`} className="px-2 py-2.5 text-center border-l border-gray-700/30">
                          <div className="text-gray-200 font-medium">${fmtPrice(col.entry.price)}</div>
                          <div className="text-gray-500">Δ{fmtDelta(Math.abs(col.entry.delta))}</div>
                        </td>
                        <td key={`${ci}pl`} className="px-1.5 py-2.5 text-center">
                          <div className={`rounded-lg border px-1.5 py-1 ${cellBg}`}>
                            <div className={`font-bold ${pnlText}`}>
                              {col.pnl >= 0 ? '+' : ''}{col.pnl.toFixed(2)}
                            </div>
                            <div className={`text-xs ${pnlText} opacity-80`}>
                              {fmtPct(col.pnlPct, 0)}
                            </div>
                            {isBestPnlPct && col.pnl > 0 && (
                              <div className="text-xs text-yellow-400 mt-0.5">★ лучший %</div>
                            )}
                            {isBestAbs && !isBestPnlPct && col.pnl > 0 && (
                              <div className="text-xs text-blue-400 mt-0.5">★ макс $</div>
                            )}
                          </div>
                        </td>
                      </>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Insight panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4 space-y-2">
          <div className="text-white font-semibold">📊 Что показывает таблица</div>
          <ul className="text-gray-400 text-xs space-y-1.5 leading-relaxed">
            <li>• <span className="text-green-400">Зелёный</span> = позиция в плюсе при твоём сценарии</li>
            <li>• <span className="text-red-400">Красный</span> = убыток даже если прогноз сбылся (нужно больше движения)</li>
            <li>• <span className="text-yellow-400">★ лучший %</span> = максимальный % доходности (но часто самый рискованный)</li>
            <li>• <span className="text-blue-400">★ макс $</span> = максимальная абсолютная прибыль</li>
            <li>• P&L считается <strong className="text-white">при достижении цели на день {forecastDays}</strong> и закрытии позиции</li>
          </ul>
        </div>
        <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 space-y-2">
          <div className="text-blue-300 font-semibold">💡 Как читать результаты</div>
          <ul className="text-gray-400 text-xs space-y-1.5 leading-relaxed">
            <li>• Дальний OTM даёт высокий % но часто убыточен — нужно слишком большое движение</li>
            <li>• Дольше DTE = дороже, но форgiving timing — можно ждать дольше</li>
            <li>• Короткий DTE дешевле, но тета съедает стоимость быстрее</li>
            <li>• Оптимум для покупателя: дельта 0.35–0.50, DTE 30–60 дней</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Section 5: Cheat sheet ────────────────────────────────────────────────────

function CheatSheet() {
  const rules = [
    {
      scenario: 'Сильный рост (бычий)',
      icon: '🚀',
      color: 'border-green-500/30 bg-green-500/5',
      headerColor: 'text-green-400',
      strike: 'ATM или слегка OTM (дельта 0.40–0.55)',
      expiry: '30–60 DTE',
      why: 'Выгодный баланс цены и вероятности. Если прогноз правильный — большая прибыль.',
    },
    {
      scenario: 'Умеренный рост',
      icon: '📈',
      color: 'border-blue-500/30 bg-blue-500/5',
      headerColor: 'text-blue-400',
      strike: 'OTM (дельта 0.25–0.40)',
      expiry: '30–45 DTE',
      why: 'Дешевле, но нужно заметное движение. Хорошее соотношение риска и прибыли.',
    },
    {
      scenario: 'Лотерейная ставка',
      icon: '🎰',
      color: 'border-orange-500/30 bg-orange-500/5',
      headerColor: 'text-orange-400',
      strike: 'Далёкий OTM (дельта 0.10–0.20)',
      expiry: '14–30 DTE',
      why: 'Только при ожидании взрывного движения (earnings, FDA, M&A). 80%+ = полный убыток.',
    },
    {
      scenario: 'Продажа премии (нейтральный)',
      icon: '🏦',
      color: 'border-purple-500/30 bg-purple-500/5',
      headerColor: 'text-purple-400',
      strike: 'OTM пут или колл (дельта 0.20–0.30)',
      expiry: '30–45 DTE, закрывать при 21 DTE',
      why: 'Используешь распад времени в свою пользу. Высокий IV Rank = дорогая премия = хорошая сделка.',
    },
    {
      scenario: 'Покрытый колл',
      icon: '🛡',
      color: 'border-teal-500/30 bg-teal-500/5',
      headerColor: 'text-teal-400',
      strike: 'OTM на 5–10% (дельта 0.25–0.35)',
      expiry: '30–45 DTE, ежемесячно',
      why: 'Продаёшь право купить свои акции по более высокой цене. Дополнительный доход.',
    },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Шпаргалка: сценарий → страйк → экспирация</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rules.map(r => (
          <div key={r.scenario} className={`border rounded-xl p-4 ${r.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{r.icon}</span>
              <span className={`font-semibold ${r.headerColor}`}>{r.scenario}</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0 w-20">Страйк:</span>
                <span className="text-gray-200">{r.strike}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 shrink-0 w-20">Экспирация:</span>
                <span className="text-gray-200">{r.expiry}</span>
              </div>
              <div className="flex gap-2 pt-1 border-t border-gray-700/40">
                <span className="text-gray-500 shrink-0 w-20">Почему:</span>
                <span className="text-gray-400 leading-relaxed">{r.why}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section 6: Common mistakes ────────────────────────────────────────────────

function CommonMistakes() {
  const mistakes = [
    {
      icon: '😱',
      title: 'Купил дешёвый OTM — акция выросла, я в минусе',
      bg: 'bg-red-500/8 border-red-500/20',
      explain: 'Купил 0.10Δ колл за $0.30. Акция выросла на 3%. Но до страйка ещё далеко, плюс тета съела $0.15 за 10 дней. Результат: опцион стоит $0.18 — убыток 40%, хотя прогноз сбылся.',
      lesson: 'Для небольшого движения нужна дельта 0.35–0.50. Дешёвый OTM требует взрывного движения.',
    },
    {
      icon: '⌛',
      title: 'Купил недельный опцион — акция пошла куда надо, но через 10 дней',
      bg: 'bg-orange-500/8 border-orange-500/20',
      explain: 'Купил 7-дневный ATM колл за $2.00 в понедельник. Акция выросла в нужную сторону — но только на следующей неделе. К экспирации опцион истёк бесполезным (−$200 на 1 контракт).',
      lesson: 'Время — враг покупателя. DTE должен быть в 2–3 раза больше ожидаемого сценария.',
    },
    {
      icon: '📊',
      title: 'Продал OTM пут с низким IV — акция упала и пришли к страйку',
      bg: 'bg-yellow-500/8 border-yellow-500/20',
      explain: 'IV Rank был 20 (низкий). Продал $5 премии. Акция упала, IV взлетел до 80 — опцион теперь стоит $25. Убыток $20 на $5 собранной премии.',
      lesson: 'Продавай премию только при IV Rank > 40. Низкий IV = ты продаёшь слишком дёшево.',
    },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Типичные ошибки начинающих</h2>
      <div className="space-y-4">
        {mistakes.map(m => (
          <div key={m.title} className={`border rounded-xl p-4 ${m.bg}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{m.icon}</span>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-white">{m.title}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{m.explain}</div>
                <div className="text-xs bg-gray-900/50 border border-gray-700/40 rounded-lg px-3 py-2 leading-relaxed">
                  <span className="text-green-400 font-semibold">Урок: </span>
                  <span className="text-gray-300">{m.lesson}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OptionLab() {
  const [labS, setLabS] = useState(100)
  const [labIv, setLabIv] = useState(30)
  const [labType] = useState<'call'|'put'>('call')

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Лаборатория опционов</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Интерактивный гид по выбору страйка и экспирации. Все расчёты — в реальном времени прямо в браузере.
        </p>
      </div>

      {/* Strike visual */}
      <section className="card space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold text-white">Что такое страйк: ITM, ATM, OTM</h2>
          <div className="flex items-center gap-3 text-sm">
            <label className="text-gray-400">Цена акции:</label>
            <input type="number" value={labS} onChange={e=>setLabS(Math.max(1,+e.target.value))} min={1}
              className="w-20 bg-gray-800 text-white rounded-lg px-2 py-1 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm" />
          </div>
        </div>
        <StrikeVisual S={labS} type={labType} />
      </section>

      {/* Delta guide */}
      <section className="card">
        <DeltaGuide />
      </section>

      {/* Comparison tool */}
      <section className="card">
        <ComparisonTool />
      </section>

      {/* Theta chart */}
      <section className="card">
        <ThetaChart S={labS} sigma={labIv/100} r={0.05} />
        <div className="mt-4">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">IV для графика (%)</label>
          <div className="flex items-center gap-3">
            <input type="range" min={5} max={100} value={labIv} onChange={e=>setLabIv(+e.target.value)} className="w-40 accent-yellow-500" />
            <span className="text-white text-sm font-bold">{labIv}%</span>
            <span className="text-gray-500 text-xs">Чем выше IV, тем выше временная стоимость и тем больше тета</span>
          </div>
        </div>
      </section>

      {/* Cheat sheet */}
      <section className="card">
        <CheatSheet />
      </section>

      {/* Common mistakes */}
      <section className="card">
        <CommonMistakes />
      </section>
    </div>
  )
}
