import { useState } from 'react'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

type ScenarioKey = 'otm' | 'atm' | 'itm_div'

interface Scenario {
  label: string
  shortLabel: string
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  riskPercent: number
  riskColor: string
  riskBg: string
  details: string[]
  advice: string
}

const SCENARIOS: Record<ScenarioKey, Scenario> = {
  otm: {
    label: 'Сценарий 1: Опцион OTM',
    shortLabel: 'OTM',
    description: 'Продан колл со страйком $110, акция стоит $100. До экспирации 30 дней.',
    riskLevel: 'low',
    riskPercent: 5,
    riskColor: 'text-green-400',
    riskBg: 'bg-green-500',
    details: [
      'Акция на $10 (10%) ниже страйка',
      'Временная стоимость > внутренней стоимости',
      'Держателю невыгодно исполнять прямо сейчас',
      'Риск назначения: ~5%',
    ],
    advice: 'Расслабьтесь. OTM опционы исполняются крайне редко до экспирации. Просто следите за движением акции.',
  },
  atm: {
    label: 'Сценарий 2: Опцион ATM, 30 дней',
    shortLabel: 'ATM',
    description: 'Продан колл со страйком $100, акция стоит $100. До экспирации 30 дней.',
    riskLevel: 'medium',
    riskPercent: 30,
    riskColor: 'text-yellow-400',
    riskBg: 'bg-yellow-500',
    details: [
      'Акция точно на страйке (ATM)',
      'Опцион имеет только временную стоимость',
      'Если акция уйдёт выше → станет ITM',
      'Вероятность назначения умеренная (~30-40%)',
    ],
    advice: 'Мониторьте позицию. Если акция продолжит рост и станет глубоко ITM — рассмотрите роллирование или закрытие.',
  },
  itm_div: {
    label: 'Сценарий 3: ITM колл, завтра дивиденд',
    shortLabel: 'ITM + Дивиденд',
    description: 'Продан колл со страйком $95, акция стоит $100. Завтра дивиденд $1.50/акция.',
    riskLevel: 'high',
    riskPercent: 90,
    riskColor: 'text-red-400',
    riskBg: 'bg-red-500',
    details: [
      'Опцион глубоко ITM ($5 внутренней стоимости)',
      'Временная стоимость колла < дивиденда ($1.50)',
      'Держателю выгоднее ИСПОЛНИТЬ и получить дивиденд',
      'Вероятность назначения: ~90%+',
    ],
    advice: 'ДЕЙСТВУЙТЕ СЕЙЧАС. Закройте позицию до конца торгового дня. Если получите назначение — вы пропустите дивиденд и останетесь с короткой позицией по акции.',
  },
}

