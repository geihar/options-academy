import clsx from 'clsx'
import { PlayerScore } from '../../hooks/useGameSession'

interface ScoreBoardProps {
  playerScore: PlayerScore | null
}

const RANK_COLORS: Record<string, string> = {
  'Мастер':     'text-yellow-400',
  'Опционщик':  'text-purple-400',
  'Трейдер':    'text-blue-400',
  'Стажёр':     'text-green-400',
  'Новичок':    'text-gray-400',
}

export function ScoreBoard({ playerScore }: ScoreBoardProps) {
  if (!playerScore || playerScore.rounds_played === 0) {
    return (
      <div className="card text-center py-4 text-gray-500 text-sm">
        Сыграйте первый раунд!
      </div>
    )
  }

  const rankColor = RANK_COLORS[playerScore.rank] ?? 'text-gray-400'
  const winRatePct = Math.round(playerScore.win_rate * 100)

  return (
    <div className="card space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm font-semibold text-gray-300">Ваши результаты</div>
        <div className={clsx('font-bold', rankColor)}>{playerScore.rank}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-400">Общий счёт</div>
          <div className="text-2xl font-bold text-white font-mono">{playerScore.total_score}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-400">Раундов</div>
          <div className="text-2xl font-bold text-white font-mono">{playerScore.rounds_played}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-400">Процент побед</div>
          <div className={clsx('text-2xl font-bold font-mono', winRatePct >= 50 ? 'text-green-400' : 'text-red-400')}>
            {winRatePct}%
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-400">Лучший П/У</div>
          <div className={clsx('text-xl font-bold font-mono', playerScore.best_pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
            {playerScore.best_pnl >= 0 ? '+' : ''}${playerScore.best_pnl.toFixed(0)}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-500 mb-1">
          Новичок → Стажёр(100) → Трейдер(300) → Опционщик(600) → Мастер(1000)
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, (playerScore.total_score / 1000) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
