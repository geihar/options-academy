import { useState } from 'react'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

const SCENARIOS = [
  {
    id: 'A',
    label: 'Сценарий A: Акция осталась выше $90',
    finalPrice: 95,
    description: 'Срок истёк, акция по $95. Пут истёк без исполнения.',
    stockOwned: false,
    cashFlow: [
      { label: 'Полученная премия', value: '+$200', color: 'text-green-400' },
      { label: 'Изменение позиции', value: 'Нет', color: 'text-gray-400' },
      { label: 'Итого P&L', value: '+$200', color: 'text-green-400' },
    ],
    summary: 'Вы заработали $200 просто за то, что были готовы купить акцию. Деньги на счёте не заморожены.',
    summaryColor: 'text-green-300',
    bg: 'bg-green-900/20 border-green-700/30',
  },
  {
    id: 'B',
    label: 'Сценарий B: Акция упала до $85',
    finalPrice: 85,
    description: 'Держатель пута исполнил его. Вы обязаны купить акцию по $90.',
    stockOwned: true,
    cashFlow: [
      { label: 'Полученная премия', value: '+$200', color: 'text-green-400' },
      { label: 'Куплена акция по', value: '$90 × 100 = $9,000', color: 'text-gray-300' },
      { label: 'Эффективная цена', value: '$88 (с учётом премии)', color: 'text-blue-400' },
      { label: 'Текущая цена акции', value: '$85', color: 'text-gray-300' },
      { label: 'Нереализованный убыток', value: '-$300', color: 'text-red-400' },
    ],
    summary: 'Вы купили акцию, которую хотели, по $88 эффективно. Но сейчас она по $85 — нереализованный убыток $300. Если верите в компанию — держите.',
    summaryColor: 'text-yellow-300',
    bg: 'bg-yellow-900/20 border-yellow-700/30',
  },
]

