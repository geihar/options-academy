from pydantic import BaseModel, Field
from typing import Optional, List, Union


class BSRequest(BaseModel):
    S: float = Field(..., description="Current stock price", gt=0)
    K: float = Field(..., description="Strike price", gt=0)
    T: float = Field(..., description="Time to expiry in years", gt=0)
    r: float = Field(default=0.05, description="Risk-free rate")
    sigma: float = Field(..., description="Implied volatility (e.g. 0.30 for 30%)", gt=0)
    option_type: str = Field(..., description="'call' or 'put'")


class BSResult(BaseModel):
    price: float
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: float
    charm: float
    vanna: float
    d1: float
    d2: float
    itm_probability: float


class AdviceRequest(BaseModel):
    ticker: str
    strike: float
    expiry: str  # ISO date string e.g. "2024-03-15"
    option_type: str  # "call" or "put"
    market_price: float


class AdviceItem(BaseModel):
    level: str  # "warning", "info", "success"
    title: str
    body: str
    lesson_link: Optional[str] = None


class AdviceResponse(BaseModel):
    ticker: str
    current_price: float
    strike: float
    expiry: str
    option_type: str
    market_price: float
    bs_price: float
    greeks: BSResult
    iv: Optional[float] = None
    iv_rank: Optional[float] = None
    iv_percentile: Optional[float] = None
    hv_30: Optional[float] = None
    iv_premium: Optional[float] = None
    days_to_expiry: int
    breakeven: float
    advice: List[AdviceItem]
    days_to_earnings: Optional[int] = None
    next_earnings_date: Optional[str] = None


class OptionContract(BaseModel):
    strike: float
    expiry: str
    option_type: str
    bid: float
    ask: float
    last: float
    volume: int
    open_interest: int
    iv: Optional[float] = None
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None


class OptionsChainResponse(BaseModel):
    ticker: str
    current_price: float
    expirations: List[str]
    calls: List[OptionContract]
    puts: List[OptionContract]
    iv_rank: Optional[float] = None
    iv_percentile: Optional[float] = None
    hv_30: Optional[float] = None


class SimulateRequest(BaseModel):
    S: float = Field(..., description="Current stock price", gt=0)
    K: float = Field(..., description="Strike price", gt=0)
    T: float = Field(..., description="Time to expiry in years", gt=0)
    r: float = Field(default=0.05)
    sigma: float = Field(..., gt=0)
    option_type: str
    premium_paid: float = Field(..., description="Premium paid for option")
    contracts: int = Field(default=1, description="Number of contracts (each = 100 shares)")


class ScenarioPoint(BaseModel):
    stock_price: float
    pnl: float
    option_value: float


class SimulateResponse(BaseModel):
    scenarios: List[ScenarioPoint]
    breakeven: float
    max_profit: Optional[float]
    max_loss: float


# ---------------------------------------------------------------------------
# Game schemas
# ---------------------------------------------------------------------------

class GameLeg(BaseModel):
    option_type: str  # "call" | "put"
    strike: float
    expiry: str  # ISO date string
    direction: str  # "long" | "short"
    contracts: int = 1
    entry_premium: float


class ScenarioRequest(BaseModel):
    user_session_id: str
    ticker: Optional[str] = None  # if None, pick random


class ScenarioResponse(BaseModel):
    session_id: str
    ticker: str
    scenario_date: str
    entry_price: float
    iv_used: float
    hv_30: float
    narrative: str
    market_context: dict
    past_prices_30d: List[float]
    options_chain: dict  # calls, puts, expirations


class TradeRequest(BaseModel):
    session_id: str
    legs: List[GameLeg]
    forward_days: int  # 7, 14, or 30


class TradeResponse(BaseModel):
    session_id: str
    legs_count: int
    net_debit_credit: float  # positive = credit received, negative = debit paid
    max_risk: float
    message: str


class ResolveResponse(BaseModel):
    session_id: str
    entry_price: float
    exit_price: float
    forward_days: int
    ticker: str
    pnl: float
    pnl_per_leg: List[dict]
    score_awarded: int
    score_breakdown: dict
    total_score: int
    price_history: List[dict]  # [{date, price}]
    rank: str


class QuizQuestionSchema(BaseModel):
    id: str
    type: str  # "mcq" | "estimate"
    question: str
    options: Optional[List[str]] = None
    unit: Optional[str] = None  # for estimate type


class QuizResponse(BaseModel):
    lesson_id: int
    questions: List[QuizQuestionSchema]


class QuizAnswerItem(BaseModel):
    question_id: str
    answer: Union[int, float, str]  # int for MCQ index, float for estimate


class QuizSubmitRequest(BaseModel):
    user_session_id: str
    answers: List[QuizAnswerItem]


