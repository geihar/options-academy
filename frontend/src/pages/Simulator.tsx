import { useState } from 'react'
import { useBlackScholes } from '../hooks/useBlackScholes'
import { PayoffDiagram } from '../components/interactive/PayoffDiagram'
import { GreeksDashboard } from '../components/interactive/GreeksDashboard'
import { ThetaDecayChart } from '../components/interactive/ThetaDecayChart'
import { VolatilitySlider } from '../components/interactive/VolatilitySlider'

export default function Simulator() {
  const [S, setS] = useState(185)
  const [K, setK] = useState(185)
  const [days, setDays] = useState(30)
  const [sigma, setSigma] = useState(0.30)
  const [r, setR] = useState(0.05)
  const [optionType, setOptionType] = useState<'call' | 'put'>('call')

  const T = days / 365

  const result = useBlackScholes({ S, K, T, r, sigma, optionType })

  const premium = result?.price ?? 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Симулятор опционов</h1>
        <p className="text-gray-400 mt-1">
          Настройте параметры ниже и смотрите, как цена опциона, выплата и греки меняются в реальном времени.
          Данные не нужны — работает на клиентском Black-Scholes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Inputs */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-gray-200">Параметры опциона</h2>

          {/* Option Type */}
          <div>
            <label className="label block mb-2">Тип опциона</label>
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setOptionType('call')}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  optionType === 'call' ? 'bg-blue-600 text-white' : 'text-gray-400'
                }`}
              >
                Колл
              </button>
              <button
                onClick={() => setOptionType('put')}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  optionType === 'put' ? 'bg-orange-600 text-white' : 'text-gray-400'
                }`}
              >
                Пут
              </button>
            </div>
          </div>

          {/* Stock Price */}
          <div>
            <label className="label flex justify-between">
              <span>Цена акции (S)</span>
              <span className="text-white font-mono">${S}</span>
            </label>
            <input
              type="range" min="50" max="500" step="1"
              value={S} onChange={(e) => setS(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
            <input
              type="number" value={S} onChange={(e) => setS(parseFloat(e.target.value) || 0)}
              className="input w-full mt-2 text-sm"
            />
          </div>

          {/* Strike */}
          <div>
            <label className="label flex justify-between">
              <span>Цена страйка (K)</span>
              <span className="text-white font-mono">${K}</span>
            </label>
            <input
              type="range" min="50" max="500" step="1"
              value={K} onChange={(e) => setK(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
            <input
              type="number" value={K} onChange={(e) => setK(parseFloat(e.target.value) || 0)}
              className="input w-full mt-2 text-sm"
            />
          </div>

          {/* Days to Expiry */}
          <div>
            <label className="label flex justify-between">
              <span>Дней до экспирации</span>
              <span className="text-white font-mono">{days}d</span>
            </label>
            <input
              type="range" min="1" max="365" step="1"
              value={days} onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full mt-1"
            />
          </div>

          {/* Volatility */}
          <div>
            <label className="label flex justify-between">
              <span>Подразумеваемая волатильность (σ)</span>
              <span className="text-white font-mono">{(sigma * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range" min="0.05" max="2.0" step="0.01"
              value={sigma} onChange={(e) => setSigma(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
          </div>

          {/* Risk-free Rate */}
          <div>
            <label className="label flex justify-between">
              <span>Безрисковая ставка</span>
              <span className="text-white font-mono">{(r * 100).toFixed(1)}%</span>
            </label>
            <input
              type="range" min="0" max="0.15" step="0.001"
              value={r} onChange={(e) => setR(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
          </div>

          {/* Summary box */}
          {result && (
            <div className="bg-gray-800 rounded-xl p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Цена опциона</span>
                <span className="font-mono font-bold text-green-400">${result.price.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Точка безубыточности</span>
                <span className="font-mono text-blue-400">${result.breakeven.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Вероятность ВДК</span>
                <span className="font-mono">{(result.itmProbability * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Charts and Greeks */}
        <div className="lg:col-span-2 space-y-4">
          {result && (
            <>
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Выплата при экспирации</h3>
                <PayoffDiagram
                  K={K}
                  premium={result.price}
                  optionType={optionType}
                  currentPrice={S}
                />
              </div>

              <GreeksDashboard result={result} stockPrice={S} optionType={optionType} />

              <div className="card">
                <ThetaDecayChart
                  S={S} K={K} r={r} sigma={sigma} optionType={optionType}
                  maxDays={Math.min(days + 10, 90)}
                />
              </div>

              <VolatilitySlider
                S={S} K={K} T={T} r={r}
                optionType={optionType}
                initialSigma={sigma}
              />
            </>
          )}

          {!result && (
            <div className="card text-center py-12 text-gray-500">
              Установите корректные параметры для отображения диаграммы и греков
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
