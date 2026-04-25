import { useGameSession, GameLeg, OptionContract } from '../hooks/useGameSession'
import { ScenarioCard } from '../components/game/ScenarioCard'
import { HistoricalOptionsChain } from '../components/game/HistoricalOptionsChain'
import { TradeLegBuilder } from '../components/game/TradeLegBuilder'
import { GameResultCard } from '../components/game/GameResultCard'
import { ScoreBoard } from '../components/game/ScoreBoard'
import { MarketAdvisor } from '../components/game/MarketAdvisor'

const TICKER_POOL = ['AAPL', 'TSLA', 'SPY', 'MSFT', 'NVDA', 'AMD', 'AMZN', 'QQQ', 'META']

export default function TradingGame() {
  const {
    phase, scenario, legs, forwardDays, setForwardDays, result, playerScore, error,
    startNewRound, addLeg, removeLeg, updateLeg, submitTrade, proceedToTrading, backToScenario,
  } = useGameSession()

  const handleAddLeg = (contract: OptionContract, direction: 'long' | 'short') => {
    const mid = (contract.bid + contract.ask) / 2
    const leg: GameLeg = {
      option_type: contract.option_type as 'call' | 'put',
      strike: contract.strike,
      expiry: contract.expiry,
      direction,
      contracts: 1,
      entry_premium: parseFloat(mid.toFixed(2)),
    }
    addLeg(leg)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Торговый Симулятор</h1>
          <p className="text-gray-400 mt-1 text-sm max-w-xl">
            Реальные исторические сценарии. Анализируйте рынок, открывайте позицию —
            узнайте, что произошло через 7–30 дней.
          </p>
        </div>
        {playerScore && playerScore.rounds_played > 0 && (
          <div className="flex items-center gap-3 bg-gray-800/60 rounded-xl px-4 py-2">
            <span className="text-lg font-bold text-white">{playerScore.total_score} очков</span>
            <span className="text-sm font-semibold text-blue-400">{playerScore.rank}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm">{error}</div>
      )}

      {/* IDLE */}
      {phase === 'idle' && (
        <div className="text-center py-12 space-y-6">
          <div className="text-6xl">📊</div>
          <h2 className="text-2xl font-bold text-white">Готовы к торговле?</h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            Вы увидите реальный исторический сценарий с синтетической цепочкой опционов на основе
            фактических данных. Откройте позицию и узнайте, что случилось на самом деле.
          </p>
          <div className="space-y-3">
            <button onClick={() => startNewRound()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-lg transition-colors">
              Случайный сценарий →
            </button>
            <div>
              <div className="text-xs text-gray-500 mb-2">Или выберите тикер:</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {TICKER_POOL.map(t => (
                  <button key={t} onClick={() => startNewRound(t)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-mono rounded-lg transition-colors">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="max-w-sm mx-auto">
            <ScoreBoard playerScore={playerScore} />
          </div>
        </div>
      )}

      {/* LOADING */}
      {phase === 'loading' && (
        <div className="text-center py-16 space-y-4">
          <svg className="animate-spin h-10 w-10 mx-auto text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <div className="text-gray-400">Загружаем исторический сценарий...</div>
        </div>
      )}

      {/* SCENARIO */}
      {phase === 'scenario' && scenario && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <ScenarioCard scenario={scenario} />
            </div>
            <div>
              <ScoreBoard playerScore={playerScore} />
            </div>
          </div>
          <div className="card bg-blue-900/10 border-blue-700/30">
            <p className="text-gray-300 text-sm">
              <strong className="text-blue-300">Ваша задача:</strong> Изучите сценарий и перейдите к цепочке
              опционов. Выберите стратегию — и узнайте, что случилось через 7–30 дней.
            </p>
          </div>
          <button onClick={proceedToTrading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-lg transition-colors">
            Перейти к торговле →
          </button>
        </div>
      )}

      {/* TRADING */}
      {phase === 'trading' && scenario && (
        <div className="space-y-5">
          <div className="flex gap-3 items-center">
            <button onClick={backToScenario} className="text-gray-400 hover:text-white text-sm">
              ← Назад к сценарию
            </button>
            <span className="text-gray-700">|</span>
            <span className="text-sm text-gray-400">
              <span className="text-white font-mono">{scenario.ticker}</span> @{' '}
              <span className="text-green-400 font-mono">${scenario.entry_price.toFixed(2)}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-3 space-y-4">
              <MarketAdvisor scenario={scenario} />
              <HistoricalOptionsChain
                calls={scenario.options_chain.calls}
                puts={scenario.options_chain.puts}
                expirations={scenario.options_chain.expirations}
                currentPrice={scenario.entry_price}
                onAddLeg={handleAddLeg}
              />
            </div>
            <div className="xl:col-span-2 space-y-4">
              <TradeLegBuilder
                legs={legs}
                currentPrice={scenario.entry_price}
                onRemove={removeLeg}
                onUpdate={updateLeg}
                forwardDays={forwardDays}
                onForwardDaysChange={setForwardDays}
              />
              {legs.length > 0 && (
                <button onClick={submitTrade}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-lg transition-colors">
                  Перемотать {forwardDays} дней →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RESOLVING */}
      {phase === 'resolving' && (
        <div className="text-center py-16 space-y-4">
          <div className="text-5xl animate-bounce">⏳</div>
          <h2 className="text-xl font-bold text-white">Перематываем время...</h2>
          <p className="text-gray-400">Вычисляем что произошло с рынком</p>
          <div className="max-w-xs mx-auto bg-gray-700 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-500 h-2 rounded-full animate-pulse w-full" />
          </div>
        </div>
      )}

      {/* RESULT */}
      {phase === 'result' && result && (
        <div className="max-w-2xl mx-auto">
          <GameResultCard result={result} onPlayAgain={() => startNewRound()} />
        </div>
      )}
    </div>
  )
}
