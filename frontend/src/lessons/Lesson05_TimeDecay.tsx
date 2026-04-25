import { useState } from 'react'
import { ThetaDecayChart } from '../components/interactive/ThetaDecayChart'
import { useBlackScholes } from '../hooks/useBlackScholes'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

export default function Lesson05({ onComplete, isCompleted }: LessonProps) {
  const [sigma, setSigma] = useState(0.30)
  const [optionType, setOptionType] = useState<'call' | 'put'>('call')
  const S = 180
  const K = 185
  const r = 0.05

  const result60 = useBlackScholes({ S, K, T: 60 / 365, r, sigma, optionType })
  const result30 = useBlackScholes({ S, K, T: 30 / 365, r, sigma, optionType })
  const result7 = useBlackScholes({ S, K, T: 7 / 365, r, sigma, optionType })

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 5</div>
        <h1 className="text-3xl font-bold text-white">Временной распад (Тета)</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Понять, как опционы теряют стоимость
          с течением времени — и почему этот распад ускоряется ближе к экспирации.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Тающий кубик льда</h2>
        <p className="text-gray-200 leading-relaxed">
          Опцион похож на кубик льда. Он тает со временем — сначала медленно, затем стремительно в конце.
          «Таяние» называется <strong className="text-white">тета-распадом</strong>: опцион теряет
          стоимость каждый день при прочих равных условиях — просто потому что время идёт.
        </p>
        <p className="text-gray-200 leading-relaxed mt-3">
          Это <strong className="text-white">лучший друг продавца опционов</strong> и
          <strong className="text-white"> главный враг покупателя</strong>. Как продавец, вы собираете
          премию, которая стремится к нулю. Как покупатель, вам нужно, чтобы акция двигалась
          <em>достаточно быстро</em>, чтобы компенсировать ежедневный распад.
        </p>
      </div>

      <div className="card">
        <div className="flex gap-3 mb-4">
          <div>
            <label className="label block mb-1">Тип опциона</label>
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              {(['call', 'put'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOptionType(t)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    optionType === t
                      ? (t === 'call' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white')
                      : 'text-gray-400'
                  }`}
                >
                  {t === 'call' ? 'Колл' : 'Пут'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="label flex justify-between">
              <span>Подразумеваемая волатильность</span>
              <span className="text-white font-mono">{(sigma * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range" min="0.10" max="1.0" step="0.01"
              value={sigma} onChange={(e) => setSigma(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
          </div>
        </div>
        <ThetaDecayChart S={S} K={K} r={r} sigma={sigma} optionType={optionType} maxDays={90} />
      </div>

      {/* Comparison table */}
      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">AAPL $185 {optionType === 'call' ? 'КОЛЛ' : 'ПУТ'} — стоимость в разное время</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '60 дней', result: result60, accent: 'text-green-400' },
            { label: '30 дней', result: result30, accent: 'text-yellow-400' },
            { label: '7 дней', result: result7, accent: 'text-red-400' },
          ].map(({ label, result, accent }) => result && (
            <div key={label} className="card bg-gray-800 text-center">
              <div className="text-xs text-gray-400">{label}</div>
              <div className={`text-xl font-bold font-mono mt-1 ${accent}`}>${result.price.toFixed(3)}</div>
              <div className="text-xs text-gray-500 mt-1">θ: ${result.theta.toFixed(4)}/день</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-red-300 mb-2">Предупреждение для покупателей опционов</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Если вы купили 60-дневный опцион за ${result60?.price.toFixed(2)} и держали его 30 дней
          без движения акции, у вас теперь 30-дневный опцион стоимостью ${result30?.price.toFixed(2)}.
          Это убыток ${((result60?.price ?? 0) - (result30?.price ?? 0)).toFixed(2)} на акцию
          только от хода времени — ещё до того как акция вообще сдвинулась.
        </p>
      </div>

      <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-green-300 mb-2">Преимущество продавца</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Продавцы опционов собирают этот распад. Продавец покрытого колла или обеспеченного пута
          фактически работает в страховом бизнесе — собирает премию и рассчитывает, что время пройдёт
          без крупного неблагоприятного движения. Тета — это их «доход».
        </p>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> Вы продали 30-дневный покрытый колл за $4.20. Тета = +$0.14/день (вы получаете её). Правило: закрыть при 50% прибыли.
        </div>
        <div className="space-y-2">
          {[
            { step: '1.', text: 'Цель закрытия (50% прибыли)', value: '$4.20 × 50% = $2.10' },
            { step: '2.', text: 'Закрыть когда цена опциона снизится до', value: '$4.20 − $2.10 = $2.10' },
            { step: '3.', text: 'Дней до 50% при тета $0.14/день', value: '$2.10 / $0.14 ≈ 15 дней' },
            { step: '4.', text: 'Оставшееся время', value: '15 из 30 дней — позиция открыта ровно половину срока' },
            { step: '5.', text: 'Следующая позиция', value: 'Открываем новый 30-дневный опцион — удваиваем число сделок в год' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step.replace('.','')}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Продав 24 покрытых колла в год по $4.20 каждый, вы можете собирать $4.20 × 24 × 100 = $10,080/год с 100 акций.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Подразумеваемая волатильность →'}
      </button>
    </div>
  )
}
