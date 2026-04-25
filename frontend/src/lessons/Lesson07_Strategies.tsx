import { useState } from 'react'
import { StrategyBuilder } from '../components/interactive/StrategyBuilder'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

const STRATEGIES = [
  {
    name: 'Длинный колл',
    sentiment: 'Бычий',
    ivEnv: 'Низкая ИВ',
    description: 'Купить колл-опцион. Прибыль при росте акции выше точки безубыточности. Ограниченный риск (премия), неограниченный потенциал.',
    bestFor: 'Сильный бычий настрой при Ранге ИВ ниже 30',
    maxLoss: 'Уплаченная премия',
    maxGain: 'Неограниченно',
  },
  {
    name: 'Длинный пут',
    sentiment: 'Медвежий',
    ivEnv: 'Низкая ИВ',
    description: 'Купить пут-опцион. Прибыль при падении акции ниже точки безубыточности. Ограниченный риск, значительный потенциал.',
    bestFor: 'Медвежий настрой или защита портфеля при низкой ИВ',
    maxLoss: 'Уплаченная премия',
    maxGain: 'Страйк - премия (акция → 0)',
  },
  {
    name: 'Покрытый колл',
    sentiment: 'Нейтральный/Слабо бычий',
    ivEnv: 'Высокая ИВ',
    description: 'Держать 100 акций + продать колл. Собирать премию как доход. Ограничивает потенциал роста страйком. Самая популярная доходная стратегия.',
    bestFor: 'Долгосрочные держатели, желающие получать доход. Высокий Ранг ИВ.',
    maxLoss: 'Цена акции - собранная премия (всё равно теряете при обвале акции)',
    maxGain: '(Страйк - цена покупки) + собранная премия',
  },
  {
    name: 'Обеспеченный пут',
    sentiment: 'Нейтральный/Слабо бычий',
    ivEnv: 'Высокая ИВ',
    description: 'Продать пут + держать наличные для покупки акций при исполнении. Получать деньги за потенциальную покупку акции по целевой цене.',
    bestFor: 'Хотите купить акцию по более низкой цене. Высокий Ранг ИВ.',
    maxLoss: 'Страйк - премия (если акция падает до 0)',
    maxGain: 'Собранная премия',
  },
  {
    name: 'Бычий колл-спрэд',
    sentiment: 'Умеренно бычий',
    ivEnv: 'Любая ИВ',
    description: 'Купить колл с нижним страйком + продать колл с верхним страйком. Снижает стоимость по сравнению с голым коллом. Ограниченная прибыль и убыток.',
    bestFor: 'Умеренный бычий взгляд, хотите снизить стоимость премии',
    maxLoss: 'Уплаченный дебет',
    maxGain: 'Ширина спрэда - дебет',
  },
  {
    name: 'Стрэддл',
    sentiment: 'Нейтральный (ожидает большое движение)',
    ivEnv: 'Только низкая ИВ',
    description: 'Купить УДК колл + купить УДК пут. Прибыль при значительном движении акции в любую сторону.',
    bestFor: 'Ожидание крупного движения без уверенности в направлении. Прибылен только при покупке в период НИЗКОЙ ИВ.',
    maxLoss: 'Обе уплаченные премии вместе',
    maxGain: 'Неограниченно в любую сторону',
  },
]

