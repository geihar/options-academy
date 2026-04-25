import { BSOutput } from '../../lib/blackScholes'
import { Tooltip } from '../ui/Tooltip'

interface GreeksDashboardProps {
  result: BSOutput
  stockPrice: number
  optionType: 'call' | 'put'
}

interface GreekCardProps {
  name: string
  value: string
  description: string
  interpretation: string
  color: string
}

function GreekCard({ name, value, description, interpretation, color }: GreekCardProps) {
  return (
    <Tooltip content={description}>
      <div className={`card border-l-4 ${color} cursor-help transition-all hover:bg-gray-800`}>
        <div className="flex justify-between items-start mb-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{name}</span>
          <span className="text-lg font-mono font-bold text-white">{value}</span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">{interpretation}</p>
      </div>
    </Tooltip>
  )
}

export function GreeksDashboard({ result, stockPrice, optionType }: GreeksDashboardProps) {
  const fmt = (n: number, decimals = 3) => n.toFixed(decimals)

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Панель греков</h3>
      <div className="grid grid-cols-2 gap-2">
        <GreekCard
          name="Delta δ"
          value={fmt(result.delta)}
          color="border-blue-500"
          description="Дельта показывает, насколько изменится цена опциона при движении акции на $1. Дельта 0.50 означает: при росте акции на $1 опцион вырастет на $0.50."
          interpretation={`При движении акции на $1 → опцион изменится на $${Math.abs(result.delta * 1).toFixed(2)}`}
        />
        <GreekCard
          name="Gamma γ"
          value={fmt(result.gamma, 4)}
          color="border-purple-500"
          description="Гамма — скорость изменения дельты при движении акции. Высокая гамма около УДК означает быстрое изменение дельты."
          interpretation={`Дельта меняется на ${fmt(result.gamma, 4)} при движении акции на $1`}
        />
        <GreekCard
          name="Theta θ"
          value={`$${fmt(result.theta, 3)}`}
          color="border-red-500"
          description="Тета показывает временной распад — сколько опцион теряет в стоимости каждый день при прочих равных."
          interpretation={`Теряет $${Math.abs(result.theta).toFixed(3)} в день от временного распада`}
        />
        <GreekCard
          name="Vega ν"
          value={`$${fmt(result.vega, 3)}`}
          color="border-yellow-500"
          description="Вега показывает чувствительность к ИВ. При росте ИВ на 1% опцион вырастает на $vega. Высокая вега = сильная зависимость от волатильности."
          interpretation={`При движении ИВ на 1% → опцион изменится на $${fmt(result.vega, 3)}`}
        />
        <GreekCard
          name="Rho ρ"
          value={`$${fmt(result.rho, 3)}`}
          color="border-green-500"
          description="Ро показывает чувствительность к изменению процентных ставок. Менее важен для краткосрочных опционов."
          interpretation={`При росте ставок на 1% → опцион изменится на $${fmt(result.rho, 3)}`}
        />
        <div className="card border-l-4 border-teal-500">
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Вер. ВДК</span>
            <span className="text-lg font-mono font-bold text-white">{(result.itmProbability * 100).toFixed(1)}%</span>
          </div>
          <p className="text-xs text-gray-300">
            Вероятность того, что опцион истечёт в деньгах (приближение N(d2))
          </p>
        </div>
      </div>

      <div className="card mt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Цена опциона</span>
          <span className="font-mono font-bold text-green-400">${result.price.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-400">Точка безубыточности</span>
          <span className="font-mono text-blue-400">${result.breakeven.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
