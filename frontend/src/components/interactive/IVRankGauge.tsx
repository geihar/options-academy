interface IVRankGaugeProps {
  ivRank: number  // 0-100
  ivPercentile?: number
  ticker?: string
  hv30?: number
  currentIV?: number
}

export function IVRankGauge({ ivRank, ivPercentile, ticker, hv30, currentIV }: IVRankGaugeProps) {
  const clamped = Math.min(100, Math.max(0, ivRank))

  let zone: { label: string; color: string; bg: string; advice: string }

  if (clamped < 30) {
    zone = {
      label: 'ДЁШЕВО',
      color: 'text-green-400',
      bg: 'bg-green-500',
      advice: 'Опционы исторически дёшевы. Стратегии покупки (коллы, путы, дебетовые спрэды) могут иметь структурное преимущество.',
    }
  } else if (clamped > 70) {
    zone = {
      label: 'ДОРОГО',
      color: 'text-red-400',
      bg: 'bg-red-500',
      advice: 'Опционы исторически дороги. Стратегии продажи (покрытый колл, обеспеченный пут, кредитные спрэды) могут иметь преимущество.',
    }
  } else {
    zone = {
      label: 'НЕЙТРАЛЬНО',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500',
      advice: 'ИВ в нейтральном диапазоне. Нет чёткого структурного преимущества от волатильности. Фокусируйтесь на направлении.',
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-300">
          Ранг ИВ{ticker ? ` — ${ticker}` : ''}
        </h3>
        <span className={`font-bold text-lg ${zone.color}`}>{clamped.toFixed(0)}/100</span>
      </div>

      {/* Gauge bar */}
      <div className="relative">
        <div className="flex h-6 rounded-full overflow-hidden">
          <div className="flex-1 bg-green-900/60" title="Дёшево (0-30)" />
          <div className="flex-[40%] bg-yellow-900/60" title="Нейтрально (30-70)" />
          <div className="flex-[30%] bg-red-900/60" title="Дорого (70-100)" />
        </div>
        {/* Indicator needle */}
        <div
          className="absolute top-0 -translate-x-1/2 h-6 w-1 rounded-full bg-white shadow-lg transition-all duration-500"
          style={{ left: `${clamped}%` }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1 px-0">
          <span>0 — Дёшево</span>
          <span>30</span>
          <span>70</span>
          <span>100 — Дорого</span>
        </div>
      </div>

      <div className={`text-center text-2xl font-bold ${zone.color}`}>
        {zone.label}
      </div>

      <p className="text-sm text-gray-300">{zone.advice}</p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {ivPercentile !== undefined && (
          <div className="card bg-gray-800 text-center">
            <div className="text-xs text-gray-400">Перцентиль ИВ</div>
            <div className="font-mono font-bold text-white">{ivPercentile.toFixed(0)}%</div>
            <div className="text-xs text-gray-500 mt-0.5">% дней, когда ИВ была ниже</div>
          </div>
        )}
        {hv30 !== undefined && (
          <div className="card bg-gray-800 text-center">
            <div className="text-xs text-gray-400">30-дн. ИВ</div>
            <div className="font-mono font-bold text-white">{(hv30 * 100).toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-0.5">Историческая волатильность</div>
          </div>
        )}
        {currentIV !== undefined && (
          <div className="card bg-gray-800 text-center">
            <div className="text-xs text-gray-400">Текущая ИВ</div>
            <div className="font-mono font-bold text-white">{(currentIV * 100).toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-0.5">Подразумеваемая волатильность</div>
          </div>
        )}
      </div>

      <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 text-xs text-gray-300">
        <strong className="text-blue-300">Ранг ИВ vs Перцентиль ИВ:</strong> Ранг показывает, ГДЕ текущая ИВ
        находится относительно 52-недельного диапазона. Перцентиль показывает, какой % дней за прошлый год ИВ
        была НИЖЕ текущей. Они могут значительно различаться при наличии экстремальных пиков ИВ.
      </div>
    </div>
  )
}