export default function Lesson07({ onComplete, isCompleted }: LessonProps) {
  const [stockFinal, setStockFinal] = useState(100)
  // Bull put spread: sell $95 put for $4, buy $90 put for $1.50
  const credit = 2.50
  const sellStrike = 95
  const buyStrike = 90
  const spreadWidth = sellStrike - buyStrike
  const spreadPnl = (() => {
    if (stockFinal >= sellStrike) return credit
    if (stockFinal <= buyStrike) return credit - spreadWidth
    return credit - (sellStrike - stockFinal)
  })()

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 7</div>
        <h1 className="text-3xl font-bold text-white">Торговые стратегии</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Изучить наиболее распространённые опционные
          стратегии, когда использовать каждую из них и как они выглядят на диаграмме выплаты.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-2">Два главных вопроса</h2>
        <p className="text-gray-200 text-sm leading-relaxed">
          Перед выбором стратегии ответьте на два вопроса:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="card bg-gray-800">
            <div className="font-semibold text-gray-200 mb-1">1. Направленный тезис</div>
            <div className="text-sm text-gray-400">Бычий? Медвежий? Нейтральный? Ожидаете крупное движение?</div>
          </div>
          <div className="card bg-gray-800">
            <div className="font-semibold text-gray-200 mb-1">2. Среда волатильности</div>
            <div className="text-sm text-gray-400">ИВ сейчас высокая или низкая? (Используйте Ранг ИВ из Урока 6)</div>
          </div>
        </div>
      </div>

      {/* Strategy cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STRATEGIES.map((s) => (
          <div key={s.name} className="card space-y-2">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-gray-100">{s.name}</h3>
              <div className="flex gap-1">
                <span className={`badge-${
                  s.sentiment.includes('Бычий') ? 'green' :
                  s.sentiment.includes('Медвежий') ? 'red' :
                  'yellow'
                }`}>{s.sentiment}</span>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{s.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-red-900/20 p-2 rounded-lg">
                <div className="text-red-300 font-medium">Макс. убыток</div>
                <div className="text-gray-300 mt-0.5">{s.maxLoss}</div>
              </div>
              <div className="bg-green-900/20 p-2 rounded-lg">
                <div className="text-green-300 font-medium">Макс. прибыль</div>
                <div className="text-gray-300 mt-0.5">{s.maxGain}</div>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              <strong className="text-gray-300">Лучше всего для:</strong> {s.bestFor}
            </div>
          </div>
        ))}
      </div>

      {/* Interactive strategy builder */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Интерактивный конструктор стратегий</h2>
        <p className="text-sm text-gray-400 mb-4">
          Выберите готовую стратегию, чтобы увидеть её диаграмму выплаты, или комбинируйте ноги вручную.
          AAPL по $185.
        </p>
        <StrategyBuilder currentPrice={185} />
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод: профили риска</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Каждая стратегия предполагает компромисс между максимальной прибылью, максимальным убытком и вероятностью прибыли.
          Стратегии с высокой вероятностью (например, продажа кредитных спрэдов) имеют ограниченную максимальную прибыль.
          Стратегии с низкой вероятностью (например, покупка глубоко вне денег коллов) имеют более высокую потенциальную доходность, но
          меньшую вероятность. Бесплатного обеда нет — только разные профили риска/доходности.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">🧮 Бычий пут-спрэд: P&L калькулятор</h3>
        <p className="text-xs text-gray-400 mb-3">Продан пут $95 за $4.00, куплен пут $90 за $1.50. Кредит: $2.50</p>
        <div>
          <label className="label flex justify-between">
            <span>Цена акции при экспирации</span>
            <span className="text-white font-mono text-lg">${stockFinal}</span>
          </label>
          <input type="range" min="82" max="108" step="1" value={stockFinal}
            onChange={e => setStockFinal(Number(e.target.value))} className="w-full mt-1" />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center text-sm">
          <div className="card bg-gray-800"><div className="text-xs text-gray-400">Макс. прибыль</div><div className="text-lg font-bold text-green-400 font-mono mt-1">+$250</div></div>
          <div className={`card ${spreadPnl >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
            <div className="text-xs text-gray-400">P&L / акцию</div>
            <div className={`text-2xl font-bold font-mono mt-1 ${spreadPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{spreadPnl >= 0 ? '+' : ''}{spreadPnl.toFixed(2)}</div>
          </div>
          <div className="card bg-gray-800"><div className="text-xs text-gray-400">Макс. убыток</div><div className="text-lg font-bold text-red-400 font-mono mt-1">−$250</div></div>
        </div>
        <div className="text-xs text-gray-500 text-center mt-2">BEP: $92.50 | Прибыль если акция {'>'} $92.50</div>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> Вы продаёте железный кондор на SPY ($450): продать $460 колл/$440 пут, купить $465 колл/$435 пут. Кредит $3.20.
        </div>
        <div className="space-y-2">
          {[
            { step: '1.', text: 'Макс прибыль = кредит × 100', value: '$320 (акция остаётся $440−$460)' },
            { step: '2.', text: 'Ширина крыла = $5 с каждой стороны', value: 'Макс убыток = ($5 − $3.20) × 100 = $180' },
            { step: '3.', text: 'BEP снизу: $440 − $3.20', value: '$436.80' },
            { step: '4.', text: 'BEP сверху: $460 + $3.20', value: '$463.20' },
            { step: '5.', text: 'Вероятность прибыли', value: '≈ 68% (спрэды за пределами 1σ движения)' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step.replace('.','')}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Risk/Reward = $180 max loss : $320 max profit = 1:1.78. При IVR {'>'} 50 это отличная структура с высокой вероятностью успеха.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Отчётность и коллапс ИВ →'}
      </button>
    </div>
  )
}
