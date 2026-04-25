import { useState } from 'react'
import { StrategyBuilder } from '../components/interactive/StrategyBuilder'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

type SpreadPreset = 'bull_put' | 'bear_call'

const SPREAD_PRESETS: Record<SpreadPreset, {
  label: string
  description: string
  legs: { id: string; optionType: 'put' | 'call'; strike: number; premium: number; direction: 'long' | 'short'; contracts: number }[]
  credit: number
  width: number
  maxLoss: number
  maxProfit: number
  breakeven: number
  breakevenLabel: string
  sentiment: string
  sentimentColor: string
}> = {
  bull_put: {
    label: 'Бычий пут-спрэд',
    description: 'Продаём пут $95 за $4, покупаем пут $90 за $1.50. Чистый кредит $2.50. Зарабатываем если акция остаётся выше $92.50.',
    legs: [
      { id: '1', optionType: 'put', strike: 95, premium: 4, direction: 'short', contracts: 1 },
      { id: '2', optionType: 'put', strike: 90, premium: 1.5, direction: 'long', contracts: 1 },
    ],
    credit: 2.5,
    width: 5,
    maxLoss: 2.5,
    maxProfit: 2.5,
    breakeven: 92.5,
    breakevenLabel: '$92.50 (страйк − кредит)',
    sentiment: 'Бычий/Нейтральный',
    sentimentColor: 'text-green-400',
  },
  bear_call: {
    label: 'Медвежий колл-спрэд',
    description: 'Продаём колл $105 за $3, покупаем колл $110 за $1. Чистый кредит $2. Зарабатываем если акция остаётся ниже $107.',
    legs: [
      { id: '1', optionType: 'call', strike: 105, premium: 3, direction: 'short', contracts: 1 },
      { id: '2', optionType: 'call', strike: 110, premium: 1, direction: 'long', contracts: 1 },
    ],
    credit: 2,
    width: 5,
    maxLoss: 3,
    maxProfit: 2,
    breakeven: 107,
    breakevenLabel: '$107 (страйк + кредит)',
    sentiment: 'Медвежий/Нейтральный',
    sentimentColor: 'text-red-400',
  },
}

