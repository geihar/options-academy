import { useState } from 'react'
import { useBlackScholes } from '../hooks/useBlackScholes'
import { GreeksDashboard } from '../components/interactive/GreeksDashboard'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

export default function Lesson04({ onComplete, isCompleted }: LessonProps) {
  const [stockPrice, setStockPrice] = useState(180)
  const K = 185
  const T = 30 / 365
  const sigma = 0.30
  const r = 0.05

  const callResult = useBlackScholes({ S: stockPrice, K, T, r, sigma, optionType: 'call' })
  const putResult = useBlackScholes({ S: stockPrice, K, T, r, sigma, optionType: 'put' })

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 4</div>
        <h1 className="text-3xl font-bold text-white">Греки</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Понять греков как
          «спидометры» вашей опционной позиции — без необходимости разбираться в стоящем за ними математическом анализе.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Не начинайте с формул</h2>
        <p className="text-gray-200 leading-relaxed">
          Большинство книг по опционам открываются строкой «Delta = ∂C/∂S» — и теряют 80% читателей сразу же.
          Вместо этого думайте о греках как о <strong className="text-white">спидометрах</strong> на приборной панели автомобиля.
          Вам не нужно знать, как работает спидометр, чтобы эффективно им пользоваться.
        </p>
        <p className="text-gray-200 leading-relaxed mt-3">
          Каждый грек отвечает на простой вопрос: <em>«Если X немного изменится, как изменится мой опцион?»</em>
        </p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">
          Опцион AAPL — Панель греков в реальном времени
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          <strong>Настройки:</strong> Колл AAPL $185, 30 дней до экспирации, ИВ=30%. Двигайте цену акции и наблюдайте за обновлением всех греков.
        </p>
        <div>
          <label className="label flex justify-between">
            <span>Цена акции AAPL</span>
            <span className="text-white font-mono text-lg">${stockPrice}</span>
          </label>
          <input
            type="range" min="150" max="220" step="0.5"
            value={stockPrice}
            onChange={(e) => setStockPrice(parseFloat(e.target.value))}
            className="w-full mt-2"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>$150 (глубоко в деньгах пут)</span>
            <span>$185 (УДК)</span>
            <span>$220 (глубоко в деньгах колл)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {callResult && (
          <div>
            <h3 className="text-sm font-semibold text-blue-400 mb-2 uppercase tracking-wider">Колл-опцион</h3>
            <GreeksDashboard result={callResult} stockPrice={stockPrice} optionType="call" />
          </div>
        )}
        {putResult && (
          <div>
            <h3 className="text-sm font-semibold text-orange-400 mb-2 uppercase tracking-wider">Пут-опцион</h3>
            <GreeksDashboard result={putResult} stockPrice={stockPrice} optionType="put" />
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-gray-200">Краткий справочник по грекам</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Грек</th>
                <th className="text-left py-2 pr-4">Измеряет</th>
                <th className="text-left py-2">Простым языком</th>
              </tr>
            </thead>
            <tbody className="space-y-1">
              {[
                { g: 'Delta (δ)', m: 'Чувствительность к цене', e: 'Акция +$1 → опцион +$delta' },
                { g: 'Gamma (γ)', m: 'Ускорение дельты', e: 'Как быстро меняется дельта' },
                { g: 'Theta (θ)', m: 'Временной распад', e: 'Опцион теряет $theta в день только от хода времени' },
                { g: 'Vega (ν)', m: 'Чувствительность к волатильности', e: 'ИВ +1% → опцион +$vega' },
                { g: 'Rho (ρ)', m: 'Чувствительность к процентным ставкам', e: 'Ставки +1% → опцион меняется на $rho' },
              ].map((row) => (
                <tr key={row.g} className="border-b border-gray-800">
                  <td className="py-2 pr-4 font-mono text-blue-300">{row.g}</td>
                  <td className="py-2 pr-4 text-gray-300">{row.m}</td>
                  <td className="py-2 text-gray-400">{row.e}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод: дельта на разных страйках</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Обратите внимание, как дельта меняется при движении цены акции: вблизи страйка (УДК) дельта ≈ 0.50;
          глубоко в деньгах приближается к 1.0 (ведёт себя как акция); глубоко вне денег приближается к 0 (лотерейный билет).
          Дельта также приблизительно равна вероятности истечения в деньгах.
        </p>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> Ваш колл AAPL: дельта=0.42, гамма=0.04, тета=−$0.09/день, вега=$0.18. AAPL выросла на $4 за 1 день, IV не изменилась.
        </div>
        <div className="space-y-2">
          {[
            { step: '1.', text: 'Дельта P&L: 0.42 × $4', value: '+$1.68' },
            { step: '2.', text: 'Гамма поправка: 0.5 × 0.04 × $4²', value: '+$0.32' },
            { step: '3.', text: 'Тета (время): −$0.09 × 1 день', value: '−$0.09' },
            { step: '4.', text: 'Итого P&L на акцию', value: '$1.68 + $0.32 − $0.09 = +$1.91' },
            { step: '5.', text: 'На 1 контракт (100 акций)', value: '+$191' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step.replace('.','')}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Греки позволяют предсказать изменение стоимости ДО того как рынок откроется. Расхождение с реальностью = эффект других факторов (IV, нелинейности).</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Временной распад →'}
      </button>
    </div>
  )
}
