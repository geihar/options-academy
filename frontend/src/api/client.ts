import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// ── Types matching backend schemas ──────────────────────────────────────────

export interface BSResult {
  price: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  charm: number
  vanna: number
  d1: number
  d2: number
  itm_probability: number
}

export interface OptionContract {
  strike: number
  expiry: string
  option_type: string
  bid: number
  ask: number
  last: number
  volume: number
  open_interest: number
  iv: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
}

export interface OptionsChainResponse {
  ticker: string
  current_price: number
  expirations: string[]
  calls: OptionContract[]
  puts: OptionContract[]
  iv_rank: number | null
  iv_percentile: number | null
  hv_30: number | null
}

export interface AdviceItem {
  level: 'warning' | 'info' | 'success'
  title: string
  body: string
  lesson_link: string | null
}

export interface AdviceResponse {
  ticker: string
  current_price: number
  strike: number
  expiry: string
  option_type: string
  market_price: number
  bs_price: number
  greeks: BSResult
  iv: number | null
  iv_rank: number | null
  iv_percentile: number | null
  hv_30: number | null
  iv_premium: number | null
  days_to_expiry: number
  breakeven: number
  advice: AdviceItem[]
  days_to_earnings: number | null
  next_earnings_date: string | null
}

export interface SimulateResponse {
  scenarios: Array<{ stock_price: number; pnl: number; option_value: number }>
  breakeven: number
  max_profit: number | null
  max_loss: number
}

// ── API functions ────────────────────────────────────────────────────────────

export async function fetchOptionsChain(ticker: string): Promise<OptionsChainResponse> {
  const res = await apiClient.get<OptionsChainResponse>(`/api/options-chain/${ticker}`)
  return res.data
}

export async function fetchAdvice(params: {
  ticker: string
  strike: number
  expiry: string
  option_type: string
  market_price: number
}): Promise<AdviceResponse> {
  const res = await apiClient.post<AdviceResponse>('/api/advice', params)
  return res.data
}

export async function fetchCalculation(params: {
  S: number
  K: number
  T: number
  r: number
  sigma: number
  option_type: string
}): Promise<BSResult> {
  const res = await apiClient.post<BSResult>('/api/calculate', params)
  return res.data
}

// ── Positions tracker types ───────────────────────────────────────────────────

export interface PositionGreeks {
  iv: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
}

export interface PositionPnL {
  current_price: number | null
  current_option_price: number | null
  unrealized_pnl: number | null
  unrealized_pnl_pct: number | null
  days_to_expiry: number | null
  days_held: number
  greeks: PositionGreeks | null
}

export interface Position {
  id: string
  user_session_id: string
  ticker: string
  option_type: string
  direction: string
  strike: number
  expiry: string
  contracts: number
  entry_price: number
  entry_date: string
  notes: string | null
  status: string
  is_covered: boolean
  close_price: number | null
  realized_pnl: number | null
  pnl: PositionPnL | null
  trade_result: string | null
  outcome_notes: string | null
  lesson_learned: string | null
}

export async function addPosition(params: {
  user_session_id: string
  ticker: string
  option_type: string
  direction: string
  strike: number
  expiry: string
  contracts: number
  entry_price: number
  entry_date: string
  notes?: string
  is_covered?: boolean
}): Promise<Position> {
  const res = await apiClient.post<Position>('/api/positions', params)
  return res.data
}

export async function listPositions(
  user_session_id: string,
  status: 'open' | 'closed' | 'all' = 'open',
): Promise<Position[]> {
  const res = await apiClient.get<Position[]>(
    `/api/positions/${user_session_id}?status=${status}`
  )
  return res.data
}

export async function closePosition(
  position_id: string,
  close_price: number,
): Promise<Position> {
  const res = await apiClient.post<Position>(
    `/api/positions/${position_id}/close`,
    { close_price }
  )
  return res.data
}

export async function deletePosition(position_id: string): Promise<void> {
  await apiClient.delete(`/api/positions/${position_id}`)
}

