import { useState } from 'react'
import { EarningsCrushSim } from '../components/interactive/EarningsCrushSim'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

export default function Lesson08({ onComplete, isCompleted }: LessonProps) {
  const [ivBefore, setIvBefore] = useState(80)
  const [ivAfter, setIvAfter] = useState(30)
  const [movePercent, setMovePercent] = useState(5)
  const stockPrice = 100
  const straddleBefore = parseFloat((stockPrice * (ivBefore / 100) / Math.sqrt(12)).toFixed(2))
  const intrinsic = parseFloat((stockPrice * movePercent / 100).toFixed(2))
  const straddleAfter = parseFloat(Math.max(intrinsic, stockPrice * (ivAfter / 100) / Math.sqrt(12)).toFixed(2))
  const crushPnl = parseFloat((straddleAfter - straddleBefore).toFixed(2))

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 8</div>
        <h1 className="text-3xl font-bold text-white">Отчётность и коллапс ИВ</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Понять, почему покупка опционов
          перед отчётностью — это минное поле, как работает коллапс ИВ и какова схема принятия решений для торговли на отчётностях.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Ловушка отчётности</h2>
        <p className="text-gray-200 leading-relaxed">
          Каждый квартал компании публикуют отчётность. Акция часто значительно движется — иногда на 10-20%.
          Кажется, это идеальное время для покупки опционов? <strong className="text-white">Нет.</strong>
        </p>
        <p className="text-gray-200 leading-relaxed mt-3">
          Рынок знает, что отчётность приближается. Трейдеры заранее поднимают цены опционов, толкая ИВ очень высоко.
          В момент публикации — даже при огромном движении — ИВ обваливается на 40-60%. Это называется
          <strong className="text-white"> коллапс ИВ</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card border-l-4 border-orange-500">
          <h3 className="font-semibold text-orange-300 mb-2">До отчётности</h3>
          <div className="text-sm text-gray-300 space-y-1.5">
            <div>📈 AAPL по $185, отчётность через 3 дня</div>
            <div>🔥 ИВ взлетает до 80-120% (с обычных 30%)</div>
            <div>💰 Колл УДК стоит ~$8.00</div>
            <div>📊 Рынок закладывает ожидаемое движение ±$12</div>
          </div>
        </div>
        <div className="card border-l-4 border-green-500">
          <h3 className="font-semibold text-green-300 mb-2">После отчётности (День +1)</h3>
          <div className="text-sm text-gray-300 space-y-1.5">
            <div>📈 AAPL превзошла ожидания, выросла до $193 (+4.3%)</div>
            <div>💨 ИВ обваливается обратно до 30%</div>
            <div>😱 Тот колл за $8.00 теперь стоит... $3.50?</div>
            <div>❌ Акция пошла в нужную сторону, но деньги потеряны</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Симулируйте коллапс ИВ</h2>
        <p className="text-sm text-gray-400 mb-4">
          AAPL по $185 с отчётностью завтра. Колл УДК. Настройте движение акции и силу коллапса ИВ.
        </p>
        <EarningsCrushSim S={185} K={185} T={3 / 365} preEarningsIV={0.90} />
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Схема принятия решений</h2>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
            <strong className="text-red-300">Никогда не покупайте опционы прямо перед отчётностью (для большинства трейдеров)</strong>
            <p className="text-gray-300 mt-1">
              Вы платите за крайне завышенную ИВ. Акция должна двигаться БОЛЬШЕ ожидаемого движения,
              заложенного в стрэддл — И преодолеть коллапс ИВ — только чтобы выйти в безубыток.
              Шансы против вас.
            </p>
          </div>
          <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
            <strong className="text-green-300">Продажа опционов перед отчётностью (с правильным хеджированием)</strong>
            <p className="text-gray-300 mt-1">
              Опытные трейдеры продают кредитные спрэды или железные кондоры перед отчётностью, чтобы заработать на
              коллапсе ИВ. Пример: продать стрэнгл/железный кондор, собрать раздутую премию, получить прибыль,
              если акция остаётся в диапазоне ожидаемого движения. Всё ещё рискованно — крупное движение может ударить.
            </p>
          </div>
          <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <strong className="text-blue-300">Направленная игра после отчётности</strong>
            <p className="text-gray-300 mt-1">
              Если у вас есть направленный взгляд ПОСЛЕ отчётности, покупайте опционы, когда ИВ уже обвалилась
              до нормы. Теперь вы покупаете дешёвые опционы и вам нужно только угадать направление.
            </p>
          </div>
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold text-gray-200">Чеклист для торговли на отчётности</h3>
        {[
          'Проверьте Ранг ИВ перед торговлей — уже завышен?',
          'Рассчитайте подразумеваемое ожидаемое движение = цена колл УДК + цена пут УДК',
          'Спросите: считаете ли вы, что фактическое движение ПРЕВЫСИТ ожидаемое движение рынка?',
          'Если покупаете: покупайте только при сильной уверенности в большом сюрпризе',
          'Если продаёте: используйте ограниченный риск (спрэды, железные кондоры) — никогда не продавайте голые опционы',
          'Рассмотрите ожидание ДО ПОСЛЕ отчётности для торговли при нормализованной ИВ',
        ].map((item, i) => (
          <div key={i} className="flex gap-3 text-sm text-gray-300">
            <span className="text-blue-400 flex-shrink-0">☐</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод: волатильность — это товар</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Опционы — это контракты на волатильность не меньше, чем на направление. Самая частая ошибка новичков —
          угадать направление, но ошибиться с волатильностью: купить переоценённые опционы, которые обваливаются,
          даже когда акция идёт в нужную сторону. Всегда знайте свою точку безубыточности <em>с учётом коллапса ИВ</em>.
        </p>
      </div>

      <div className="card bg-green-900/10 border-green-700/30 text-center py-6">
        <div className="text-4xl mb-3">🎓</div>
        <h2 className="text-xl font-bold text-white mb-2">Курс пройден!</h2>
        <p className="text-gray-300 text-sm">
          Вы завершили все 8 уроков. Перейдите в <strong className="text-white">Калькулятор</strong>, чтобы
          применить эти концепции с реальными данными по опционам, или в <strong className="text-white">Симулятор</strong>,
          чтобы экспериментировать с различными сценариями.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">🧮 Симулятор IV Crush</h3>
        <p className="text-xs text-gray-400 mb-4">Продан стрэддл перед отчётностью. Акция $100.</p>
        <div className="space-y-3">
          <div>
            <label className="label flex justify-between"><span>IV до отчётности</span><span className="text-white font-mono">{ivBefore}%</span></label>
            <input type="range" min="40" max="150" step="5" value={ivBefore} onChange={e => setIvBefore(Number(e.target.value))} className="w-full mt-1" />
          </div>
          <div>
            <label className="label flex justify-between"><span>IV после отчётности</span><span className="text-white font-mono">{ivAfter}%</span></label>
            <input type="range" min="10" max="60" step="5" value={ivAfter} onChange={e => setIvAfter(Number(e.target.value))} className="w-full mt-1" />
          </div>
          <div>
            <label className="label flex justify-between"><span>Фактическое движение акции</span><span className="text-white font-mono">±{movePercent}%</span></label>
            <input type="range" min="1" max="25" step="1" value={movePercent} onChange={e => setMovePercent(Number(e.target.value))} className="w-full mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center text-sm">
          <div className="card bg-gray-800"><div className="text-xs text-gray-400">Продали за</div><div className="text-lg font-bold font-mono text-orange-400 mt-1">${straddleBefore}</div></div>
          <div className="card bg-gray-800"><div className="text-xs text-gray-400">Стоит после</div><div className="text-lg font-bold font-mono text-blue-400 mt-1">${straddleAfter}</div></div>
          <div className={`card ${crushPnl <= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
            <div className="text-xs text-gray-400">P&L / акцию</div>
            <div className={`text-lg font-bold font-mono mt-1 ${crushPnl <= 0 ? 'text-green-400' : 'text-red-400'}`}>{crushPnl <= 0 ? '+' : ''}{Math.abs(crushPnl).toFixed(2)}{crushPnl <= 0 ? '' : ' убыток'}</div>
          </div>
        </div>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> TSLA перед отчётностью: $200. IV=95%. Вы продали стрэддл за $18. После отчётности TSLA выросла на 8% ($216). IV упала до 32%.
        </div>
        <div className="space-y-2">
          {[
            { step: 1, text: 'Продали стрэддл', value: '$18/акцию = $1,800/контракт' },
            { step: 2, text: 'Колл после: ITM на $16, IV упала', value: '≈ $16.50' },
            { step: 3, text: 'Пут после: OTM, только временная стоимость', value: '≈ $1.50' },
            { step: 4, text: 'Стрэддл стоит', value: '$16.50 + $1.50 = $18' },
            { step: 5, text: 'P&L = продано − куплено', value: '$18 − $18 = $0 (безубыток!)' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">8% движение съело весь IV crush. Правило: ожидаемое движение (по опционам) ≈ цена стрэддла. Если акция движется больше — убыток. Меньше — прибыль.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Курс завершён ✓' : 'Завершить курс →'}
      </button>
    </div>
  )
}
