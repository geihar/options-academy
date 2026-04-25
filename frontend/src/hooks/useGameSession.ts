import { useState, useEffect } from 'react'

export type GamePhase = 'idle' | 'loading' | 'scenario' | 'trading' | 'resolving' | 'result'

export interface GameLeg {
  option_type: 'call' | 'put'
  strike: number
  expiry: string
  direction: 'long' | 'short'
  contracts: number
  entry_premium: number
}

export interface OptionContract {
  option_type: string
  strike: number
  expiry: string
  bid: number
  ask: number
  last: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
  volume: number
  open_interest: number
}

export interface ScenarioData {
  session_id: string
  ticker: string
  scenario_date: string
  entry_price: number
  iv_used: number
  hv_30: number
  narrative: string
  market_context: {
    return_30d: number
    trend_description: string
    hv_30_pct: number
    iv_used_pct: number
  }
  past_prices_30d: number[]
  options_chain: {
    calls: OptionContract[]
    puts: OptionContract[]
    expirations: string[]
    current_price: number
  }
}

export interface GameResult {
  session_id: string
  entry_price: number
  exit_price: number
  forward_days: number
  ticker: string
  pnl: number
  pnl_per_leg: Array<{
    option_type: string
    strike: number
    expiry: string
    direction: string
    entry_premium: number
    exit_value: number
    pnl: number
  }>
  score_awarded: number
  score_breakdown: {
    base_pnl: number
    strategy_quality: number
    direction_accuracy: number
    total: number
  }
  total_score: number
  price_history: Array<{ date: string; price: number }>
  rank: string
}

export interface PlayerScore {
  user_session_id: string
  total_score: number
  rounds_played: number
  total_pnl: number
  win_count: number
  win_rate: number
  best_pnl: number
  rank: string
}

const SESSION_KEY = 'options_game_session_id'

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export function useGameSession() {
  const [sessionId] = useState<string>(getOrCreateSessionId)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [scenario, setScenario] = useState<ScenarioData | null>(null)
  const [legs, setLegs] = useState<GameLeg[]>([])
  const [forwardDays, setForwardDays] = useState<7 | 14 | 30>(30)
  const [result, setResult] = useState<GameResult | null>(null)
  const [playerScore, setPlayerScore] = useState<PlayerScore | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchScore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchScore = async () => {
    try {
      const res = await fetch(`/api/game/${sessionId}/score`)
      if (res.ok) {
        const data: PlayerScore = await res.json()
        setPlayerScore(data)
      }
    } catch {
      // Score fetch is best-effort; ignore errors silently
    }
  }

  const startNewRound = async (ticker?: string) => {
    setPhase('loading')
    setScenario(null)
    setLegs([])
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/game/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_session_id: sessionId, ticker: ticker ?? null }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error((err as { detail?: string }).detail || 'Ошибка загрузки сценария')
      }
      const data: ScenarioData = await res.json()
      setScenario(data)
      setPhase('scenario')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      setPhase('idle')
    }
  }

  const addLeg = (leg: GameLeg) => {
    setLegs(prev => [...prev, { ...leg, contracts: 1 }])
  }

  const removeLeg = (index: number) => {
    setLegs(prev => prev.filter((_, i) => i !== index))
  }

  const updateLeg = (index: number, updates: Partial<GameLeg>) => {
    setLegs(prev => prev.map((leg, i) => (i === index ? { ...leg, ...updates } : leg)))
  }

  const submitTrade = async () => {
    if (!scenario || legs.length === 0) return
    setPhase('resolving')
    try {
      const tradeRes = await fetch('/api/game/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: scenario.session_id,
          legs,
          forward_days: forwardDays,
        }),
      })
      if (!tradeRes.ok) throw new Error('Ошибка отправки позиции')

      // Small delay for dramatic effect
      await new Promise<void>(r => setTimeout(r, 2000))

      const resolveRes = await fetch(`/api/game/${scenario.session_id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!resolveRes.ok) {
        const err = await resolveRes.json()
        throw new Error((err as { detail?: string }).detail || 'Ошибка разрешения')
      }
      const resultData: GameResult = await resolveRes.json()
      setResult(resultData)
      setPlayerScore(prev =>
        prev
          ? {
              ...prev,
              total_score: resultData.total_score,
              rounds_played: (prev.rounds_played || 0) + 1,
              rank: resultData.rank,
            }
          : null
      )
      setPhase('result')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      setPhase('scenario')
    }
  }

  const proceedToTrading = () => setPhase('trading')
  const backToScenario = () => setPhase('scenario')

  return {
    sessionId,
    phase,
    scenario,
    legs,
    forwardDays,
    setForwardDays,
    result,
    playerScore,
    error,
    startNewRound,
    addLeg,
    removeLeg,
    updateLeg,
    submitTrade,
    proceedToTrading,
    backToScenario,
  }
}
