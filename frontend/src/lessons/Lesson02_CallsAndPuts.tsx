import { useState } from 'react'
import { PayoffDiagram } from '../components/interactive/PayoffDiagram'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

export default function Lesson02({ onComplete, isCompleted }: LessonProps) {
  const [optionType, setOptionType] = useState<'call' | 'put'>('call')
  const [stockAtExpiry, setStockAtExpiry] = useState(95)
  const S = 180
  const K = 185
  const premium = optionType === 'call' ? 3.0 : 4.5

  const callStrike = 100
  const callPremium = 3.5
  const putStrike = 100
  const putPremium = 3.0
  const callPnl = Math.max(0, stockAtExpiry - callStrike) - callPremium
  const putPnl = Math.max(0, putStrike - stockAtExpiry) - putPremium

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 2</div>
        <h1 className="text-3xl font-bold text-white">Коллы и путы</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Понять разницу между
          колл-опционами (право купить) и пут-опционами (право продать), и когда использовать каждый из них.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`card cursor-pointer border-2 transition-colors ${
          optionType === 'call' ? 'border-blue-500 bg-blue-900/10' : 'border-gray-700 hover:border-gray-600'
        }`} onClick={() => setOptionType('call')}>
          <h3 className="font-bold text-blue-400 text-lg mb-2">📈 Колл-опцион</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Право <strong className="text-white">КУПИТЬ</strong> акцию по цене страйка.
            Вы получаете прибыль, когда акция растёт.
          </p>
          <div className="mt-3 text-sm space-y-1 text-gray-400">
            <div>Купить колл когда: <span className="text-green-400 font-medium">Бычий настрой</span></div>
            <div>Колл AAPL $185: право купить по $185</div>
            <div>Премия: $3.00 за акцию</div>
          </div>
        </div>

        <div className={`card cursor-pointer border-2 transition-colors ${
          optionType === 'put' ? 'border-orange-500 bg-orange-900/10' : 'border-gray-700 hover:border-gray-600'
        }`} onClick={() => setOptionType('put')}>
          <h3 className="font-bold text-orange-400 text-lg mb-2">📉 Пут-опцион</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Право <strong className="text-white">ПРОДАТЬ</strong> акцию по цене страйка.
            Вы получаете прибыль, когда акция падает.
          </p>
          <div className="mt-3 text-sm space-y-1 text-gray-400">
            <div>Купить пут когда: <span className="text-red-400 font-medium">Медвежий настрой</span></div>
            <div>Пут AAPL $185: право продать по $185</div>
            <div>Премия: $4.50 за акцию</div>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-gray-200">
          Диаграмма выплаты — AAPL {optionType === 'call' ? 'КОЛЛ' : 'ПУТ'} со страйком ${K}
        </h2>
        <p className="text-sm text-gray-400">
          Текущая цена AAPL: ${S}. Уплаченная премия: ${premium}. Переключайтесь между коллом и путом выше.
        </p>
        <PayoffDiagram
          K={K}
          premium={premium}
          optionType={optionType}
          currentPrice={S}
          title={`${optionType === 'call' ? 'Выплата колла' : 'Выплата пута'} при экспирации`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
          <h3 className="font-semibold text-blue-300 mb-2">Математика колл-опциона</h3>
          <div className="text-sm text-gray-300 space-y-1 font-mono">
            <div>Прибыль при экспирации = max(S - K, 0) - премия</div>
            <div>Точка безубыточности = K + премия = ${K + premium}</div>
            <div>Макс. убыток = премия = ${premium}/акция</div>
            <div>Макс. прибыль = неограничена (акция может расти до ∞)</div>
          </div>
        </div>
        <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-4">
          <h3 className="font-semibold text-orange-300 mb-2">Математика пут-опциона</h3>
          <div className="text-sm text-gray-300 space-y-1 font-mono">
            <div>Прибыль при экспирации = max(K - S, 0) - премия</div>
            <div>Точка безубыточности = K - премия = ${K - 4.5}</div>
            <div>Макс. убыток = премия = $4.50/акция</div>
            <div>Макс. прибыль = K - премия (акция падает до 0)</div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Главное: симметрия колла и пута</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Коллы и путы — зеркальное отражение друг друга. Колл приносит прибыль при росте; пут — при падении.
          Оба дают <strong className="text-white">ограниченный риск убытка</strong> (можно потерять только
          премию) и <strong className="text-white">определённый риск</strong> — в отличие от короткой позиции
          по акции, которая имеет теоретически неограниченный убыток.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">🧮 Колл vs Пут — сравнение P&L</h3>
        <p className="text-xs text-gray-400 mb-3">Страйк $100. Колл куплен за $3.50, Пут за $3.00.</p>
        <div>
          <label className="label flex justify-between">
            <span>Цена акции при экспирации</span>
            <span className="text-white font-mono text-lg">${stockAtExpiry}</span>
          </label>
          <input type="range" min="80" max="120" step="1" value={stockAtExpiry}
            onChange={e => setStockAtExpiry(Number(e.target.value))} className="w-full mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-center text-sm">
          <div className={`card ${callPnl >= 0 ? 'bg-blue-900/30 border-blue-700/30' : 'bg-gray-800'}`}>
            <div className="text-xs text-blue-400 font-semibold">ДЛИННЫЙ КОЛЛ</div>
            <div className={`text-2xl font-bold font-mono mt-2 ${callPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {callPnl >= 0 ? '+' : ''}{callPnl.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">на акцию</div>
          </div>
          <div className={`card ${putPnl >= 0 ? 'bg-orange-900/30 border-orange-700/30' : 'bg-gray-800'}`}>
            <div className="text-xs text-orange-400 font-semibold">ДЛИННЫЙ ПУТ</div>
            <div className={`text-2xl font-bold font-mono mt-2 ${putPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {putPnl >= 0 ? '+' : ''}{putPnl.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">на акцию</div>
          </div>
        </div>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> Акция на $100. Вы купили пут страйк $100 за $3.50. Акция упала до $88 при экспирации.
        </div>
        <div className="space-y-2">
          {[
            { step: '1.', text: 'Внутренняя стоимость пута = K − S', value: '$100 − $88 = $12' },
            { step: '2.', text: 'Уплачена премия', value: '−$3.50' },
            { step: '3.', text: 'Прибыль на акцию', value: '$12 − $3.50 = $8.50' },
            { step: '4.', text: 'На 1 контракт', value: '$8.50 × 100 = $850' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step.replace('.','')}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Пут заработал $850 на 12% падении акции. Колл при этом же сценарии потерял бы $350 (уплаченную премию).</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Ценообразование →'}
      </button>
    </div>
  )
}
