import { useState } from 'react'
import { blackScholes } from '../../lib/blackScholes'

interface VolatilitySliderProps {
  S: number
  K: number
  T: number
  r?: number
  optionType: 'call' | 'put'
  initialSigma?: number
}

export function VolatilitySlider({
  S,
  K,
  T,
  r = 0.05,
  optionType,
  initialSigma = 0.30,
}: VolatilitySliderProps) {
  const [sigma, setSigma] = useState(initialSigma)

  const result = blackScholes({ S, K, T, r, sigma, optionType })

  const lowResult = blackScholes({ S, K, T, r, sigma: 0.10, optionType })
  const highResult = blackScholes({ S, K, T, r, sigma: 1.0, optionType })

  const priceChange = result && lowResult
    ? ((result.price - lowResult.price) / lowResult.price * 100).toFixed(0)
    : null

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-300">Влияние волатильности на цену</h3>
        <span className="badge-blue">{(sigma * 100).toFixed(0)}% ИВ</span>
      </div>

      <div>
        <label className="label block mb-2">
          Подразумеваемая волатильность: <span className="text-white font-mono">{(sigma * 100).toFixed(1)}%</span>
        </label>
        <input
          type="range"
          min="0.05"
          max="1.50"
          step="0.01"
          value={sigma}
          onChange={(e) => setSigma(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>5% (очень низкая)</span>
          <span>75%</span>
          <span>150% (экстремальная)</span>
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="card bg-gray-800">
            <div className="text-xs text-gray-400 mb-1">Цена опциона</div>
            <div className="text-xl font-mono font-bold text-green-400">${result.price.toFixed(3)}</div>
          </div>
          <div className="card bg-gray-800">
            <div className="text-xs text-gray-400 mb-1">Дельта</div>
            <div className="text-xl font-mono font-bold text-blue-400">{result.delta.toFixed(3)}</div>
          </div>
          <div className="card bg-gray-800">
            <div className="text-xs text-gray-400 mb-1">Вега</div>
            <div className="text-xl font-mono font-bold text-yellow-400">${result.vega.toFixed(3)}</div>
          </div>
        </div>
      )}

      <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 text-sm">
        <strong className="text-blue-300">Ключевой вывод:</strong>
        <p className="text-gray-300 mt-1">
          Выше волатильность = выше цена опциона. Рынок говорит: "акция может сильно двигаться,
          поэтому страховка стоит дороже." Биотех перед одобрением FDA может иметь ИВ 150%+;
          стабильная коммунальная компания — около 15%.
        </p>
      </div>
    </div>
  )
}