export default function Lesson10({ onComplete, isCompleted }: LessonProps) {
  const [activeScenario, setActiveScenario] = useState<'A' | 'B'>('A')
  const [cspStrike, setCspStrike] = useState(100)
  const [cspPremium, setCspPremium] = useState(2.5)
  const effectiveCost = cspStrike - cspPremium
  const monthlyYield = parseFloat((cspPremium / cspStrike * 100).toFixed(2))
  const annualYieldCSP = parseFloat((monthlyYield * 12).toFixed(1))

  const scenario = SCENARIOS.find((s) => s.id === activeScenario)!

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 10</div>
        <h1 className="text-3xl font-bold text-white">Обеспеченный Пут</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Научиться покупать акции по желаемой
          цене или зарабатывать премию, если акция остаётся выше целевого уровня.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-2">Суть стратегии</h2>
        <p className="text-gray-200 text-sm leading-relaxed">
          Представьте: вы хотите купить акцию, которая стоит $100, но только если она опустится до $90.
          Обычный лимитный ордер просто ждёт — и ничего не приносит. Обеспеченный пут — это
          <strong className="text-white"> лимитный ордер, который ещё и платит</strong>.
        </p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-gray-800/60 rounded-lg text-sm">
            <div className="text-gray-400 text-xs mb-1 font-semibold uppercase tracking-wider">Обычный лимитный ордер</div>
            <div className="text-gray-300">Купить при $90 → ждёте бесплатно → купите по $90</div>
          </div>
          <div className="p-3 bg-blue-900/30 rounded-lg text-sm border border-blue-700/40">
            <div className="text-blue-400 text-xs mb-1 font-semibold uppercase tracking-wider">Обеспеченный пут</div>
            <div className="text-gray-300">Продать пут $90 → получаете $200 → либо купите по $88, либо заберёте $200</div>
          </div>
        </div>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Механика</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-200 text-sm">Структура</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 p-2 bg-red-900/20 rounded-lg">
                <span className="text-red-400 font-bold">−</span>
                <span className="text-gray-300">Short 1 пут со страйком $90</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-800/60 rounded-lg">
                <span className="text-yellow-400 font-bold">$</span>
                <span className="text-gray-300">$9,000 наличных на счёте (обеспечение)</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-200 text-sm">Параметры примера</h3>
            <div className="space-y-1.5 text-xs text-gray-300">
              <div className="flex justify-between p-2 bg-gray-800/60 rounded">
                <span>Текущая цена акции</span>
                <span className="text-white font-semibold">$100</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-800/60 rounded">
                <span>Страйк пута (целевая цена)</span>
                <span className="text-white font-semibold">$90</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-800/60 rounded">
                <span>Полученная премия</span>
                <span className="text-green-400 font-semibold">+$200</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-800/60 rounded">
                <span>Эффективная цена покупки</span>
                <span className="text-blue-400 font-semibold">$88</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-orange-900/20 border border-orange-700/30 rounded-lg text-sm">
          <strong className="text-orange-300">Важно:</strong>
          <span className="text-gray-300"> Вам нужны деньги на счёте в размере страйк × 100 = $9,000.
          При назначении вы обязаны купить акцию. Это не опционально.</span>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Симулятор двух сценариев</h2>
        <p className="text-sm text-gray-400 mb-4">
          Продан пут со страйком $90 за $2 (премия $200). Акция стоит $100. Выберите сценарий:
        </p>
        <div className="flex gap-2 mb-4">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveScenario(s.id as 'A' | 'B')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeScenario === s.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Сценарий {s.id}
            </button>
          ))}
        </div>

        <div className={`p-4 border rounded-xl ${scenario.bg}`}>
          <div className="font-semibold text-gray-200 mb-1">{scenario.label}</div>
          <div className="text-sm text-gray-400 mb-3">{scenario.description}</div>
          <div className="space-y-2">
            {scenario.cashFlow.map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{item.label}</span>
                <span className={`font-semibold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
          <div className={`mt-3 pt-3 border-t border-gray-700/50 text-sm ${scenario.summaryColor}`}>
            {scenario.summary}
          </div>
        </div>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-2">Психологический фрейм</h2>
        <p className="text-gray-200 text-sm leading-relaxed">
          Самая важная вещь при использовании обеспеченного пута — <strong className="text-white">думать
          как инвестор, а не как трейдер</strong>. Задайте себе один вопрос перед продажей пута:
        </p>
        <div className="mt-3 p-3 bg-gray-800/60 rounded-lg text-center">
          <div className="text-lg text-white font-semibold">
            «Хочу ли я владеть этой акцией по страйковой цене?»
          </div>
          <div className="text-sm text-gray-400 mt-1">
            Если ответ «нет» — не продавайте этот пут.
          </div>
        </div>
        <p className="text-gray-300 text-sm mt-3 leading-relaxed">
          Если вы готовы держать акцию при любом сценарии, вы избегаете паники при назначении.
          Назначение — это не провал. Это просто покупка акции по вашей целевой цене.
        </p>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод: симметрия стратегий</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Обеспеченный пут = покрытый колл снизу. Они математически эквивалентны благодаря паритету
          пут-колл (put-call parity). Разница не в математике — она в вашем отношении к позиции.
          Покрытый колл: вы уже владеете акцией и хотите доход.
          Обеспеченный пут: вы хотите купить акцию дешевле и готовы ждать.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">🧮 Калькулятор обеспеченного пута</h3>
        <div className="space-y-3">
          <div>
            <label className="label flex justify-between"><span>Страйк пута</span><span className="text-white font-mono">${cspStrike}</span></label>
            <input type="range" min="30" max="500" step="5" value={cspStrike} onChange={e => setCspStrike(Number(e.target.value))} className="w-full mt-1" />
          </div>
          <div>
            <label className="label flex justify-between"><span>Полученная премия (30 дней)</span><span className="text-white font-mono">${cspPremium.toFixed(2)}</span></label>
            <input type="range" min="0.5" max="15" step="0.25" value={cspPremium} onChange={e => setCspPremium(Number(e.target.value))} className="w-full mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center text-sm">
          <div className="card bg-blue-900/30"><div className="text-xs text-gray-400">Эфф. цена покупки</div><div className="text-lg font-bold text-blue-300 font-mono mt-1">${effectiveCost.toFixed(2)}</div></div>
          <div className="card bg-gray-800"><div className="text-xs text-gray-400">Доход в месяц</div><div className="text-lg font-bold text-green-400 font-mono mt-1">{monthlyYield}%</div></div>
          <div className="card bg-yellow-900/30"><div className="text-xs text-gray-400">Год. доходность</div><div className="text-lg font-bold text-yellow-300 font-mono mt-1">{annualYieldCSP}%</div></div>
        </div>
        <div className="text-xs text-gray-500 text-center mt-2">Капитал на счёте: ${(cspStrike * 100).toLocaleString()} (резервируется брокером)</div>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> GOOGL торгуется по $140. Вы считаете хорошей ценой $130. Продаёте 30-дневный пут $130 за $2.80.
        </div>
        <div className="space-y-2">
          {[
            { step: 1, text: 'Зарезервированный капитал', value: '$130 × 100 = $13,000' },
            { step: 2, text: 'Полученная премия', value: '$2.80 × 100 = $280' },
            { step: 3, text: 'Эффективная цена покупки (при назначении)', value: '$130 − $2.80 = $127.20' },
            { step: 4, text: 'Месячная доходность (без назначения)', value: '$280 / $13,000 = 2.15%' },
            { step: 5, text: 'Годовая доходность', value: '2.15% × 12 = 25.8%' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Вы либо купите GOOGL на 9% дешевле текущей цены ($127.20 vs $140), либо заработаете 25.8% годовых на зарезервированном капитале. Идеально для акций, которые хотите держать долгосрочно.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Кредитные спрэды →'}
      </button>
    </div>
  )
}
