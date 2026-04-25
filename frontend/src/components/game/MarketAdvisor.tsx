import { useState } from 'react'
import { ScenarioData } from '../../hooks/useGameSession'

interface Props {
  scenario: ScenarioData
}

interface StrategyIdea {
  name: string
  emoji: string
  why: string
  how: string
  risk: 'low' | 'medium' | 'high'
}

function getStrategySuggestions(scenario: ScenarioData): StrategyIdea[] {
  const iv = scenario.market_context.iv_used_pct
  const hv = scenario.market_context.hv_30_pct
  const ret = scenario.market_context.return_30d
  const ideas: StrategyIdea[] = []

  const ivExpensive = iv > hv * 1.10
  const ivCheap = iv < hv * 0.90
  const bullish = ret > 2
  const bearish = ret < -2

  if (bullish && ivCheap) {
    ideas.push({
      name: 'Long Call', emoji: '📈',
      why: `Тренд бычий (+${ret.toFixed(1)}% за 30д) и IV ${iv.toFixed(1)}% ниже исторической ${hv.toFixed(1)}% — опционы относительно дёшевы.`,
      how: 'Купите колл на страйке ATM или слегка OTM. Срок 2–4 недели.',
      risk: 'low',
    })
    ideas.push({
      name: 'Bull Call Spread', emoji: '🐂',
      why: `Рост подтверждён, но хочется снизить стоимость входа. Продажа верхнего страйка финансирует покупку.`,
      how: 'Купите ATM колл + продайте OTM колл на 3–5% выше страйком.',
      risk: 'low',
    })
  }

  if (bullish && ivExpensive) {
    ideas.push({
      name: 'Short Put / Bull Put Spread', emoji: '💰',
      why: `Тренд бычий, но IV ${iv.toFixed(1)}% завышена относительно HV ${hv.toFixed(1)}% — продавать опционы выгоднее, чем покупать.`,
      how: 'Продайте OTM пут на 5–10% ниже текущей цены. Или Bull Put Spread для ограничения риска.',
      risk: 'medium',
    })
  }

  if (bearish && ivCheap) {
    ideas.push({
      name: 'Long Put', emoji: '📉',
      why: `Тренд медвежий (${ret.toFixed(1)}% за 30д) и IV ${iv.toFixed(1)}% ниже исторической ${hv.toFixed(1)}%.`,
      how: 'Купите пут ATM или слегка OTM. Срок 2–4 недели.',
      risk: 'low',
    })
    ideas.push({
      name: 'Bear Put Spread', emoji: '🐻',
      why: 'Снижение подтверждено, спред снижает стоимость позиции.',
      how: 'Купите ATM пут + продайте OTM пут на 5–7% ниже страйком.',
      risk: 'low',
    })
  }

  if (bearish && ivExpensive) {
    ideas.push({
      name: 'Bear Call Spread', emoji: '🐻',
      why: `Медвежий тренд + дорогая IV ${iv.toFixed(1)}%. Продажа спреда коллов выгодна при падении.`,
      how: 'Продайте OTM колл + купите выше страйком. Получаете кредит, прибыльно при падении.',
      risk: 'low',
    })
  }

  if (!bullish && !bearish && ivExpensive) {
    ideas.push({
      name: 'Iron Condor / Short Strangle', emoji: '🦅',
      why: `Боковик (${ret.toFixed(1)}% за 30д) + высокая IV ${iv.toFixed(1)}% > HV ${hv.toFixed(1)}%. Продажа волатильности — классика при таком режиме.`,
      how: 'Продайте OTM пут и OTM колл одновременно. Для ограничения риска — Iron Condor (добавьте защитные страйки).',
      risk: 'medium',
    })
  }

  if (!bullish && !bearish && ivCheap) {
    ideas.push({
      name: 'Long Straddle', emoji: '🎯',
      why: `Боковик + дешёвая IV ${iv.toFixed(1)}%. Возможно накапливается энергия для резкого движения.`,
      how: 'Купите ATM колл + ATM пут. Прибыль при сильном движении в любую сторону.',
      risk: 'medium',
    })
  }

  // Always add a neutral observation
  if (ideas.length === 0) {
    ideas.push({
      name: 'Наблюдение', emoji: '🔍',
      why: `IV ${iv.toFixed(1)}% близко к HV ${hv.toFixed(1)}%, тренд нейтральный. Нет явного перекоса.`,
      how: 'Рассмотрите Short Put если готовы владеть акцией, или Bull Call Spread при ожидании роста.',
      risk: 'low',
    })
  }

  return ideas
}

