import { useState } from 'react'
import { blackScholes } from '../../lib/blackScholes'

interface EarningsCrushSimProps {
  S?: number
  K?: number
  T?: number
  preEarningsIV?: number
}

export function EarningsCrushSim({
  S = 185,
  K = 185,
  T = 7 / 365,
  preEarningsIV = 0.80,
}: EarningsCrushSimProps) {
  const [stockMove, setStockMove] = useState(0)
  const [ivCrushPct, setIvCrushPct] = useState(50)

  const postEarningsIV = preEarningsIV * (1 - ivCrushPct / 100)
  const postEarningsS = S * (1 + stockMove / 100)
  const postEarningsT = Math.max(T - 1 / 365, 0.001)

  const preBs = blackScholes({ S, K, T, r: 0.05, sigma: preEarningsIV, optionType: 'call' })
  const postBs = blackScholes({
    S: postEarningsS,
    K,
    T: postEarningsT,
    r: 0.05,
    sigma: postEarningsIV,
    optionType: 'call',
  })

  const pnlPerShare = preBs && postBs ? postBs.price - preBs.price : 0
  const pnlPerContract = pnlPerShare * 100

  const ivCrushEffect = preBs && postBs
    ? blackScholes({ S, K, T: postEarningsT, r: 0.05, sigma: postEarningsIV, optionType: 'call' })?.price ?? 0
    : 0
  const moveEffect = pnlPerShare

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">Симулятор коллапса ИВ при отчётности</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label block mb-2">
            Движение акции: <span className="text-white font-mono">{stockMove > 0 ? '+' : ''}{stockMove}%</span>
          </label>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.5"
            value={stockMove}
            onChange={(e) => setStockMove(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>-20%</span>
            <span>0%</span>
            <span>+20%</span>
          </div>
        </div>

        <div>
          <label className="label block mb-2">
            Коллапс ИВ: <span className="text-white font-mono">{ivCrushPct}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="80"
            step="5"
            value={ivCrushPct}
            onChange={(e) => setIvCrushPct(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0% (нет коллапса)</span>
            <span>80% (сильный)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-gray-800">
          <div className="text-xs text-gray-400 mb-2">ДО отчётности</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Акция</span>
              <span className="font-mono">${S.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ИВ</span>
              <span className="font-mono text-yellow-400">{(preEarningsIV * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Цена опциона</span>
              <span className="font-mono font-bold text-white">${preBs?.price.toFixed(3)}</span>
            </div>
          </div>
        </div>

        <div className="card bg-gray-800">
          <div className="text-xs text-gray-400 mb-2">ПОСЛЕ отчётности</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Акция</span>
              <span className={`font-mono ${stockMove >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${postEarningsS.toFixed(2)} ({stockMove > 0 ? '+' : ''}{stockMove}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ИВ</span>
              <span className="font-mono text-gray-400">{(postEarningsIV * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Цена опциона</span>
              <span className="font-mono font-bold text-white">${postBs?.price.toFixed(3)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`p-4 rounded-xl border text-center ${
        pnlPerContract >= 0
          ? 'bg-green-900/20 border-green-700/30'
          : 'bg-red-900/20 border-red-700/30'
      }`}>
        <div className="text-xs text-gray-400 mb-1">П/У на контракт (100 акций)</div>
        <div className={`text-3xl font-bold font-mono ${
          pnlPerContract >= 0 ? 'text-green-400' : 'text-red-400'
        }`}>
          {pnlPerContract >= 0 ? '+' : ''}${pnlPerContract.toFixed(2)}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Движение акции: {stockMove > 0 ? '+' : ''}{stockMove}% | Коллапс ИВ: -{ivCrushPct}%
        </div>
      </div>

      <div className="bg-orange-900/20 border border-orange-700/30 rounded-lg p-3 text-sm">
        <strong className="text-orange-300">Ловушка коллапса ИВ:</strong>
        <p className="text-gray-300 mt-1">
          Даже если акция движется в нужном направлении, коллапс ИВ с {(preEarningsIV * 100).toFixed(0)}%
          до {(postEarningsIV * 100).toFixed(0)}% может уничтожить прибыль или превратить выигрышное направление в убыток.
          Именно поэтому покупка опционов перед отчётностью рискованна — вы боретесь с временным распадом И коллапсом ИВ одновременно.
        </p>
      </div>
    </div>
  )
}
