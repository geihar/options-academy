/**
 * Client-side Black-Scholes implementation using Abramowitz & Stegun approximation.
 * Used for instant feedback in the Simulator — no server round-trip needed.
 */

function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation (Handbook of Mathematical Functions, formula 26.2.17)
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422820 * Math.exp((-x * x) / 2)
  const p =
    d *
    t *
    (0.3193815301 +
      t * (-0.3565637813 + t * (1.7814779372 + t * (-1.8212559978 + t * 1.3302744929))))
  return x > 0 ? 1 - p : p
}

function normalPDF(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)
}

export interface BSInputs {
  S: number  // Current stock price
  K: number  // Strike price
  T: number  // Time to expiry in years
  r: number  // Risk-free rate (e.g. 0.05)
  sigma: number  // Implied volatility (e.g. 0.30)
  optionType: 'call' | 'put'
}

export interface BSOutput {
  price: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  d1: number
  d2: number
  itmProbability: number
  breakeven: number
}

export function blackScholes(inputs: BSInputs): BSOutput | null {
  const { S, K, T, r, sigma, optionType } = inputs

  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return null

  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT

  let price: number
  let delta: number
  let itmProbability: number

  if (optionType === 'call') {
    price = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
    delta = normalCDF(d1)
    itmProbability = normalCDF(d2)
  } else {
    price = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
    delta = normalCDF(d1) - 1
    itmProbability = normalCDF(-d2)
  }

  const gamma = normalPDF(d1) / (S * sigma * sqrtT)

  // Theta per day
  const thetaAnnual =
    optionType === 'call'
      ? (-(S * normalPDF(d1) * sigma) / (2 * sqrtT) -
          r * K * Math.exp(-r * T) * normalCDF(d2))
      : (-(S * normalPDF(d1) * sigma) / (2 * sqrtT) +
          r * K * Math.exp(-r * T) * normalCDF(-d2))
  const theta = thetaAnnual / 365

  // Vega per 1% move in vol
  const vega = (S * normalPDF(d1) * sqrtT) / 100

  // Rho per 1% move in rate
  const rho =
    optionType === 'call'
      ? (K * T * Math.exp(-r * T) * normalCDF(d2)) / 100
      : (-K * T * Math.exp(-r * T) * normalCDF(-d2)) / 100

  const breakeven = optionType === 'call' ? K + price : K - price

  return { price, delta, gamma, theta, vega, rho, d1, d2, itmProbability, breakeven }
}

/**
 * Compute option P&L at expiry for a range of stock prices.
 */
export function computePayoff(
  K: number,
  premium: number,
  optionType: 'call' | 'put',
  contracts: number = 1
): Array<{ stockPrice: number; pnl: number }> {
  const S_range = K * 0.7
  const S_max = K * 1.3
  const steps = 60
  const step = (S_max - S_range) / steps
  const multiplier = 100 * contracts

  const result = []
  for (let i = 0; i <= steps; i++) {
    const sp = S_range + i * step
    let intrinsic = 0
    if (optionType === 'call') {
      intrinsic = Math.max(0, sp - K)
    } else {
      intrinsic = Math.max(0, K - sp)
    }
    result.push({
      stockPrice: parseFloat(sp.toFixed(2)),
      pnl: parseFloat(((intrinsic - premium) * multiplier).toFixed(2)),
    })
  }
  return result
}

export interface PayoffLeg {
  type: 'call' | 'put'
  direction: 'long' | 'short'
  offset_pct: number   // strike = S × (1 + offset_pct/100), e.g. 0=ATM, 5=5% above, -5=5% below
  premium_pct: number  // estimated premium = S × (premium_pct/100)
}

/**
 * Compute combined at-expiry P&L for a multi-leg options strategy.
 * Uses the leg offset/premium percentages from StrategyProfile to estimate payoff shape.
 * This is an educational approximation — premiums are parametric, not live market data.
 */
export function computeMultiLegPayoff(
  S: number,
  legs: PayoffLeg[],
  contracts: number = 1,
): Array<{ stockPrice: number; pnl: number }> {
  const S_min = S * 0.65
  const S_max = S * 1.35
  const steps = 80
  const step = (S_max - S_min) / steps
  const multiplier = 100 * contracts

  const result = []
  for (let i = 0; i <= steps; i++) {
    const sp = S_min + i * step
    let totalPnl = 0
    for (const leg of legs) {
      const K = S * (1 + leg.offset_pct / 100)
      const premium = S * (leg.premium_pct / 100)
      const intrinsic = leg.type === 'call'
        ? Math.max(0, sp - K)
        : Math.max(0, K - sp)
      totalPnl += leg.direction === 'long'
        ? (intrinsic - premium) * multiplier
        : (premium - intrinsic) * multiplier
    }
    result.push({ stockPrice: parseFloat(sp.toFixed(2)), pnl: parseFloat(totalPnl.toFixed(2)) })
  }
  return result
}

/** Find stock prices where the payoff crosses zero (breakeven points). */
export function findBreakevens(data: Array<{ stockPrice: number; pnl: number }>): number[] {
  const bps: number[] = []
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1], curr = data[i]
    if ((prev.pnl < 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl < 0)) {
      const t = -prev.pnl / (curr.pnl - prev.pnl)
      bps.push(parseFloat((prev.stockPrice + t * (curr.stockPrice - prev.stockPrice)).toFixed(2)))
    }
  }
  return bps
}

export { normalCDF }
