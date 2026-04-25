import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

export default function Lesson01({ onComplete, isCompleted }: LessonProps) {
  const [applePrice, setApplePrice] = useState(1.0)
  const [expiryPrice, setExpiryPrice] = useState(210)

  // Опцион: заплати $0.10 за право купить яблоки по $1.00 в следующем месяце
  const strike = 1.0
  const premium = 0.10

  const callStrike = 200
  const callPremium = 4.5
  const payoff = Math.max(0, expiryPrice - callStrike) - callPremium

  const pnl = Math.max(0, applePrice - strike) - premium

  // График: П/У при разных ценах яблок
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const price = 0.5 + i * 0.05
    return {
      price: parseFloat(price.toFixed(2)),
      pnl: parseFloat((Math.max(0, price - strike) - premium).toFixed(3)),
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 1</div>
        <h1 className="text-3xl font-bold text-white">Что такое опцион?</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Понять, что такое опционный контракт,
          через простую бытовую аналогию — без математики и финансового жаргона.
        </p>
      </div>

      {/* The analogy */}
      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Аналогия с супермаркетом</h2>
        <p className="text-gray-200 leading-relaxed">
          Представьте, что сегодня яблоки стоят <strong className="text-white">$1.00</strong> в вашем местном магазине.
          Вы любите яблочный пирог и беспокоитесь, что цена может вырасти до $2.00 в следующем месяце.
        </p>
        <p className="text-gray-200 leading-relaxed mt-3">
          Владелец магазина делает вам предложение: <em>«Заплатите мне $0.10 сейчас, и я гарантирую вам право
          купить яблоки по $1.00 в следующем месяце — какой бы ни была рыночная цена.»</em>
        </p>
        <p className="text-gray-200 leading-relaxed mt-3">
          Вы только что купили <strong className="text-white">колл-опцион</strong>.
          $0.10 — это <strong className="text-white">премия</strong>.
          $1.00 — это <strong className="text-white">цена страйка</strong>.
        </p>
      </div>

      {/* Interactive */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Что происходит в конце месяца?</h2>
        <p className="text-gray-400 text-sm">Потяните ползунок, чтобы увидеть, какой станет рыночная цена яблок. Следите за изменением П/У.</p>

        <div>
          <label className="label flex justify-between">
            <span>Цена яблок в следующем месяце</span>
            <span className="text-white font-mono text-lg">${applePrice.toFixed(2)}</span>
          </label>
          <input
            type="range" min="0.50" max="2.50" step="0.01"
            value={applePrice}
            onChange={(e) => setApplePrice(parseFloat(e.target.value))}
            className="w-full mt-2"
          />
        </div>

        <div className={`rounded-xl p-4 border text-center ${
          pnl >= 0
            ? 'bg-green-900/20 border-green-700/30'
            : 'bg-red-900/20 border-red-700/30'
        }`}>
          {applePrice > strike ? (
            <div>
              <div className="text-gray-400 text-sm mb-1">Вы исполняете опцион — покупаете по $1.00, продаёте по ${applePrice.toFixed(2)}</div>
              <div className="text-3xl font-bold text-green-400">+${pnl.toFixed(2)} прибыль</div>
            </div>
          ) : (
            <div>
              <div className="text-gray-400 text-sm mb-1">Яблоки на рынке дешевле — вы не исполняете опцион</div>
              <div className="text-3xl font-bold text-red-400">-$0.10 (только премия)</div>
              <div className="text-sm text-gray-400 mt-1">Ваш максимальный убыток всегда равен только $0.10, которые вы заплатили</div>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="price" tickFormatter={(v) => `$${v}`} stroke="#9CA3AF" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v}`} stroke="#9CA3AF" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(3)}`, 'П/У']} />
            <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 4" />
            <ReferenceLine x={parseFloat(applePrice.toFixed(2))} stroke="#3B82F6" strokeDasharray="4 4" label={{ value: 'Сейчас', fill: '#3B82F6', fontSize: 10 }} />
            <Line type="monotone" dataKey="pnl" stroke="#60A5FA" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Key insight */}
      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Главное:</h3>
        <ul className="text-gray-200 space-y-1.5 text-sm list-disc list-inside">
          <li><strong className="text-white">Максимальный убыток ограничен</strong> — вы можете потерять только $0.10 премии, которую заплатили</li>
          <li><strong className="text-white">Потенциал роста теоретически неограничен</strong> — если яблоки вырастут до $10, прибыль составит $8.90</li>
          <li>У вас было <strong className="text-white">право</strong>, но не <strong className="text-white">обязанность</strong> покупать</li>
          <li>Теперь замените «яблоки» на акцию AAPL. Та же концепция, большие числа.</li>
        </ul>
      </div>

      {/* Now with a real stock */}
      <div className="card bg-gray-800">
        <h3 className="font-semibold text-gray-200 mb-2">Реальный пример: AAPL по $180</h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          Колл-опцион AAPL со <strong className="text-white">страйком $185</strong>, истекающий в следующем месяце, стоит
          примерно <strong className="text-white">$3.00</strong> (премия). Если AAPL вырастет до $200 к экспирации,
          прибыль: $200 - $185 - $3 = <strong className="text-green-400">$12 на акцию</strong>, или
          <strong className="text-green-400"> $1 200 на контракт</strong> (каждый контракт = 100 акций).
          Если AAPL останется ниже $185, вы теряете только премию $3 = <strong className="text-red-400">$300 на контракт</strong>.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">🧮 Калькулятор P&L колл-опциона</h3>
        <p className="text-xs text-gray-400 mb-3">Страйк $200, уплаченная премия $4.50. Двигайте цену акции при экспирации:</p>
        <div>
          <label className="label flex justify-between">
            <span>Цена акции при экспирации</span>
            <span className="text-white font-mono text-lg">${expiryPrice}</span>
          </label>
          <input type="range" min="180" max="240" step="1" value={expiryPrice}
            onChange={e => setExpiryPrice(Number(e.target.value))} className="w-full mt-1" />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center text-sm">
          <div className="card bg-gray-800">
            <div className="text-xs text-gray-400">Внутренняя стоимость</div>
            <div className="text-lg font-bold font-mono text-white mt-1">${Math.max(0, expiryPrice - callStrike).toFixed(2)}</div>
          </div>
          <div className="card bg-gray-800">
            <div className="text-xs text-gray-400">Уплачена премия</div>
            <div className="text-lg font-bold font-mono text-orange-400 mt-1">-${callPremium.toFixed(2)}</div>
          </div>
          <div className="card bg-gray-800">
            <div className="text-xs text-gray-400">P&L / акция</div>
            <div className={`text-lg font-bold font-mono mt-1 ${payoff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {payoff >= 0 ? '+' : ''}{payoff.toFixed(2)}
            </div>
          </div>
        </div>
        {payoff < 0 && (
          <p className="text-xs text-red-400 mt-2">Опцион истекает OTM — уплаченная премия потеряна.</p>
        )}
        {payoff >= 0 && (
          <p className="text-xs text-green-400 mt-2">Опцион ITM — прибыль = внутренняя стоимость − премия. На контракт: ${(payoff * 100).toFixed(0)}</p>
        )}
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> Вы купили колл TSLA страйк $250 за $3.50. При экспирации TSLA торгуется по $261.
        </div>
        <div className="space-y-2">
          {[
            { step: '1.', text: 'Внутренняя стоимость', value: '$261 − $250 = $11' },
            { step: '2.', text: 'Затраты (премия)', value: '−$3.50' },
            { step: '3.', text: 'Прибыль на акцию', value: '$11 − $3.50 = $7.50' },
            { step: '4.', text: 'На 1 контракт (100 акций)', value: '$7.50 × 100 = $750' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step.replace('.','')}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Инвестировав $350 (1 контракт), вы заработали $750 — доходность 214% при росте акции на 4.4%.</span>
        </div>
      </div>

      <button
        onClick={onComplete}
        className="btn-primary w-full py-3 text-base"
      >
        {isCompleted ? 'Повторение завершено ✓' : 'Следующий урок: Коллы и путы →'}
      </button>
    </div>
  )
}