export default function Lesson12({ onComplete, isCompleted }: LessonProps) {
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('otm')
  const scenario = SCENARIOS[activeScenario]

  const riskBarColors: Record<string, string> = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
  }

  const riskLabels: Record<string, string> = {
    low: 'Низкий риск',
    medium: 'Умеренный риск',
    high: 'Высокий риск',
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 12</div>
        <h1 className="text-3xl font-bold text-white">Риск Назначения</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Понять когда и почему продавца опциона
          могут назначить, и как управлять этим риском профессионально.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-2">Что такое назначение</h2>
        <p className="text-gray-200 text-sm leading-relaxed">
          Когда вы продаёте опцион, вы берёте на себя обязательство. Держатель опциона имеет
          <strong className="text-white"> право</strong>, а вы несёте <strong className="text-white">обязанность</strong>:
        </p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-sm">
            <div className="text-red-300 font-semibold mb-1">Назначение по коллу</div>
            <div className="text-gray-300">Держатель исполнил колл → вы обязаны
              <strong className="text-white"> продать</strong> 100 акций по страйковой цене.
              Если у вас нет акций — брокер купит их по рынку, создав убыток.</div>
          </div>
          <div className="p-3 bg-orange-900/20 border border-orange-700/30 rounded-lg text-sm">
            <div className="text-orange-300 font-semibold mb-1">Назначение по путу</div>
            <div className="text-gray-300">Держатель исполнил пут → вы обязаны
              <strong className="text-white"> купить</strong> 100 акций по страйковой цене.
              Нужно иметь наличные или маржу на счёте.</div>
          </div>
        </div>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Когда происходит назначение</h2>
        <div className="space-y-2 text-sm">
          <div className="p-2 bg-gray-800/60 rounded-lg">
            <strong className="text-gray-200">Американские опционы (акции США)</strong>
            <span className="text-gray-400"> — могут быть исполнены в любой день до экспирации.</span>
          </div>
          <div className="p-2 bg-gray-800/60 rounded-lg">
            <strong className="text-gray-200">Европейские опционы (индексы)</strong>
            <span className="text-gray-400"> — только в день экспирации. Нет риска раннего назначения.</span>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="text-sm font-semibold text-gray-200">Типичные триггеры раннего назначения:</div>
          {[
            { trigger: 'Опцион глубоко ITM', detail: 'Временная стоимость близка к нулю — держателю выгоднее исполнить' },
            { trigger: 'Накануне дивиденда (коллы)', detail: 'Если временная стоимость колла < дивиденда — держатель исполняет чтобы получить дивиденд' },
            { trigger: 'Истечение срока вблизи', detail: 'За 1-2 дня до экспирации вероятность назначения резко растёт' },
          ].map((item) => (
            <div key={item.trigger} className="flex gap-3 p-2 bg-gray-800/40 rounded-lg text-xs">
              <span className="text-yellow-400 flex-shrink-0">▸</span>
              <div>
                <span className="text-gray-200 font-medium">{item.trigger}: </span>
                <span className="text-gray-400">{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Три сценария риска назначения</h2>
        <p className="text-sm text-gray-400 mb-4">Продан колл-опцион. Выберите сценарий:</p>

        <div className="flex gap-2 mb-5">
          {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActiveScenario(key)}
              className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors text-center ${
                activeScenario === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {SCENARIOS[key].shortLabel}
            </button>
          ))}
        </div>

        <div className="p-4 bg-gray-800/60 rounded-xl space-y-4">
          <div>
            <div className="font-semibold text-gray-200 mb-1">{scenario.label}</div>
            <div className="text-sm text-gray-400">{scenario.description}</div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Риск назначения</span>
              <span className={`text-sm font-bold ${scenario.riskColor}`}>
                {riskLabels[scenario.riskLevel]} ({scenario.riskPercent}%)
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${riskBarColors[scenario.riskLevel]}`}
                style={{ width: `${scenario.riskPercent}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            {scenario.details.map((detail) => (
              <div key={detail} className="flex gap-2 text-xs text-gray-300">
                <span className="text-gray-500 flex-shrink-0">•</span>
                <span>{detail}</span>
              </div>
            ))}
          </div>

          <div className={`p-3 rounded-lg text-sm border ${
            scenario.riskLevel === 'high'
              ? 'bg-red-900/30 border-red-700/40 text-red-200'
              : scenario.riskLevel === 'medium'
              ? 'bg-yellow-900/30 border-yellow-700/40 text-yellow-200'
              : 'bg-green-900/30 border-green-700/40 text-green-200'
          }`}>
            <strong>Действие:</strong> {scenario.advice}
          </div>
        </div>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Как управлять риском назначения</h2>
        <div className="space-y-2 text-sm">
          {[
            { title: 'Проверяйте даты дивидендов', desc: 'Всегда смотрите Calendar дивидендов если у вас шорт-колл на акцию. Это самый частый триггер раннего назначения.' },
            { title: 'Следите за временной стоимостью', desc: 'Если временная стоимость < $0.05, опцион ведёт себя как акция. Закройте или зароллируйте позицию.' },
            { title: 'Закрывайте перед экспирацией', desc: 'Не держите короткие позиции до последнего дня. Закрывайте за 5-7 дней или раньше.' },
            { title: 'Используйте роллирование', desc: 'Откупите текущий опцион и продайте следующий страйк или срок — перенесёте обязательство с новой премией.' },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 p-2 bg-gray-800/40 rounded-lg">
              <span className="text-blue-400 font-bold text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
              <div>
                <span className="text-gray-200 font-medium">{item.title}: </span>
                <span className="text-gray-400 text-xs">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод: подготовка устраняет панику</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Назначение — не катастрофа, если вы готовы. Неожиданное назначение — вот что создаёт проблемы.
          Всегда знайте три вещи для каждой короткой опционной позиции:
          когда дивиденды по этой акции, какова временная стоимость опциона сейчас,
          и что вы будете делать при назначении. Ответ на третий вопрос — ваш план управления позицией.
        </p>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> Вы продали обеспеченный пут страйк $60 за $2.00. Акция упала до $55 накануне дивиденда $1.50.
        </div>
        <div className="space-y-2">
          {[
            { step: 1, text: 'Внутренняя стоимость пута', value: '$60 − $55 = $5' },
            { step: 2, text: 'Временная стоимость пута', value: 'рыночная цена $5.10 − $5 = $0.10' },
            { step: 3, text: 'Дивиденд vs временная стоимость', value: '$1.50 >> $0.10 → высокий риск исполнения' },
            { step: 4, text: 'При назначении: покупаем по $60', value: 'убыток vs рынка: $60 − $55 = −$5' },
            { step: 5, text: 'С учётом полученной премии', value: '−$5 + $2 = −$3 на акцию (−$300)' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Всегда проверяйте временну́ю стоимость короткого ITM опциона накануне экс-дивидендной даты. Если временная стоимость &lt; дивиденда — высокий риск досрочного назначения. Рассмотрите закрытие позиции заранее.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Управление короткими позициями →'}
      </button>
    </div>
  )
}