class QuizResultItem(BaseModel):
    question_id: str
    correct: bool
    correct_answer: Union[int, float, str]
    explanation: str
    formula_steps: Optional[List[str]] = None


class QuizSubmitResponse(BaseModel):
    score: int
    total: int
    percentage: float
    results: List[QuizResultItem]
    passed: bool  # score >= 60%


class PlayerScoreResponse(BaseModel):
    user_session_id: str
    total_score: int
    rounds_played: int
    total_pnl: float
    win_count: int
    win_rate: float
    best_pnl: float
    rank: str


# ---------------------------------------------------------------------------
# Scanner schemas
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Positions tracker schemas
# ---------------------------------------------------------------------------

class JournalUpdateRequest(BaseModel):
    trade_result: Optional[str] = None    # "win" | "loss" | "breakeven"
    outcome_notes: Optional[str] = None
    lesson_learned: Optional[str] = None


class PositionAddRequest(BaseModel):
    user_session_id: str
    ticker: str
    option_type: str        # "call" | "put"
    direction: str          # "long" | "short"
    strike: float
    expiry: str             # ISO date
    contracts: int = 1
    entry_price: float
    entry_date: str         # ISO date
    notes: Optional[str] = None
    is_covered: bool = False  # covered call / cash-secured put


class PositionCloseRequest(BaseModel):
    close_price: float


class PositionGreeks(BaseModel):
    iv: Optional[float] = None
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None


class PositionPnL(BaseModel):
    current_price: Optional[float] = None   # current stock price
    current_option_price: Optional[float] = None
    unrealized_pnl: Optional[float] = None  # per-contract × 100
    unrealized_pnl_pct: Optional[float] = None
    days_to_expiry: Optional[int] = None
    days_held: int
    greeks: Optional[PositionGreeks] = None


class PositionSchema(BaseModel):
    id: str
    user_session_id: str
    ticker: str
    option_type: str
    direction: str
    strike: float
    expiry: str
    contracts: int
    entry_price: float
    entry_date: str
    notes: Optional[str] = None
    status: str
    is_covered: bool = False
    close_price: Optional[float] = None
    realized_pnl: Optional[float] = None
    pnl: Optional[PositionPnL] = None
    trade_result: Optional[str] = None
    outcome_notes: Optional[str] = None
    lesson_learned: Optional[str] = None


class ScanRequest(BaseModel):
    tickers: List[str] = Field(..., description="List of tickers to scan", min_length=1, max_length=20)
    min_dte: int = Field(default=5, description="Minimum days to expiry")
    max_dte: int = Field(default=60, description="Maximum days to expiry")
    min_volume: int = Field(default=10, description="Minimum daily volume")
    min_open_interest: int = Field(default=50, description="Minimum open interest")
    strategies: List[str] = Field(
        default=["any"],
        description="Strategy filter: any, sell_premium, buy_calls, buy_puts"
    )


class EvidenceItemSchema(BaseModel):
    label: str
    value: str
    status: str       # "good" | "bad" | "neutral" | "warning"
    meaning: str
    threshold: str


class ChapterSignalSchema(BaseModel):
    chapter: str
    chapter_title: str
    signal_name: str
    score: float
    level: str
    title: str
    body: str
    strategy_hint: str
    profit_catalyst: str
    data_evidence: List[EvidenceItemSchema] = []
    entry_rules: str = ""
    exit_rules: str = ""
    risk_note: str = ""


class ProfitForecastSchema(BaseModel):
    expected_value: float
    max_profit: float
    max_loss: float
    breakeven: float
    breakeven_move_pct: float
    breakeven_vs_1sd: float
    expected_move_1sd: float
    prob_profit: float
    annualized_return_if_target: float
    scenario_bull: float
    scenario_bear: float
    scenario_flat: float
    theta_drag_total: float


class ScannerCandidateSchema(BaseModel):
    ticker: str
    current_price: float
    strike: float
    expiry: str
    option_type: str
    days_to_expiry: int
    market_price: float
    bid: float
    ask: float
    volume: int
    open_interest: int
    iv: Optional[float] = None
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None
    iv_rank: Optional[float] = None
    iv_percentile: Optional[float] = None
    hv_30: Optional[float] = None
    iv_premium: Optional[float] = None
    days_to_earnings: Optional[int] = None
    next_earnings_date: Optional[str] = None
    composite_score: float
    chapter_signals: List[ChapterSignalSchema]
    forecast: ProfitForecastSchema
    recommended_strategy: str
    strategy_rationale: str
    setup_quality: str


class ScanTickerResult(BaseModel):
    ticker: str
    current_price: float
    iv_rank: Optional[float] = None
    hv_30: Optional[float] = None
    days_to_earnings: Optional[int] = None
    candidates: List[ScannerCandidateSchema]
    error: Optional[str] = None


class ScanResponse(BaseModel):
    total_candidates: int
    results: List[ScanTickerResult]
