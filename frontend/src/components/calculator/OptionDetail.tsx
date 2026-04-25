import { OptionContract } from '../../api/client'
import { Tooltip } from '../ui/Tooltip'

interface OptionDetailProps {
  option: OptionContract
  currentPrice: number
  adviceLoading?: boolean
}

function MetricRow({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  const row = (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-mono text-white">{value}</span>
    </div>
  )

  if (tooltip) {
    return <Tooltip content={tooltip}><div className="cursor-help">{row}</div></Tooltip>
  }
  return row
}

export function OptionDetail({ option, currentPrice }: OptionDetailProps) {
  const midPrice = (option.bid + option.ask) / 2
  const spreadPct = midPrice > 0 ? ((option.ask - option.bid) / midPrice * 100) : 0

  const breakeven = option.option_type === 'call'
    ? option.strike + midPrice
    : option.strike - midPrice

  const moneynessPct = ((option.strike - currentPrice) / currentPrice * 100)

  return (
    <div className="card space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-white text-lg">
            ${option.strike} {option.option_type.toUpperCase()}
          </h3>
          <div className="text-sm text-gray-400">Экспирация {option.expiry}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-green-400">${midPrice.toFixed(3)}</div>
          <div className="text-xs text-gray-400">средняя цена</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-gray-800">
          <div className="text-xs text-gray-400">Бид / Аск</div>
          <div className="font-mono text-sm">${option.bid.toFixed(2)} / ${option.ask.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{spreadPct.toFixed(1)}% спрэд</div>
        </div>
        <div className="card bg-gray-800">
          <div className="text-xs text-gray-400">Точка безубыточности</div>
          <div className="font-mono text-sm text-blue-400">${breakeven.toFixed(2)}</div>
          <div className={`text-xs ${breakeven > currentPrice ? 'text-red-400' : 'text-green-400'}`}>
            {breakeven > currentPrice ? '+' : ''}{((breakeven - currentPrice) / currentPrice * 100).toFixed(1)}% от текущей
          </div>
        </div>
      </div>

      <div className="space-y-0.5">
        <MetricRow
          label="Страйк vs текущая"
          value={`${moneynessPct > 0 ? '+' : ''}${moneynessPct.toFixed(1)}%`}
          tooltip="Насколько страйк удалён от текущей цены. Отрицательное значение = ВДК для коллов."
        />
        {option.iv && (
          <MetricRow
            label="Подразумеваемая волатильность"
            value={`${(option.iv * 100).toFixed(1)}%`}
            tooltip="Ожидание рынка о будущей волатильности акции, заложенное в цену опциона."
          />
        )}
        {option.delta !== null && option.delta !== undefined && (
          <MetricRow
            label="Дельта"
            value={option.delta.toFixed(3)}
            tooltip="При каждом движении акции на $1 этот опцион меняется примерно на $дельта. Также приближённо равно вероятности истечения ВДК."
          />
        )}
        {option.gamma !== null && option.gamma !== undefined && (
          <MetricRow
            label="Гамма"
            value={option.gamma.toFixed(5)}
            tooltip="Скорость изменения дельты. Высокая гамма около УДК означает быстрое изменение дельты при движении акции."
          />
        )}
        {option.theta !== null && option.theta !== undefined && (
          <MetricRow
            label="Тета ($/день)"
            value={`$${option.theta.toFixed(4)}`}
            tooltip="Сколько опцион теряет в день только за счёт временного распада."
          />
        )}
        {option.vega !== null && option.vega !== undefined && (
          <MetricRow
            label="Вега ($/1% ИВ)"
            value={`$${option.vega.toFixed(4)}`}
            tooltip="Сколько опцион зарабатывает/теряет при движении подразумеваемой волатильности на 1%."
          />
        )}
        <MetricRow
          label="Объём"
          value={option.volume > 0 ? option.volume.toLocaleString() : '—'}
          tooltip="Количество контрактов, проторгованных сегодня."
        />
        <MetricRow
          label="Открытый интерес"
          value={option.open_interest > 0 ? option.open_interest.toLocaleString() : '—'}
          tooltip="Общее количество открытых контрактов по этому опциону."
        />
      </div>
    </div>
  )
}
