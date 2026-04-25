import { VolatilitySlider } from '../components/interactive/VolatilitySlider'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

export default function Lesson03({ onComplete, isCompleted }: LessonProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 3</div>
        <h1 className="text-3xl font-bold text-white">Почему опционы стоят своих денег</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Выработать интуицию о том, что движет ценой опционов —
          без формул.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Аналогия с лотерейным билетом</h2>
        <p className="text-gray-200 leading-relaxed">
          Вы бы заплатили больше за лотерейный билет с джекпотом в $1 млн или $100 млн?
          Очевидно, больше за $100 млн — более высокое потенциальное вознаграждение стоит дороже.
        </p>
        <p className="text-gray-200 leading-relaxed mt-3">
          Опционы работают так же с <strong className="text-white">волатильностью</strong>. Акция,
          которая может двигаться на ±50% к экспирации, имеет гораздо больший потенциал роста для покупателя колла,
          чем та, что движется на ±5%. Поэтому опцион на волатильную акцию стоит намного дороже.
        </p>
        <p className="text-gray-200 leading-relaxed mt-3">
          Это ожидаемое будущее движение называется <strong className="text-white">Подразумеваемой волатильностью (ИВ)</strong> —
          коллективная ставка рынка на то, насколько акция сдвинется до экспирации.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gray-800 text-center">
          <div className="text-2xl mb-2">🏛️</div>
          <h3 className="font-semibold text-gray-200 mb-1">Банковская акция</h3>
          <div className="text-sm text-gray-400">ИВ ≈ 15-25%</div>
          <div className="text-sm text-green-400 mt-1">Опционы: ДЁШЕВО</div>
          <div className="text-xs text-gray-500 mt-2">Медленно движется, предсказуемо</div>
        </div>
        <div className="card bg-gray-800 text-center">
          <div className="text-2xl mb-2">📱</div>
          <h3 className="font-semibold text-gray-200 mb-1">AAPL / MSFT</h3>
          <div className="text-sm text-gray-400">ИВ ≈ 25-40%</div>
          <div className="text-sm text-yellow-400 mt-1">Опционы: УМЕРЕННО</div>
          <div className="text-xs text-gray-500 mt-2">Акция роста, события отчётности</div>
        </div>
        <div className="card bg-gray-800 text-center">
          <div className="text-2xl mb-2">🚀</div>
          <h3 className="font-semibold text-gray-200 mb-1">Биотех перед FDA</h3>
          <div className="text-sm text-gray-400">ИВ ≈ 150-300%</div>
          <div className="text-sm text-red-400 mt-1">Опционы: ОЧЕНЬ ДОРОГО</div>
          <div className="text-xs text-gray-500 mt-2">Бинарный исход, огромные движения</div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Пять факторов, влияющих на цену опциона</h2>
        <div className="space-y-2 text-sm">
          {[
            { factor: 'Цена акции (S)', effect: '↑ Цена акции → ↑ Цена колла, ↓ Цена пута', icon: '📈' },
            { factor: 'Цена страйка (K)', effect: '↑ Страйк → ↓ Цена колла (труднее достичь), ↑ Цена пута', icon: '🎯' },
            { factor: 'Время до экспирации (T)', effect: '↑ Время → ↑ Цена опциона (больше времени на движение)', icon: '⏱️' },
            { factor: 'Подразумеваемая волатильность (σ)', effect: '↑ Вол → ↑ И коллы И путы (больше потенциального движения)', icon: '🌊' },
            { factor: 'Процентные ставки (r)', effect: 'Небольшой эффект для большинства трейдеров; ↑ Ставки → слабый ↑ Коллов', icon: '🏦' },
          ].map((item) => (
            <div key={item.factor} className="flex gap-3 p-2 bg-gray-800 rounded-lg">
              <span className="text-lg">{item.icon}</span>
              <div>
                <span className="font-medium text-gray-200">{item.factor}:</span>
                <span className="text-gray-400 ml-2">{item.effect}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Интерактив: двигайте волатильность</h2>
        <p className="text-sm text-gray-400 mb-4">
          AAPL по $180, колл со страйком $185, 30 дней до экспирации. Тяните ползунок ИВ и наблюдайте за изменением цены.
        </p>
        <VolatilitySlider
          S={180} K={185} T={30 / 365} r={0.05}
          optionType="call" initialSigma={0.30}
        />
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод: временная стоимость + внутренняя стоимость</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Каждая цена опциона состоит из двух компонентов: <strong className="text-white">внутренней стоимости</strong>
          (сколько он стоит прямо сейчас при экспирации) и <strong className="text-white">временной стоимости</strong>
          (доплата за шанс, что акция сдвинется ещё больше к экспирации). По мере истечения времени временная стоимость
          тает — это тета-распад, который мы рассмотрим в Уроке 5.
        </p>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> Акция торгуется по $150. ATM колл, 45 DTE, IV = 35%. Оцените примерную цену.
        </div>
        <div className="space-y-2">
          {[
            { step: '1.', text: 'Ожидаемое годовое движение = IV × S', value: '35% × $150 = $52.50' },
            { step: '2.', text: '45-дневное движение = $52.50 × √(45/252)', value: '$52.50 × 0.423 = $22.19' },
            { step: '3.', text: 'ATM-колл ≈ 40% от ожидаемого движения', value: '0.40 × $22.19 = $8.88' },
            { step: '4.', text: 'Округлённая оценка', value: '≈ $8−9' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step.replace('.','')}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Точный Black-Scholes даст примерно $8.50−9.00 при этих параметрах. Ваше приближение — мощный инструмент для быстрой проверки адекватности цены опциона.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Греки →'}
      </button>
    </div>
  )
}
