import { useState } from 'react'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

interface DaySnapshot {
  day: number
  stockPrice: number
  optionValue: number
  pnl: number
  pnlPercent: number
  ruleTriggered: string | null
  ruleColor: string | null
  status: 'profit' | 'loss' | 'warning' | 'danger'
}

// Сценарий: продан пут $95 за $3.00, акция начинает падать
const INITIAL_PREMIUM = 3.0
const DAYS_SCENARIO: DaySnapshot[] = [
  {
    day: 0,
    stockPrice: 100,
    optionValue: 3.0,
    pnl: 0,
    pnlPercent: 0,
    ruleTriggered: null,
    ruleColor: null,
    status: 'profit',
  },
  {
    day: 5,
    stockPrice: 98,
    optionValue: 2.1,
    pnl: 90,
    pnlPercent: 30,
    ruleTriggered: null,
    ruleColor: null,
    status: 'profit',
  },
  {
    day: 10,
    stockPrice: 97,
    optionValue: 1.5,
    pnl: 150,
    pnlPercent: 50,
    ruleTriggered: 'Правило 50%: Достигнута цель прибыли! Закрывайте позицию.',
    ruleColor: 'text-green-300',
    status: 'profit',
  },
  {
    day: 15,
    stockPrice: 95,
    optionValue: 2.8,
    pnl: 20,
    pnlPercent: 7,
    ruleTriggered: null,
    ruleColor: null,
    status: 'warning',
  },
  {
    day: 20,
    stockPrice: 93,
    optionValue: 4.5,
    pnl: -150,
    pnlPercent: -50,
    ruleTriggered: null,
    ruleColor: null,
    status: 'loss',
  },
  {
    day: 25,
    stockPrice: 91,
    optionValue: 6.2,
    pnl: -320,
    pnlPercent: -107,
    ruleTriggered: 'Правило 2×: Убыток превысил 2× премию! Немедленно закрывайте.',
    ruleColor: 'text-red-300',
    status: 'danger',
  },
  {
    day: 30,
    stockPrice: 89,
    optionValue: 7.8,
    pnl: -480,
    pnlPercent: -160,
    ruleTriggered: 'Правило 21 дня + Правило 2×: Всё ещё в позиции? Закройте ПРЯМО СЕЙЧАС.',
    ruleColor: 'text-red-300',
    status: 'danger',
  },
]

const MANAGEMENT_RULES = [
  {
    number: 1,
    title: 'Правило 50%',
    description: 'Закрывайте позицию при достижении 50% прибыли. Не ждите экспирации.',
    rationale: 'Последние 50% прибыли требуют столько же времени, но несут весь оставшийся риск. Возьмите деньги и уходите.',
    color: 'text-green-400',
    bg: 'bg-green-900/20 border-green-700/30',
  },
  {
    number: 2,
    title: 'Правило 2×',
    description: 'Если позиция идёт против вас на 2× собранной премии — закрывайте без колебаний.',
    rationale: 'Собрали $300? Убыток достиг $600? Закрывайте. Не ждите «отскока». Маленькие потери — часть профессиональной торговли.',
    color: 'text-orange-400',
    bg: 'bg-orange-900/20 border-orange-700/30',
  },
  {
    number: 3,
    title: 'Правило 21 дня',
    description: 'Закрывайте за 21 день до экспирации независимо от P&L.',
    rationale: 'После 21 дня гамма-риск резко возрастает. Тета замедляется относительно риска. Распад не компенсирует риск большого движения.',
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-700/30',
  },
  {
    number: 4,
    title: 'Роллирование',
    description: 'Откупите текущий опцион и продайте следующий срок или другой страйк.',
    rationale: 'Позволяет перенести позицию, собрать новую премию и дать акции время вернуться. Но не роллируйте бесконечно — это не магия.',
    color: 'text-purple-400',
    bg: 'bg-purple-900/20 border-purple-700/30',
  },
]

