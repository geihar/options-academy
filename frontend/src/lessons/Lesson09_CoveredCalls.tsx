import { useState } from 'react'
import { StrategyBuilder } from '../components/interactive/StrategyBuilder'

interface LessonProps {
  onComplete: () => void
  isCompleted: boolean
  lessonNumber: number
}

const COVERED_CALL_TABLE = [
  { price: 90, stockPnl: -1000, premium: 300, total: -700, note: 'Убыток по акции, премия смягчает' },
  { price: 95, stockPnl: -500, premium: 300, total: -200, note: 'Небольшой убыток' },
  { price: 100, stockPnl: 0, premium: 300, total: 300, note: 'Акция на месте — забираем премию' },
  { price: 103, stockPnl: 300, premium: 300, total: 600, note: 'Максимальная прибыль зоны' },
  { price: 105, stockPnl: 500, premium: 300, total: 800, note: 'Акция назначается — продаём по $105' },
  { price: 110, stockPnl: 1000, premium: 300, total: 800, note: 'Upside срезан страйком' },
  { price: 120, stockPnl: 2000, premium: 300, total: 800, note: 'Без колла заработали бы $2000' },
]


export default function Lesson09({ onComplete, isCompleted }: LessonProps) {
  const [stockBuyPrice, setStockBuyPrice] = useState(150)
  const [callStrikeCC, setCallStrikeCC] = useState(160)
  const [callPremiumCC, setCallPremiumCC] = useState(3.5)
  const maxProfitCC = callStrikeCC - stockBuyPrice + callPremiumCC
  const breakevenCC = stockBuyPrice - callPremiumCC
  const annualYieldCC = parseFloat(((callPremiumCC / stockBuyPrice) * 12 * 100).toFixed(1))

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Урок 9</div>
        <h1 className="text-3xl font-bold text-white">Покрытый Колл</h1>
        <p className="text-gray-400 mt-2">
          <strong className="text-gray-200">Цель урока:</strong> Научиться зарабатывать дополнительный доход
          с акций через продажу коллов — одна из самых популярных стратегий среди инвесторов.
        </p>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-2">Что такое покрытый колл</h2>
        <p className="text-gray-200 text-sm leading-relaxed">
          У вас есть 100 акций компании. Вы продаёте право другому участнику рынка купить эти акции
          по более высокой цене (страйк). За это право вы получаете деньги прямо сейчас — это и есть премия.
        </p>
        <div className="mt-3 p-3 bg-gray-800/60 rounded-lg">
          <div className="text-sm text-gray-300">
            <strong className="text-gray-100">Аналогия:</strong> Вы владеете квартирой и сдаёте её в аренду.
            Вы получаете ежемесячный доход (премия), но при этом остаётесь владельцем квартиры.
            Если арендатор решит её выкупить по оговорённой цене — вы обязаны продать. Если нет —
            деньги ваши, и квартира по-прежнему ваша.
          </div>
        </div>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Механика стратегии</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-200 text-sm">Структура позиции</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 p-2 bg-green-900/20 rounded-lg">
                <span className="text-green-400 font-bold">+</span>
                <span className="text-gray-300">Long 100 акций (уже у вас)</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-red-900/20 rounded-lg">
                <span className="text-red-400 font-bold">−</span>
                <span className="text-gray-300">Short 1 колл выше рынка</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-200 text-sm">Ключевые параметры</h3>
            <div className="space-y-1.5 text-xs text-gray-300">
              <div className="flex justify-between p-2 bg-gray-800/60 rounded">
                <span>Текущая цена акции</span>
                <span className="text-white font-semibold">$100</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-800/60 rounded">
                <span>Страйк колла (выше рынка)</span>
                <span className="text-white font-semibold">$105</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-800/60 rounded">
                <span>Собранная премия</span>
                <span className="text-green-400 font-semibold">+$300</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-800/60 rounded">
                <span>Максимальная прибыль</span>
                <span className="text-green-400 font-semibold">$800</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Диаграмма выплаты и сценарии</h2>
        <p className="text-sm text-gray-400 mb-4">
          Акция AAPL по $100. Продаём колл со страйком $105 за $3 (общая премия $300).
          Диаграмма показывает профиль только для короткого колла — добавьте к нему вашу позицию по акциям.
        </p>
        <StrategyBuilder currentPrice={100} />
      </div>

      <div className="card overflow-x-auto">
        <h3 className="font-semibold text-gray-200 mb-3">Результаты при разных ценах акции</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-700">
              <th className="text-left pb-2">Цена акции</th>
              <th className="text-right pb-2">P&L акции</th>
              <th className="text-right pb-2">Премия</th>
              <th className="text-right pb-2">Итого</th>
              <th className="text-left pb-2 pl-3">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {COVERED_CALL_TABLE.map((row) => (
              <tr key={row.price} className="border-b border-gray-800/50">
                <td className="py-2 text-white font-medium">${row.price}</td>
                <td className={`py-2 text-right ${row.stockPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {row.stockPnl >= 0 ? '+' : ''}${row.stockPnl}
                </td>
                <td className="py-2 text-right text-green-400">+${row.premium}</td>
                <td className={`py-2 text-right font-semibold ${row.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {row.total >= 0 ? '+' : ''}${row.total}
                </td>
                <td className="py-2 pl-3 text-xs text-gray-400">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card bg-blue-900/10 border-blue-700/30">
        <h2 className="text-lg font-semibold text-blue-300 mb-3">Когда использовать покрытый колл</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
            <div className="text-green-300 font-semibold text-sm mb-1">Высокая ИВ</div>
            <div className="text-gray-300 text-xs">
              Когда Ранг ИВ высокий — премии раздуты. Продавайте коллы дороже.
            </div>
          </div>
          <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
            <div className="text-yellow-300 font-semibold text-sm mb-1">Нейтральный взгляд</div>
            <div className="text-gray-300 text-xs">
              Вы не ждёте сильного роста. Акция будет двигаться в боковике или медленно расти.
            </div>
          </div>
          <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <div className="text-blue-300 font-semibold text-sm mb-1">Готовность продать</div>
            <div className="text-gray-300 text-xs">
              Вы готовы продать акцию по страйку, если её назначат. Страйк — ваша целевая цена.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-300 mb-2">Ключевой вывод: компромисс upside</h3>
        <p className="text-gray-200 text-sm leading-relaxed">
          Покрытый колл срезает ваш потенциал роста. Если AAPL улетит с $150 до $200, а вы продали
          колл за $155 — вы продадите акцию по $155, и не заработаете на оставшемся росте. Компромисс
          прост: <strong className="text-white">гарантированный доход сейчас vs неограниченный upside в будущем</strong>.
          Выбирайте страйк только там, где вы действительно готовы расстаться с акцией.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-200 mb-3">🧮 Калькулятор покрытого колла</h3>
        <div className="space-y-3">
          <div>
            <label className="label flex justify-between"><span>Цена покупки акции</span><span className="text-white font-mono">${stockBuyPrice}</span></label>
            <input type="range" min="50" max="500" step="5" value={stockBuyPrice} onChange={e => setStockBuyPrice(Number(e.target.value))} className="w-full mt-1" />
          </div>
          <div>
            <label className="label flex justify-between"><span>Страйк проданного колла</span><span className="text-white font-mono">${callStrikeCC}</span></label>
            <input type="range" min={stockBuyPrice} max={stockBuyPrice + 50} step="1" value={Math.max(callStrikeCC, stockBuyPrice)} onChange={e => { setCallStrikeCC(Number(e.target.value)) }} className="w-full mt-1" />
          </div>
          <div>
            <label className="label flex justify-between"><span>Полученная премия</span><span className="text-white font-mono">${callPremiumCC.toFixed(2)}</span></label>
            <input type="range" min="0.5" max="15" step="0.25" value={callPremiumCC} onChange={e => setCallPremiumCC(Number(e.target.value))} className="w-full mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center text-sm">
          <div className="card bg-green-900/30"><div className="text-xs text-gray-400">Макс. прибыль</div><div className="text-lg font-bold text-green-400 font-mono mt-1">+${maxProfitCC.toFixed(2)}</div><div className="text-xs text-gray-500">на акцию</div></div>
          <div className="card bg-gray-800"><div className="text-xs text-gray-400">Безубыток</div><div className="text-lg font-bold text-blue-300 font-mono mt-1">${breakevenCC.toFixed(2)}</div></div>
          <div className="card bg-yellow-900/30"><div className="text-xs text-gray-400">Год. доходность</div><div className="text-lg font-bold text-yellow-300 font-mono mt-1">{annualYieldCC}%</div></div>
        </div>
      </div>

      <div className="card border-yellow-700/30 bg-yellow-900/10">
        <h3 className="font-semibold text-yellow-300 mb-3">📋 Решаем вместе</h3>
        <div className="bg-gray-800/60 rounded-xl p-4 mb-3 text-sm text-gray-300 leading-relaxed">
          <strong className="text-white">Сценарий:</strong> Вы держите 100 акций AAPL, купленных по $175. AAPL сейчас $178. Продаёте 30-дневный колл $185 за $3.20.
        </div>
        <div className="space-y-2">
          {[
            { step: 1, text: 'Потенциальная прибыль от роста (до страйка)', value: '$185 − $178 = $7' },
            { step: 2, text: 'Полученная премия', value: '+$3.20' },
            { step: 3, text: 'Максимальная прибыль на акцию', value: '$7 + $3.20 = $10.20 (+5.7%)' },
            { step: 4, text: 'Нижний breakeven', value: '$178 − $3.20 = $174.80' },
            { step: 5, text: 'Годовая доходность от премий × 12', value: '$3.20 × 12 / $178 = 21.6%' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-5 h-5 bg-yellow-800/50 rounded text-yellow-300 text-xs flex items-center justify-center font-bold">{s.step}</span>
              <span className="text-gray-300 flex-1">{s.text}</span>
              {s.value && <span className="font-mono text-yellow-200 font-semibold">{s.value}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/30 rounded-xl text-sm">
          <strong className="text-green-300">Результат:</strong> <span className="text-gray-200">Покрытый колл превращает статичный портфель акций в генератор дохода. При нейтральном/слегка бычьем рынке — одна из лучших стратегий для долгосрочных инвесторов.</span>
        </div>
      </div>

      <button onClick={onComplete} className="btn-primary w-full py-3 text-base">
        {isCompleted ? 'Повторение завершено ✓' : 'Далее: Обеспеченный пут →'}
      </button>
    </div>
  )
}