export async function updateJournal(
  position_id: string,
  data: { trade_result?: string; outcome_notes?: string; lesson_learned?: string },
): Promise<Position> {
  const res = await apiClient.patch<Position>(`/api/positions/${position_id}/journal`, data)
  return res.data
}

export interface PortfolioGreeks {
  net_delta: number
  net_theta: number
  net_vega: number
  net_gamma: number
  total_cost_basis: number
  open_positions: number
  positions_with_greeks: number
}

export async function fetchPortfolioGreeks(user_session_id: string): Promise<PortfolioGreeks> {
  const res = await apiClient.get<PortfolioGreeks>(`/api/positions/${user_session_id}/portfolio-greeks`)
  return res.data
}

export interface HVHistoryPoint {
  date: string
  hv30: number
  hv10: number
  close: number
  iv_rank: number
}

export interface HVHistoryResponse {
  ticker: string
  data: HVHistoryPoint[]
  current_hv30: number | null
  hv30_min: number
  hv30_max: number
}

export async function fetchIVHistory(ticker: string): Promise<HVHistoryResponse> {
  const res = await apiClient.get<HVHistoryResponse>(`/api/iv-history/${ticker}`)
  return res.data
}

export async function fetchQuizProgress(user_session_id: string): Promise<
  Array<{ lesson_id: number; best_score: number; passed: boolean; attempts: number }>
> {
  const res = await apiClient.get(`/api/quiz/progress/${user_session_id}`)
  return res.data
}

// ── Scanner types ─────────────────────────────────────────────────────────────

export interface EvidenceItem {
  label: string
  value: string
  status: string   // "good" | "bad" | "neutral" | "warning"
  meaning: string
  threshold: string
}

export interface ChapterSignal {
  chapter: string
  chapter_title: string
  signal_name: string
  score: number
  level: string
  title: string
  body: string
  strategy_hint: string
  profit_catalyst: string
  data_evidence: EvidenceItem[]
  entry_rules: string
  exit_rules: string
  risk_note: string
}

export interface ProfitForecast {
  expected_value: number
  max_profit: number
  max_loss: number
  breakeven: number
  breakeven_move_pct: number
  breakeven_vs_1sd: number
  expected_move_1sd: number
  prob_profit: number
  annualized_return_if_target: number
  scenario_bull: number
  scenario_bear: number
  scenario_flat: number
  theta_drag_total: number
}

export interface ScannerCandidate {
  ticker: string
  current_price: number
  strike: number
  expiry: string
  option_type: string
  days_to_expiry: number
  market_price: number
  bid: number
  ask: number
  volume: number
  open_interest: number
  iv: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  iv_rank: number | null
  iv_percentile: number | null
  hv_30: number | null
  iv_premium: number | null
  days_to_earnings: number | null
  next_earnings_date: string | null
  composite_score: number
  chapter_signals: ChapterSignal[]
  forecast: ProfitForecast
  recommended_strategy: string
  strategy_rationale: string
  setup_quality: string
}

export interface ScanTickerResult {
  ticker: string
  current_price: number
  iv_rank: number | null
  hv_30: number | null
  days_to_earnings: number | null
  candidates: ScannerCandidate[]
  error: string | null
}

export interface ScanResponse {
  total_candidates: number
  results: ScanTickerResult[]
}

export async function runScan(params: {
  tickers: string[]
  min_dte?: number
  max_dte?: number
  min_volume?: number
  min_open_interest?: number
  strategies?: string[]
}): Promise<ScanResponse> {
  const res = await apiClient.post<ScanResponse>('/api/scan', params)
  return res.data
}

export async function fetchSimulation(params: {
  S: number
  K: number
  T: number
  r: number
  sigma: number
  option_type: string
  premium_paid: number
  contracts: number
}): Promise<SimulateResponse> {
  const res = await apiClient.post<SimulateResponse>('/api/simulate', params)
  return res.data
}