export default function Lesson11({ onComplete, isCompleted }: LessonProps) {
  const [activePreset, setActivePreset] = useState<SpreadPreset>('bull_put')
  const preset = SPREAD_PRESETS[activePreset]
  const [spreadStockPrice, setSpreadStockPrice] = useState(100)
  const sellPut = 95
  const buyPut = 90
  const netCredit = 2.50
  const spreadWidthCS = sellPut - buyPut
  const spreadPnlCS = (() => {
    if (spreadStockPrice >= sellPut) return netCredit
    if (spreadStockPrice <= buyPut) return netCredit - spreadWidthCS
    return netCredit - (sellPut - spreadStockPrice)
  })()
  const returnOnRisk = parseFloat((netCredit / (spreadWidthCS - netCredit) * 100).toFixed(1))

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 11</div>
        <h1 className="text-3xl font-bold text-white">Кредитные Спрэды</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Понять, как ограничить риск при продаже
          опционов с помощью кредитных спрэдов — профессиональный инструмент для управления риском.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-2">Проблема голой продажи опционов</h2>
        <p className="text-gray-200 text-sm leading-relaxed">
          Голая продажа пута на акцию стоимостью $100 выглядит привлекательно — собираете премию и ждёте.
          Но риск огромен: если акция упадёт до нуля, ваш убыток составит до <strong className="text-white">$10,000</strong> за контракт.
          Большинство брокеров требуют значительное обеспечение и специальный уровень разрешений.
        </p>
        <div className="mt-3 flex items-center gap-3 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
          <span className="text-2xl">⚠️</span>
          <div className="text-sm text-gray-300">
            <strong className="text-red-300">Голый шорт-пут $100:</strong> Максимальный убыток до $10,000.
            Требует маржа $5,000−$20,000. Неограниченный риск при резком обвале.
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
          <span className="text-2xl">✓</span>
          <div className="text-sm text-gray-300">
            <strong className="text-green-300">Кредитный спрэд:</strong> Максимальный убыток строго ограничен.
            Обеспечение = ширина спрэда × 100. Доступен на базовом уровне разрешений.
          </div>
        </div>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Два типа кредитных спрэдов</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-xl">
            <div className="font-semibold text-green-300 mb-1">Bull Put Spread</div>
            <div className="text-sm text-gray-300 mb-2">Бычий взгляд или нейтральный</div>
            <div className="text-xs text-gray-400 space-y-1">
              <div>→ Продаём пут выше (собираем больше)</div>
              <div>→ Покупаем пут ниже (платим меньше)</div>
              <div>→ Чистый кредит = разница премий</div>
              <div>→ Зарабатываем если акция <strong className="text-white">не падает</strong> ниже нижней ноги</div>
            </div>
          </div>
          <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-xl">
            <div className="font-semibold text-red-300 mb-1">Bear Call Spread</div>
            <div className="text-sm text-gray-300 mb-2">Медвежий взгляд или нейтральный</div>
            <div className="text-xs text-gray-400 space-y-1">
              <div>→ Продаём колл ниже (собираем больше)</div>
              <div>→ Покупаем колл выше (платим меньше)</div>
              <div>→ Чистый кредит = разница премий</div>
              <div>→ Зарабатываем если акция <strong className="text-white">не растёт</strong> выше верхней ноги</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Интерактивный конструктор спрэда</h2>
        <p className="text-sm text-gray-400 mb-4">Акция по $100. Выберите тип спрэда:</p>

        <div className="flex gap-2 mb-4">
          {(Object.keys(SPREAD_PRESETS) as SpreadPreset[]).map((key) => (
            <button
              key={key}
              onClick={() => setActivePreset(key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activePreset === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {SPREAD_PRESETS[key].label}
            </button>
          ))}
        </div>

        <div className="p-3 bg-gray-800/60 rounded-lg text-sm text-gray-300 mb-4">
          {preset.description}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">Макс. прибыль</div>
            <div className="text-green-400 font-bold">${(preset.maxProfit * 100).toFixed(0)}</div>
            <div className="text-xs text-gray-500">${preset.maxProfit}/акция</div>
          </div>
          <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">Макс. убыток</div>
            <div className="text-red-400 font-bold">${(preset.maxLoss * 100).toFixed(0)}</div>
            <div className="text-xs text-gray-500">${preset.maxLoss}/акция</div>
          </div>
          <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">Точка безубыт.</div>
            <div className="text-blue-400 font-bold">{preset.breakevenLabel}</div>
          </div>
          <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">Взгляд</div>
            <div className={`font-bold text-sm ${preset.sentimentColor}`}>{preset.sentiment}</div>
          </div>
        </div>

        <StrategyBuilder currentPrice={100} />
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Формулы кредитного спрэда</h2>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Чистый кредит', formula: 'Премия проданного опциона − Премия купленного опциона' },
            { label: 'Ширина спрэда', formula: '|Страйк 1 − Страйк 2|' },
            { label: 'Максимальная прибыль', formula: 'Чистый кредит × 100' },
            { label: 'Максимальный убыток', formula: '(Ширина − Кредит) × 100' },
            { label: 'Вероятность прибыли (прибл.)', formula: '1 − Дельта короткой ноги (примерно)' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between gap-4 p-2 bg-gray-800/60 rounded text-xs">
              <span className="text-gray-400 flex-shrink-0">{row.label}</span>
              <span className="text-gray-200 text-right font-mono">{row.formula}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод: соотношение риска к прибыли</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Типичный кредитный спрэд с шириной $5 и кредитом $2.50: вы получаете $250 за риск $250.
          Соотношение 1:1. Звучит невыгодно? Нет — потому что <strong className="text-white">вероятность
          прибыли обычно 60-70%</strong>. Вы зарабатываете если акция не достигает нижней ноги.
          Математическое преимущество — в вашу пользу, если правильно выбрать страйки.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">🧮 Бычий пут-спрэд: детальный P&L</h3>
        <p className="text-xs text-gray-400 mb-3">Продан пут $95 ($4.00), куплен пут $90 ($1.50). Кредит: $2.50. Риск: $2.50.</p>
        <div>
          <label className="label flex justify-between"><span>Цена акции при экспирации</span><span className="text-white font-mono text-lg">${spreadStockPrice}</span></label>
          <input type="range" min="82" max="108" step="1" value={spreadStockPrice} onChange={e => setSpreadStockPrice(Number(e.target.value))} className="w-full mt-1" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>$90 (макс убыток)</span><span>$92.50 (BEP)</span><span>$95+ (макс прибыль)</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-center">
          <div className={`card ${spreadPnlCS >= 0 ? 'bg-green-900/30 border-green-700/30' : 'bg-red-900/30 border-red-700/30'}`}>
            <div className="text-xs text-gray-400">P&L / акцию</div>
            <div className={`text-3xl font-bold font-mono mt-1 ${spreadPnlCS >= 0 ? 'text-green-400' : 'text-red-400'}`}>{spreadPnlCS >= 0 ? '+' : ''}{spreadPnlCS.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">На контракт: {spreadPnlCS >= 0 ? '+' : ''}{(spreadPnlCS * 100).toFixed(0)}$</div>
          </div>
          <div className="card bg-gray-800 text-left space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-400">Макс прибыль:</span><span className="text-green-400 font-mono">+$250</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Макс убыток:</span><span className="text-red-400 font-mono">-$250</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">BEP:</span><span className="text-blue-300 font-mono">$92.50</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Return/Risk:</span><span className="text-yellow-300 font-mono">{returnOnRisk}%</span></div>
          </div>
        </div>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> SPY торгуется на $450. Прогноз: нейтральный/бычий. IVR = 65. Вы продаёте медвежий колл-спрэд: продать $465 колл за $3.50, купить $470 колл за $1.80.
        </div>
        <div className="space-y-2">
          {[
            { step: 1, text: 'Кредит = продано − куплено', value: '$3.50 − $1.80 = $1.70' },
            { step: 2, text: 'Максимальная прибыль', value: '$1.70 × 100 = $170' },
            { step: 3, text: 'Максимальный убыток = (ширина − кредит) × 100', value: '($5 − $1.70) × 100 = $330' },
            { step: 4, text: 'Точка безубыточности', value: '$465 + $1.70 = $466.70' },
            { step: 5, text: 'Вероятность прибыли (дельта проданного $465 колла ≈ 0.25)', value: '≈ 75%' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Risk/Reward = $330:$170 = почти 2:1. Но при 75% вероятности прибыли это выгодная ставка. Медвежий колл-спрэд — идеален при нейтральном прогнозе и высокой IV.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Риск назначения →'}
      </button>
    </div>
  )
}