const riskLabel = { low: 'Низкий риск', medium: 'Средний', high: 'Высокий риск' }
const riskColor = {
  low: 'text-green-400 border-green-700/40 bg-green-900/10',
  medium: 'text-yellow-400 border-yellow-700/40 bg-yellow-900/10',
  high: 'text-red-400 border-red-700/40 bg-red-900/10',
}

export function MarketAdvisor({ scenario }: Props) {
  const [open, setOpen] = useState(true)
  const ctx = scenario.market_context
  const iv = ctx.iv_used_pct
  const hv = ctx.hv_30_pct
  const ret = ctx.return_30d
  const ivRatio = iv / hv
  const ideas = getStrategySuggestions(scenario)

  return (
    <div className="card border-amber-700/30 bg-amber-900/5">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🧭</span>
          <span className="font-semibold text-amber-300">Анализ рынка — что выбрать?</span>
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲ скрыть' : '▼ показать'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Market signal bars */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="bg-gray-800/60 rounded-lg p-2.5">
              <div className="text-gray-400 mb-1">Тренд 30д</div>
              <div className={`font-bold text-base ${ret > 1 ? 'text-green-400' : ret < -1 ? 'text-red-400' : 'text-gray-300'}`}>
                {ret > 0 ? '+' : ''}{ret.toFixed(1)}%
              </div>
              <div className={`mt-1 text-xs ${ret > 2 ? 'text-green-400' : ret < -2 ? 'text-red-400' : 'text-gray-400'}`}>
                {ret > 2 ? 'Бычий ▲' : ret < -2 ? 'Медвежий ▼' : 'Нейтральный →'}
              </div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2.5">
              <div className="text-gray-400 mb-1">IV vs HV</div>
              <div className={`font-bold text-base ${ivRatio > 1.1 ? 'text-red-400' : ivRatio < 0.9 ? 'text-green-400' : 'text-yellow-400'}`}>
                {(ivRatio).toFixed(2)}×
              </div>
              <div className={`mt-1 text-xs ${ivRatio > 1.1 ? 'text-red-400' : ivRatio < 0.9 ? 'text-green-400' : 'text-gray-400'}`}>
                {ivRatio > 1.1 ? 'Опционы дороги' : ivRatio < 0.9 ? 'Опционы дёшевы' : 'Нейтрально'}
              </div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2.5">
              <div className="text-gray-400 mb-1">IV (ИВ)</div>
              <div className="font-bold text-base text-yellow-400">{iv.toFixed(1)}%</div>
              <div className="text-xs text-gray-400 mt-1">HV: {hv.toFixed(1)}%</div>
            </div>
          </div>

          {/* IV explanation */}
          <div className="text-xs text-gray-400 bg-gray-800/40 rounded-lg px-3 py-2 leading-relaxed">
            <strong className="text-gray-200">IV/HV подсказка:</strong>{' '}
            {ivRatio > 1.1
              ? `IV ${iv.toFixed(1)}% выше исторической волатильности ${hv.toFixed(1)}% — опционы переоценены. Продажа опционов выгоднее покупки.`
              : ivRatio < 0.9
              ? `IV ${iv.toFixed(1)}% ниже исторической волатильности ${hv.toFixed(1)}% — опционы дёшевы. Покупка имеет смысл.`
              : `IV ${iv.toFixed(1)}% близко к исторической ${hv.toFixed(1)}% — нейтральный режим.`}
          </div>

          {/* Strategy ideas */}
          <div>
            <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Идеи для этого сценария:</div>
            <div className="space-y-2">
              {ideas.map((idea, i) => (
                <div key={i} className={`rounded-lg border px-3 py-2.5 ${riskColor[idea.risk]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">
                      {idea.emoji} {idea.name}
                    </span>
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${riskColor[idea.risk]}`}>
                      {riskLabel[idea.risk]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed mb-1">{idea.why}</p>
                  <p className="text-xs text-gray-400"><span className="text-gray-200 font-medium">Как:</span> {idea.how}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500 italic">
            * Это образовательные подсказки. Реальная торговля требует учёта многих факторов.
          </p>
        </div>
      )}
    </div>
  )
}