export default function Lesson13({ onComplete, isCompleted }: LessonProps) {
  const [currentDayIndex, setCurrentDayIndex] = useState(0)
  const [originalPremium, setOriginalPremium] = useState(3.0)
  const [currentPrice, setCurrentPrice] = useState(3.0)
  const pnlPerShare = originalPremium - currentPrice
  const pnlPct = parseFloat(((pnlPerShare / originalPremium) * 100).toFixed(1))
  const rule50 = originalPremium * 0.5
  const rule2x = originalPremium * 3
  const action = currentPrice <= rule50
    ? 'ЗАКРЫТЬ — достигнуто 50% прибыли 🎯'
    : currentPrice >= rule2x
    ? 'ЗАКРЫТЬ — сработало правило 2× убытка ⚠️'
    : 'ДЕРЖАТЬ — в рабочей зоне ✓'
  const actionColor = currentPrice <= rule50 ? 'text-green-400' : currentPrice >= rule2x ? 'text-red-400' : 'text-blue-400'

  const snapshot = DAYS_SCENARIO[currentDayIndex]
  const isAtStart = currentDayIndex === 0
  const isAtEnd = currentDayIndex === DAYS_SCENARIO.length - 1

  const statusColors = {
    profit: 'border-green-700/40 bg-green-900/10',
    loss: 'border-yellow-700/40 bg-yellow-900/10',
    warning: 'border-yellow-700/40 bg-yellow-900/10',
    danger: 'border-red-700/40 bg-red-900/10',
  }

  const pnlColor = snapshot.pnl >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 13</div>
        <h1 className="text-3xl font-bold text-white">Управление Короткими Позициями</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Научиться управлять проигрывающими
          опционными позициями как профессионал — с чёткими правилами, без эмоций.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Три исхода короткой позиции</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
            <div className="text-green-300 font-semibold mb-1">Идеальный исход</div>
            <div className="text-gray-300">Опцион истёк OTM. Премия осталась целиком. Максимальная прибыль достигнута без управления.</div>
          </div>
          <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-xl text-sm">
            <div className="text-red-300 font-semibold mb-1">Плохой исход</div>
            <div className="text-gray-300">Опцион истёк ITM. Получено назначение или выкуплен с убытком. Так бывает — это часть торговли.</div>
          </div>
          <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl text-sm">
            <div className="text-yellow-300 font-semibold mb-1">Управляемый исход</div>
            <div className="text-gray-300">Позиция идёт против вас до экспирации. Применяете правила управления — закрываете или роллируете.</div>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-gray-200">Четыре правила управления позицией</h2>
        {MANAGEMENT_RULES.map((rule) => (
          <div key={rule.number} className={`p-3 border rounded-xl ${rule.bg}`}>
            <div className="flex items-start gap-3">
              <div className={`text-lg font-bold flex-shrink-0 ${rule.color}`}>{rule.number}.</div>
              <div>
                <div className={`font-semibold ${rule.color} mb-0.5`}>{rule.title}</div>
                <div className="text-sm text-gray-200 mb-1">{rule.description}</div>
                <div className="text-xs text-gray-400 italic">{rule.rationale}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-1">Симулятор развития позиции</h2>
        <p className="text-sm text-gray-400 mb-4">
          Продан пут со страйком $95 за $3.00 (премия $300). Акция начинает падать.
          Нажимайте кнопки чтобы увидеть как развивается ситуация и когда срабатывают правила.
        </p>

        <div className={`p-4 border rounded-xl transition-colors ${statusColors[snapshot.status]}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">День</div>
              <div className="text-xl font-bold text-white">{snapshot.day}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Цена акции</div>
              <div className="text-xl font-bold text-white">${snapshot.stockPrice}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Стоимость опц.</div>
              <div className="text-xl font-bold text-yellow-300">${snapshot.optionValue.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">P&L</div>
              <div className={`text-xl font-bold ${pnlColor}`}>
                {snapshot.pnl >= 0 ? '+' : ''}${snapshot.pnl}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Прогресс P&L (относительно начальной премии $300)</span>
              <span className={pnlColor}>{snapshot.pnlPercent >= 0 ? '+' : ''}{snapshot.pnlPercent}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
              {snapshot.pnl >= 0 ? (
                <div
                  className="h-2.5 bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(snapshot.pnlPercent, 100)}%` }}
                />
              ) : (
                <div
                  className="h-2.5 bg-red-500 rounded-full transition-all duration-300 ml-auto"
                  style={{ width: `${Math.min(Math.abs(snapshot.pnlPercent), 100)}%` }}
                />
              )}
            </div>
          </div>

          {snapshot.ruleTriggered && (
            <div className={`p-3 bg-gray-900/60 rounded-lg text-sm font-semibold ${snapshot.ruleColor}`}>
              ⚡ {snapshot.ruleTriggered}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setCurrentDayIndex(Math.max(0, currentDayIndex - 1))}
            disabled={isAtStart}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Назад
          </button>
          <button
            onClick={() => setCurrentDayIndex(0)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
          >
            Сброс
          </button>
          <button
            onClick={() => setCurrentDayIndex(Math.min(DAYS_SCENARIO.length - 1, currentDayIndex + 1))}
            disabled={isAtEnd}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            День +{currentDayIndex < DAYS_SCENARIO.length - 1 ? DAYS_SCENARIO[currentDayIndex + 1].day - snapshot.day : '—'} →
          </button>
        </div>

        <div className="mt-3 p-2 bg-gray-800/40 rounded-lg">
          <div className="text-xs text-gray-400 text-center">
            Начальная премия: <span className="text-white font-semibold">${INITIAL_PREMIUM.toFixed(2)}</span> ·
            Цель закрытия (50%): <span className="text-green-400 font-semibold">${(INITIAL_PREMIUM * 0.5).toFixed(2)}</span> ·
            Стоп-лосс (2×): <span className="text-red-400 font-semibold">${(INITIAL_PREMIUM * 3).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Психология управления убытками</h2>
        <p className="text-gray-200 text-sm leading-relaxed mb-3">
          Самая сложная часть профессиональной торговли — принять убыток, когда правила говорят закрыть.
          Мозг шепчет: <em className="text-gray-300">«подожди, отскочит»</em>. Правила говорят: <em className="text-white">«закрой прямо сейчас»</em>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
            <div className="text-red-300 font-semibold mb-1">Любитель</div>
            <div className="text-gray-300 text-xs space-y-1">
              <div>• Надеется что позиция отскочит</div>
              <div>• Не имеет плана управления убытками</div>
              <div>• Удваивает позицию при убытке</div>
              <div>• Один большой убыток уничтожает счёт</div>
            </div>
          </div>
          <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
            <div className="text-green-300 font-semibold mb-1">Профессионал</div>
            <div className="text-gray-300 text-xs space-y-1">
              <div>• Следует правилам механически</div>
              <div>• Закрывает убыток по плану без эмоций</div>
              <div>• Переходит к следующей сделке</div>
              <div>• Серия малых убытков — нормальная работа</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод: управление риском — это профессия</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Цель профессионального трейдера — не <em>быть правым</em>. Цель — <strong className="text-white">управлять риском</strong> так,
          чтобы серия убытков не уничтожила счёт, а серия прибыльных сделок его приумножила.
          Маленькие управляемые потери — это стоимость бизнеса. Большие неконтролируемые убытки —
          признак отсутствия дисциплины. Правила 50%, 2× и 21 дня — не ограничения, это ваша защита.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">🧮 Калькулятор управления позицией</h3>
        <div className="space-y-3">
          <div>
            <label className="label flex justify-between"><span>Полученная премия (продали за)</span><span className="text-white font-mono">${originalPremium.toFixed(2)}</span></label>
            <input type="range" min="0.5" max="10" step="0.25" value={originalPremium} onChange={e => setOriginalPremium(Number(e.target.value))} className="w-full mt-1" />
          </div>
          <div>
            <label className="label flex justify-between"><span>Текущая цена опциона</span><span className="text-white font-mono">${currentPrice.toFixed(2)}</span></label>
            <input type="range" min="0.1" max={originalPremium * 3.5} step="0.1" value={currentPrice} onChange={e => setCurrentPrice(Number(e.target.value))} className="w-full mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div className="card bg-gray-800 space-y-2">
            <div className="flex justify-between"><span className="text-gray-400">P&L на акцию:</span><span className={`font-mono font-bold ${pnlPerShare >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pnlPerShare >= 0 ? '+' : ''}{pnlPerShare.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">P&L %:</span><span className={`font-mono font-bold ${pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pnlPct > 0 ? '+' : ''}{pnlPct}%</span></div>
            <div className="flex justify-between"><span className="text-gray-400">50% цель:</span><span className="font-mono text-green-300">${rule50.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">2× лимит:</span><span className="font-mono text-red-300">${rule2x.toFixed(2)}</span></div>
          </div>
          <div className={`card flex items-center justify-center text-center p-4 ${currentPrice <= rule50 ? 'bg-green-900/30 border-green-700/30' : currentPrice >= rule2x ? 'bg-red-900/30 border-red-700/30' : 'bg-blue-900/20 border-blue-700/30'}`}>
            <div className={`font-bold text-sm ${actionColor}`}>{action}</div>
          </div>
        </div>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> Вы продали 30-дневный пут за $4.00. Прошло 10 дней. Акция немного упала, пут стоит $5.80.
        </div>
        <div className="space-y-2">
          {[
            { step: 1, text: 'Получили кредит', value: '$4.00 × 100 = $400' },
            { step: 2, text: 'Для закрытия нужно заплатить', value: '$5.80 × 100 = $580' },
            { step: 3, text: 'Текущий убыток', value: '$580 − $400 = −$180' },
            { step: 4, text: 'Правило 2×: порог', value: '$4 + $4 = $8 (ещё не достигнут)' },
            { step: 5, text: 'Правило 50%: порог прибыли', value: '$4 × 50% = $2 (ещё не достигнут)' },
            { step: 6, text: 'Вывод: ДЕРЖАТЬ — ситуация рабочая', value: 'наблюдаем, не паникуем' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Убыток $180 при максимальном допустимом $400 (правило 2×) — позиция в рабочей зоне. Главное: следуйте правилам механически. Эмоциональные решения разрушают доходность.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Урок завершён →'}
      </button>
    </div>
  )
}
