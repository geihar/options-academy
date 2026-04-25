import { IVRankGauge } from '../components/interactive/IVRankGauge'
import { VolatilitySlider } from '../components/interactive/VolatilitySlider'
import { useState } from 'react'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

export default function Lesson06({ onComplete, isCompleted }: LessonProps) {
  const [scenario, setScenario] = useState<'low' | 'high'>('low')
  const [ivPct, setIvPct] = useState(30)
  const [stockPriceIv, setStockPriceIv] = useState(100)
  const dailyMove = (ivPct / 100 / Math.sqrt(252) * stockPriceIv)
  const weeklyMove = (ivPct / 100 / Math.sqrt(52) * stockPriceIv)
  const monthlyMove = (ivPct / 100 / Math.sqrt(12) * stockPriceIv)

  const ivRankLow = 18
  const ivRankHigh = 83

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 6</div>
        <h1 className="text-3xl font-bold text-white">Подразумеваемая волатильность</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Понять ИВ vs. Историческая волатильность,
          что такое Ранг ИВ и как использовать его для выбора между покупкой и продажей опционов.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">ИВ vs. Историческая волатильность</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold text-gray-200 mb-1">Историческая волатильность (ИВ)</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Насколько акция фактически двигалась в прошлом.
              Рассчитывается из реальных дневных изменений цены за последние 30, 60 или 90 дней.
              Это <em>ретроспективный</em> показатель — он говорит, что акция ДЕЛАЛА.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-200 mb-1">Подразумеваемая волатильность (ИВ)</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Что рынок опционов ОЖИДАЕТ в отношении будущей волатильности.
              Выводится путём обратного расчёта из цен опционов.
              Это <em>перспективный</em> показатель — он говорит, что рынок ПРОГНОЗИРУЕТ.
            </p>
          </div>
        </div>
        <div className="mt-3 p-3 bg-gray-800 rounded-lg text-sm text-gray-300">
          <strong className="text-white">Премия ИВ:</strong> Когда ИВ &gt; ИВ историческая, продавцы опционов имеют
          структурное преимущество — они собирают больше премии, чем исторически оправдано движением акции.
          Это одно из ключевых преимуществ в систематической продаже опционов.
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Переключение сценариев ИВ</h2>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setScenario('low')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario === 'low' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            Низкая ИВ (Ранг ИВ 18)
          </button>
          <button
            onClick={() => setScenario('high')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scenario === 'high' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            Высокая ИВ (Ранг ИВ 83)
          </button>
        </div>

        <IVRankGauge
          ivRank={scenario === 'low' ? ivRankLow : ivRankHigh}
          ivPercentile={scenario === 'low' ? 22 : 87}
          hv30={scenario === 'low' ? 0.18 : 0.34}
          currentIV={scenario === 'low' ? 0.22 : 0.48}
          ticker="AAPL"
        />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Влияние ИВ на цены опционов</h2>
        <p className="text-sm text-gray-400 mb-4">
          Та же акция AAPL по $180, тот же страйк $185, те же 30 дней. Меняется только ИВ.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="badge-green mb-2 text-xs">Период низкой ИВ (22%)</div>
            <VolatilitySlider S={180} K={185} T={30/365} r={0.05} optionType="call" initialSigma={0.22} />
          </div>
          <div>
            <div className="badge-red mb-2 text-xs">Период высокой ИВ (48%)</div>
            <VolatilitySlider S={180} K={185} T={30/365} r={0.05} optionType="call" initialSigma={0.48} />
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-gray-200">Схема принятия решений по Рангу ИВ</h2>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
            <strong className="text-green-300">Ранг ИВ 0-30 (Опционы дёшевы):</strong>
            <p className="text-gray-300 mt-1">Стратегии покупки имеют структурное преимущество. Длинные коллы, длинные путы,
            дебетовые спрэды. Вы платите ниже среднего за право выбора.</p>
          </div>
          <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
            <strong className="text-yellow-300">Ранг ИВ 30-70 (Нейтрально):</strong>
            <p className="text-gray-300 mt-1">Нет сильного преимущества по волатильности. Сосредоточьтесь на своём
            направленном тезисе и используйте стратегию, которая лучше всего его выражает.</p>
          </div>
          <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
            <strong className="text-red-300">Ранг ИВ 70-100 (Опционы дороги):</strong>
            <p className="text-gray-300 mt-1">Стратегии продажи имеют структурное преимущество. Покрытые коллы,
            обеспеченные путы, кредитные спрэды. Вы собираете выше среднего премию.</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Ранг ИВ относителен СОБСТВЕННОЙ истории акции. Ранг ИВ 80 для коммунальной акции (ИВ историч. ~15%)
          может означать ИВ=20% — всё ещё дёшево в абсолютных значениях. Контекст важен: используйте Ранг ИВ
          как ориентир, а не абсолютное правило.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">🧮 Калькулятор ожидаемого движения</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label flex justify-between">
              <span>Цена акции</span>
              <span className="text-white font-mono">${stockPriceIv}</span>
            </label>
            <input type="range" min="50" max="500" step="5" value={stockPriceIv}
              onChange={e => setStockPriceIv(Number(e.target.value))} className="w-full mt-1" />
          </div>
          <div>
            <label className="label flex justify-between">
              <span>IV</span>
              <span className="text-white font-mono">{ivPct}%</span>
            </label>
            <input type="range" min="10" max="120" step="1" value={ivPct}
              onChange={e => setIvPct(Number(e.target.value))} className="w-full mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {[
            { label: '1 день (±)', value: dailyMove },
            { label: '1 неделя (±)', value: weeklyMove },
            { label: '1 месяц (±)', value: monthlyMove },
          ].map(({label, value}) => (
            <div key={label} className="card bg-gray-800">
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-lg font-bold font-mono text-blue-300 mt-1">${value.toFixed(2)}</div>
              <div className="text-xs text-gray-500">{(value/stockPriceIv*100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> NVDA торгуется по $480. IV = 55%, HV = 32%, IVR = 80. Как действовать?
        </div>
        <div className="space-y-2">
          {[
            { step: '1.', text: 'Ожидаемое движение за месяц', value: '55%/√12 = 15.9% → ±$76' },
            { step: '2.', text: 'IV vs HV: разрыв', value: '55% − 32% = 23% (опционы дорогие!)' },
            { step: '3.', text: 'IVR = 80 → IV выше 80% прошлогодних значений', value: 'SELL (продаём волатильность)' },
            { step: '4.', text: 'Выбор стратегии', value: 'Iron Condor или продажа покрытого колла при нейтральном прогнозе' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step.replace('.','')}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">При IVR {'>'} 50 и IV {'>'} HV — стандартный сигнал для продажи опционов. Ждём IV crush и сворачиваем позицию на 50% прибыли.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Торговые стратегии →'}
      </button>
    </div>
  )
}
