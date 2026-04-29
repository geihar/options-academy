import { useState, useEffect, useCallback } from 'react'
import {
  Position, addPosition, listPositions, closePosition, deletePosition,
  updateJournal, fetchPortfolioGreeks, PortfolioGreeks,
} from '../api/client'

// Persistent session id (per browser)
function getSessionId(): string {
  let id = localStorage.getItem('positions_session_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('positions_session_id', id)
  }
  return id
}

const SESSION_ID = getSessionId()

// ── Helpers ───────────────────────────────────────────────────────────────────

function pnlColor(val: number | null): string {
  if (val === null) return 'text-gray-400'
  if (val > 0) return 'text-green-400'
  if (val < 0) return 'text-red-400'
  return 'text-gray-300'
}

function fmt$(val: number | null, decimals = 0): string {
  if (val === null) return '—'
  const sign = val >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(val).toFixed(decimals)}`
}

function fmtPct(val: number | null): string {
  if (val === null) return '—'
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(1)}%`
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

// ── Expiration P&L calculator ─────────────────────────────────────────────────

function ExpirationPanel({ pos }: { pos: Position }) {
  const { strike, entry_price, option_type, direction, contracts, is_covered } = pos
  const mult = 100 * contracts
  const currentOptPrice = pos.pnl?.current_option_price ?? null
  const currentPrice = pos.pnl?.current_price ?? null

  // % of max premium already captured (for short positions)
  const pctCollected = (direction === 'short' && currentOptPrice !== null)
    ? Math.max(0, Math.min(100, (1 - currentOptPrice / entry_price) * 100))
    : null

  // Covered Call — особая логика
  if (option_type === 'call' && direction === 'short' && is_covered) {
    const premiumTotal = entry_price * mult
    const effectiveSellPrice = strike + entry_price   // цена реализации с учётом премии

    // Текущий P&L на опционе
    const currentOptionPnl = currentOptPrice !== null
      ? (entry_price - currentOptPrice) * mult
      : null

    // P&L на акциях (если записан stock_cost_basis)
    const sharesOwned = pos.shares_held ?? (contracts * 100)
    const costBasis = pos.stock_cost_basis ?? null
    const stockPnl = (costBasis !== null && currentPrice !== null)
      ? (currentPrice - costBasis) * sharesOwned
      : null
    const totalCurrentPnl = (currentOptionPnl !== null && stockPnl !== null)
      ? currentOptionPnl + stockPnl
      : currentOptionPnl

    // При исполнении (акция выше страйка): получаем страйк за акции + сохраняем премию
    const assignedTotalPnl = costBasis !== null
      ? (strike - costBasis) * sharesOwned + premiumTotal  // capital gain on stock + premium
      : null

    // При экспирации без исполнения (акция ≤ страйка): держим акции + получили премию
    const flatOptionPnl = currentPrice !== null
      ? (currentPrice <= strike
          ? +premiumTotal
          : -(Math.max(0, currentPrice - strike) - entry_price) * mult)
      : null

    return (
      <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3 space-y-3">
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Покрытый колл — P&L</div>

        {/* Текущий совокупный P&L */}
        {totalCurrentPnl !== null && (
          <div className={`rounded-lg px-3 py-2 flex items-center justify-between ${totalCurrentPnl >= 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            <div>
              <div className="text-xs text-gray-400">Суммарная позиция сейчас</div>
              {stockPnl !== null && currentOptionPnl !== null && (
                <div className="text-xs text-gray-600 mt-0.5">
                  Акции: {fmt$(stockPnl)} · Опцион: {fmt$(currentOptionPnl)}
                </div>
              )}
            </div>
            <span className={`text-sm font-bold ${pnlColor(totalCurrentPnl)}`}>
              {fmt$(totalCurrentPnl)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Макс. прибыль (опцион)</div>
            <div className="text-green-400 font-bold">+${premiumTotal.toFixed(0)}</div>
            <div className="text-gray-600 mt-0.5">акция ниже ${strike}</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Если исполнят</div>
            <div className="text-blue-400 font-bold">${effectiveSellPrice.toFixed(2)}/акц.</div>
            {assignedTotalPnl !== null && (
              <div className={`mt-0.5 font-semibold ${pnlColor(assignedTotalPnl)}`}>
                Итого: {fmt$(assignedTotalPnl)}
              </div>
            )}
          </div>
          <div className="bg-gray-800/60 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Если флэт (опцион)</div>
            <div className={`font-bold ${pnlColor(flatOptionPnl)}`}>
              {flatOptionPnl !== null ? fmt$(flatOptionPnl) : '—'}
            </div>
          </div>
        </div>

        {costBasis !== null && (
          <div className="text-xs text-gray-500 flex gap-4 flex-wrap">
            <span>Себестоимость акций: ${costBasis.toFixed(2)}/акц.</span>
            <span>Акций в покрытии: {sharesOwned}</span>
            {currentPrice && <span>Текущая цена: ${currentPrice.toFixed(2)}/акц.</span>}
          </div>
        )}

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-300">
          Убытка на опционе нет — только упущенная выгода выше ${effectiveSellPrice.toFixed(2)}
          {currentPrice && currentPrice > effectiveSellPrice
            ? `. Акция $${currentPrice.toFixed(2)} — упущено +$${((currentPrice - effectiveSellPrice) * sharesOwned).toFixed(0)}`
            : ''}
        </div>

        {pctCollected !== null && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-700/50 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pctCollected}%` }} />
            </div>
            <span className="text-xs text-gray-400 shrink-0">{pctCollected.toFixed(0)}% премии уже заработано</span>
          </div>
        )}
      </div>
    )
  }

  // Cash-Secured Put — особая логика
  if (option_type === 'put' && direction === 'short' && is_covered) {
    const premiumTotal = entry_price * mult
    const costBasis = strike - entry_price   // эффективная цена покупки акций если исполнят
    const maxLossIfZero = -(strike - entry_price) * mult  // если акция → 0

    const flatPnl = currentPrice !== null
      ? (currentPrice >= strike
          ? +premiumTotal
          : -(Math.max(0, strike - currentPrice) - entry_price) * mult)
      : null

    return (
      <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3 space-y-3">
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">При экспирации — Cash-Secured Put</div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Макс. прибыль</div>
            <div className="text-green-400 font-bold">+${premiumTotal.toFixed(0)}</div>
            <div className="text-gray-600 mt-0.5">акция выше ${strike} — опцион сгорает</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Цена покупки если исполнят</div>
            <div className="text-blue-400 font-bold">${costBasis.toFixed(2)}/акц.</div>
            <div className="text-gray-600 mt-0.5">страйк ${strike} − премия ${entry_price}</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Если флэт</div>
            <div className={`font-bold ${pnlColor(flatPnl)}`}>
              {flatPnl !== null ? fmt$(flatPnl) : '—'}
            </div>
          </div>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300">
          Худший сценарий: акция → $0, убыток ${Math.abs(maxLossIfZero).toFixed(0)} (но акции куплены по ${costBasis.toFixed(2)}, не по ${strike})
        </div>

        {pctCollected !== null && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-700/50 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pctCollected}%` }} />
            </div>
            <span className="text-xs text-gray-400 shrink-0">{pctCollected.toFixed(0)}% премии уже заработано</span>
          </div>
        )}
      </div>
    )
  }

  // Naked Short Call
  if (option_type === 'call' && direction === 'short' && !is_covered) {
    const premiumTotal = entry_price * mult
    const breakeven = strike + entry_price
    const flatPnl = currentPrice !== null
      ? -(Math.max(0, currentPrice - strike) - entry_price) * mult
      : null

    return (
      <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3 space-y-3">
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">При экспирации — Непокрытый колл</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Макс. прибыль</div>
            <div className="text-green-400 font-bold">+${premiumTotal.toFixed(0)}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Макс. убыток</div>
            <div className="text-red-400 font-bold">Неогранич.</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Безубыток</div>
            <div className="text-white font-bold">${breakeven.toFixed(2)}</div>
          </div>
        </div>
        {flatPnl !== null && (
          <div className="text-xs text-gray-500">
            Если акция останется на ${currentPrice?.toFixed(2)}: <span className={`font-bold ${pnlColor(flatPnl)}`}>{fmt$(flatPnl)}</span>
          </div>
        )}
        {pctCollected !== null && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-700/50 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pctCollected}%` }} />
            </div>
            <span className="text-xs text-gray-400 shrink-0">{pctCollected.toFixed(0)}% премии уже заработано</span>
          </div>
        )}
      </div>
    )
  }

  // Long Call
  if (option_type === 'call' && direction === 'long') {
    const maxLoss = -entry_price * mult
    const breakeven = strike + entry_price
    const flatPnl = currentPrice !== null
      ? (Math.max(0, currentPrice - strike) - entry_price) * mult
      : null
    return (
      <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3 space-y-2">
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">При экспирации — Long Call</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Макс. прибыль</div>
            <div className="text-green-400 font-bold">∞</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Макс. убыток</div>
            <div className="text-red-400 font-bold">-${Math.abs(maxLoss).toFixed(0)}</div>
            <div className="text-gray-600 mt-0.5">только уплаченная премия</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Безубыток</div>
            <div className="text-white font-bold">${breakeven.toFixed(2)}</div>
          </div>
        </div>
        {flatPnl !== null && (
          <div className="text-xs text-gray-500">
            Если акция останется на ${currentPrice?.toFixed(2)}: <span className={`font-bold ${pnlColor(flatPnl)}`}>{fmt$(flatPnl)}</span>
          </div>
        )}
      </div>
    )
  }

  // Long Put
  if (option_type === 'put' && direction === 'long') {
    const maxLoss = -entry_price * mult
    const maxProfit = (strike - entry_price) * mult
    const breakeven = strike - entry_price
    const flatPnl = currentPrice !== null
      ? (Math.max(0, strike - currentPrice) - entry_price) * mult
      : null
    return (
      <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3 space-y-2">
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">При экспирации — Long Put</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Макс. прибыль</div>
            <div className="text-green-400 font-bold">+${maxProfit.toFixed(0)}</div>
            <div className="text-gray-600 mt-0.5">если акция → $0</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Макс. убыток</div>
            <div className="text-red-400 font-bold">-${Math.abs(maxLoss).toFixed(0)}</div>
            <div className="text-gray-600 mt-0.5">только уплаченная премия</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-2 text-center">
            <div className="text-gray-500 mb-0.5">Безубыток</div>
            <div className="text-white font-bold">${breakeven.toFixed(2)}</div>
          </div>
        </div>
        {flatPnl !== null && (
          <div className="text-xs text-gray-500">
            Если акция останется на ${currentPrice?.toFixed(2)}: <span className={`font-bold ${pnlColor(flatPnl)}`}>{fmt$(flatPnl)}</span>
          </div>
        )}
      </div>
    )
  }

  // Short Put (naked)
  const premiumTotal = entry_price * mult
  const costBasis = strike - entry_price
  const maxLossIfZero = -(strike - entry_price) * mult
  const flatPnl = currentPrice !== null
    ? -(Math.max(0, strike - currentPrice) - entry_price) * mult
    : null

  return (
    <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3 space-y-2">
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">При экспирации — Short Put</div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
          <div className="text-gray-500 mb-0.5">Макс. прибыль</div>
          <div className="text-green-400 font-bold">+${premiumTotal.toFixed(0)}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
          <div className="text-gray-500 mb-0.5">Худший сценарий</div>
          <div className="text-red-400 font-bold">-${Math.abs(maxLossIfZero).toFixed(0)}</div>
          <div className="text-gray-600 mt-0.5">акция → $0</div>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-2 text-center">
          <div className="text-gray-500 mb-0.5">Цена покупки</div>
          <div className="text-white font-bold">${costBasis.toFixed(2)}/акц.</div>
          <div className="text-gray-600 mt-0.5">если исполнят</div>
        </div>
      </div>
      {flatPnl !== null && (
        <div className="text-xs text-gray-500">
          Если акция останется на ${currentPrice?.toFixed(2)}: <span className={`font-bold ${pnlColor(flatPnl)}`}>{fmt$(flatPnl)}</span>
        </div>
      )}
      {pctCollected !== null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-700/50 rounded-full h-1.5">
            <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pctCollected}%` }} />
          </div>
          <span className="text-xs text-gray-400 shrink-0">{pctCollected.toFixed(0)}% премии уже заработано</span>
        </div>
      )}
    </div>
  )
}


// ── Smart signals ─────────────────────────────────────────────────────────────

interface Signal {
  level: 'danger' | 'warning' | 'success' | 'info'
  text: string
}

const SIGNAL_STYLES: Record<Signal['level'], string> = {
  danger:  'bg-red-500/15 border-red-500/30 text-red-400',
  warning: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
  success: 'bg-green-500/15 border-green-500/30 text-green-400',
  info:    'bg-blue-500/15 border-blue-500/30 text-blue-400',
}

function computeSignals(pos: Position): Signal[] {
  const signals: Signal[] = []
  const pnl = pos.pnl
  const dte = pnl?.days_to_expiry
  const delta = pnl?.greeks?.delta
  const currentOptPrice = pnl?.current_option_price
  const mult = 100 * pos.contracts

  // DTE alerts
  if (dte !== null && dte !== undefined) {
    if (dte <= 3) {
      signals.push({ level: 'danger', text: `Экспирация через ${dte} дн. — действуй!` })
    } else if (dte <= 7) {
      signals.push({ level: 'warning', text: `Экспирация через ${dte} дн. — проверь позицию` })
    } else if (dte <= 21 && pos.direction === 'long') {
      signals.push({ level: 'warning', text: 'Тета ускоряется — < 21 дн. до экспирации' })
    }
  }

  // Assignment risk for short options
  if (pos.direction === 'short' && delta !== null && delta !== undefined) {
    const absDelta = Math.abs(delta)
    if (absDelta > 0.70) {
      signals.push({ level: 'danger', text: `Высокий риск исполнения (Δ ${delta.toFixed(2)})` })
    } else if (absDelta > 0.50) {
      signals.push({ level: 'warning', text: `Риск исполнения (Δ ${delta.toFixed(2)})` })
    }
  }

  // Profit target for short options
  if (pos.direction === 'short' && currentOptPrice !== null && currentOptPrice !== undefined) {
    const pctCollected = (1 - currentOptPrice / pos.entry_price) * 100
    if (pctCollected >= 75) {
      signals.push({ level: 'success', text: `${pctCollected.toFixed(0)}% прибыли — отличный момент для закрытия` })
    } else if (pctCollected >= 50) {
      signals.push({ level: 'success', text: `${pctCollected.toFixed(0)}% от максимума — рассмотри закрытие` })
    }
  }

  // Long option likely expiring worthless
  if (pos.direction === 'long' && delta !== null && delta !== undefined) {
    if (Math.abs(delta) < 0.10) {
      signals.push({ level: 'danger', text: 'Опцион глубоко OTM — вероятно истечёт без ценности' })
    } else if (Math.abs(delta) < 0.20) {
      signals.push({ level: 'warning', text: 'Опцион OTM — оцени выход' })
    }
  }

  // Theta benefit for short positions
  if (pos.direction === 'short' && pnl?.greeks?.theta !== null && pnl?.greeks?.theta !== undefined) {
    const dailyTheta = Math.abs(pnl.greeks.theta) * mult
    if (dailyTheta >= 1) {
      signals.push({ level: 'info', text: `Тета приносит $${dailyTheta.toFixed(2)}/день` })
    }
  }

  // Naked short call warning
  if (pos.direction === 'short' && pos.option_type === 'call' && !pos.is_covered) {
    signals.push({ level: 'warning', text: 'Непокрытый short call — неограниченный риск' })
  }

  return signals
}

function SignalChips({ pos }: { pos: Position }) {
  const signals = computeSignals(pos)
  if (signals.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((s, i) => (
        <span
          key={i}
          className={`text-xs px-2 py-0.5 rounded border font-medium ${SIGNAL_STYLES[s.level]}`}
        >
          {s.text}
        </span>
      ))}
    </div>
  )
}

// ── Position Advice Panel ─────────────────────────────────────────────────────

type AdviceType =
  | 'close_now'
  | 'consider_closing'
  | 'roll'
  | 'take_profit'
  | 'cut_loss'
  | 'monitor'
  | 'hold'

interface Advice {
  type: AdviceType
  title: string
  reason: string
  detail: string
  urgency: 'high' | 'medium' | 'low'
}

const ADVICE_STYLES: Record<Advice['urgency'], { border: string; bg: string; title: string; badge: string }> = {
  high:   { border: 'border-amber-500/40',  bg: 'bg-amber-500/8',  title: 'text-amber-300',  badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  medium: { border: 'border-blue-500/30',   bg: 'bg-blue-500/5',   title: 'text-blue-300',   badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  low:    { border: 'border-gray-600/40',   bg: 'bg-gray-800/30',  title: 'text-gray-300',   badge: 'bg-gray-700/50 text-gray-400 border-gray-600/40' },
}

const ADVICE_ICONS: Record<AdviceType, string> = {
  close_now:       '🎯',
  consider_closing:'💡',
  roll:            '🔄',
  take_profit:     '💰',
  cut_loss:        '⛔',
  monitor:         '👁',
  hold:            '✅',
}

function computeAdvice(pos: Position): Advice | null {
  const pnl = pos.pnl
  if (!pnl) return null

  const dte = pnl.days_to_expiry ?? 0
  const daysHeld = pnl.days_held ?? 0
  const totalDays = daysHeld + dte
  const currentOptPrice = pnl.current_option_price
  const unrealPnlPct = pnl.unrealized_pnl_pct
  const unrealPnl = pnl.unrealized_pnl
  const delta = pnl.greeks?.delta ?? null
  const theta = pnl.greeks?.theta ?? null
  const contracts = pos.contracts
  const mult = 100 * contracts

  // ── SHORT POSITIONS ────────────────────────────────────────────────────────
  if (pos.direction === 'short' && currentOptPrice !== null && currentOptPrice !== undefined) {
    const pctCollected = Math.max(0, (1 - currentOptPrice / pos.entry_price) * 100)
    const capturedDollars = (pos.entry_price - currentOptPrice) * mult
    const remainingDollars = currentOptPrice * mult
    const timeElapsedPct = totalDays > 0 ? (daysHeld / totalDays) * 100 : 0
    const efficiency = timeElapsedPct > 0 ? pctCollected / timeElapsedPct : 0
    const dailyThetaIncome = theta !== null ? Math.abs(theta) * mult : null
    const daysToRecoupRemaining = dailyThetaIncome && dailyThetaIncome > 0
      ? remainingDollars / dailyThetaIncome
      : null

    // Premiums that are already deeply in loss (option doubled against us)
    if (currentOptPrice > pos.entry_price * 1.5) {
      const lossDollars = (currentOptPrice - pos.entry_price) * mult
      const absDelta = delta !== null ? Math.abs(delta) : null
      return {
        type: 'cut_loss',
        title: 'Позиция в убытке — оцени выход',
        reason: `Опцион вырос с $${pos.entry_price.toFixed(2)} до $${currentOptPrice.toFixed(2)} — убыток $${lossDollars.toFixed(0)}.`,
        detail: `${absDelta !== null ? `Дельта ${absDelta.toFixed(2)} — опцион всё сильнее реагирует на движение цены. ` : ''}` +
          `Ждать экспирации при убытке рискованно: убыток может расти быстрее, чем тета его компенсирует. ` +
          `Рассмотри закрытие, чтобы зафиксировать контролируемый убыток, и возможно переоткрытие позиции на лучших условиях.`,
        urgency: 'high',
      }
    }

    // 75%+ collected — strong close signal
    if (pctCollected >= 75) {
      return {
        type: 'close_now',
        title: `${pctCollected.toFixed(0)}% премии поймано — отличный момент для выхода`,
        reason: `Заработано $${capturedDollars.toFixed(0)} из $${(pos.entry_price * mult).toFixed(0)} максимальной прибыли. ` +
          `Оставшиеся $${remainingDollars.toFixed(0)} — это уже больше риск, чем потенциал.`,
        detail: `Классическое правило: закрывать короткие опционы при 50–75% собранной премии. ` +
          `${daysToRecoupRemaining !== null ? `При текущей тете ($${dailyThetaIncome!.toFixed(2)}/день) на сбор оставшегося уйдёт ~${Math.ceil(daysToRecoupRemaining)} дней — ` : ''}` +
          `это время в рынке, а значит риск. Закрытие сейчас фиксирует прибыль и освобождает капитал для новой позиции.`,
        urgency: 'high',
      }
    }

    // High efficiency — captured a lot in short time
    if (pctCollected >= 50 && efficiency >= 1.8 && daysHeld <= 14) {
      return {
        type: 'consider_closing',
        title: `${pctCollected.toFixed(0)}% за ${daysHeld} дней — эффективность ${efficiency.toFixed(1)}×`,
        reason: `Поймано ${pctCollected.toFixed(0)}% премии при ${timeElapsedPct.toFixed(0)}% прошедшего времени. ` +
          `Это ${efficiency.toFixed(1)}× лучше «нормального» темпа.`,
        detail: `Когда прибыль приходит быстро — это сигнал: оставшийся потенциал ($${remainingDollars.toFixed(0)}) уже несоразмерен риску держать ещё ${dte} дней. ` +
          `Закрой и повтори: новая позиция за следующие ${daysHeld} дней принесёт ещё столько же при лучшем соотношении риск/доходность.`,
        urgency: 'medium',
      }
    }

    // 50%+ collected — standard rule
    if (pctCollected >= 50) {
      return {
        type: 'consider_closing',
        title: `${pctCollected.toFixed(0)}% премии поймано — рассмотри закрытие`,
        reason: `Заработано $${capturedDollars.toFixed(0)}. Оставшийся потенциал: $${remainingDollars.toFixed(0)} за ${dte} дней.`,
        detail: `Правило 50%: большинство профессиональных продавцов опционов закрывают позицию при 50% собранной премии. ` +
          `${dailyThetaIncome !== null ? `Тета сейчас $${dailyThetaIncome.toFixed(2)}/день. ` : ''}` +
          `По мере приближения экспирации тета сначала растёт, но и гамма-риск (резкие движения) тоже увеличивается. ` +
          (pos.is_covered
            ? `Для покрытого ${pos.option_type === 'call' ? 'колла' : 'пута'} выход позволит переоткрыть на следующий цикл.`
            : `Фиксация прибыли сейчас снижает хвостовой риск.`),
        urgency: 'medium',
      }
    }

    // Roll opportunity: close to expiry with decent profit
    if (dte <= 14 && pctCollected >= 40) {
      return {
        type: 'roll',
        title: `${dte} дней до экспирации — рассмотри роллирование`,
        reason: `Поймано ${pctCollected.toFixed(0)}% ($${capturedDollars.toFixed(0)}). Экспирация близко.`,
        detail: `Роллирование: закрой текущую позицию (фиксируй $${capturedDollars.toFixed(0)}) и открой аналогичную на следующий месяц. ` +
          `Это позволяет продолжать получать тету, не дожидаясь рискованных последних дней перед экспирацией. ` +
          `${pos.is_covered && pos.option_type === 'call' ? `Для покрытого колла — стандартная практика продавцов, которые хотят продолжать получать доход с акций.` : ''}`,
        urgency: 'medium',
      }
    }

    // Good progress, hold
    if (pctCollected >= 25) {
      return {
        type: 'monitor',
        title: `${pctCollected.toFixed(0)}% собрано — позиция развивается нормально`,
        reason: `Заработано $${capturedDollars.toFixed(0)}, осталось собрать $${remainingDollars.toFixed(0)} за ${dte} дней.`,
        detail: `${dailyThetaIncome !== null ? `Тета приносит $${dailyThetaIncome.toFixed(2)}/день. ` : ''}` +
          `Целевая точка для закрытия — 50% ($${(pos.entry_price * mult * 0.5).toFixed(0)}) или 75% ($${(pos.entry_price * mult * 0.75).toFixed(0)}). ` +
          `Следи за дельтой${delta !== null ? ` (сейчас ${Math.abs(delta).toFixed(2)})` : ''}: если она растёт выше 0.50, риск исполнения увеличивается.`,
        urgency: 'low',
      }
    }

    // Early stage
    return {
      type: 'hold',
      title: 'Позиция открыта — держи согласно плану',
      reason: `Прошло ${daysHeld} дн., поймано ${pctCollected.toFixed(0)}% от максимума ($${capturedDollars.toFixed(0)}).`,
      detail: `${dailyThetaIncome !== null ? `Тета работает в твою пользу: $${dailyThetaIncome.toFixed(2)}/день. ` : ''}` +
        `Следующая цель — 50% (${(pos.entry_price * 0.5).toFixed(2)} цена опциона). ` +
        `Пока тета не снизилась и дельта${delta !== null ? ` (${Math.abs(delta).toFixed(2)})` : ''} в норме — позиция ведёт себя ожидаемо.`,
      urgency: 'low',
    }
  }

  // ── LONG POSITIONS ─────────────────────────────────────────────────────────
  if (pos.direction === 'long') {
    const pnlPct = unrealPnlPct ?? 0
    const pnlDollars = unrealPnl ?? 0
    const absDelta = delta !== null ? Math.abs(delta) : null
    const dailyThetaLoss = theta !== null ? Math.abs(theta) * mult : null
    const daysToExpiry = dte

    // Deep profit — take some off the table
    if (pnlPct >= 100) {
      return {
        type: 'take_profit',
        title: `+${pnlPct.toFixed(0)}% — позиция удвоилась`,
        reason: `Прибыль $${pnlDollars.toFixed(0)} за ${daysHeld} дней.`,
        detail: `Фиксация части позиции при 100%+ прибыли — разумная практика. Ты можешь продать половину контрактов (фиксируешь прибыль) и оставить остаток работать. ` +
          `Это снижает риск «вернуть всё обратно» рынку. Если идея ещё актуальна — оставь часть.`,
        urgency: 'medium',
      }
    }

    if (pnlPct >= 50) {
      return {
        type: 'take_profit',
        title: `+${pnlPct.toFixed(0)}% прибыли — рассмотри фиксацию`,
        reason: `Заработано $${pnlDollars.toFixed(0)}. Осталось ${daysToExpiry} дней до экспирации.`,
        detail: `Хороший результат. Если твой тезис «акция вырастет» реализовался — можно зафиксировать прибыль. ` +
          `Если ожидаешь продолжения движения — можно держать, но помни: тета начинает давить сильнее ближе к экспирации.`,
        urgency: 'low',
      }
    }

    // Deep loss with little delta and little time — likely dying
    if (pnlPct <= -50 && absDelta !== null && absDelta < 0.20 && daysToExpiry <= 21) {
      return {
        type: 'cut_loss',
        title: `${pnlPct.toFixed(0)}% убытка, Δ=${absDelta.toFixed(2)}, ${daysToExpiry} дней — маловероятно восстановление`,
        reason: `Опцион глубоко OTM при малом количестве дней до экспирации.`,
        detail: `Три фактора против: убыток ${Math.abs(pnlPct).toFixed(0)}%, низкая дельта (${absDelta.toFixed(2)} — опцион слабо реагирует на движение акции), ` +
          `${dailyThetaLoss !== null ? `и тета съедает $${dailyThetaLoss.toFixed(2)}/день. ` : ''}` +
          `Для выхода в безубыток нужно очень резкое движение за ${daysToExpiry} дней. ` +
          `Закрытие позволяет сохранить оставшийся капитал ($${(currentOptPrice !== null && currentOptPrice !== undefined ? currentOptPrice * mult : 0).toFixed(0)}).`,
        urgency: 'high',
      }
    }

    // Standard stop-loss trigger
    if (pnlPct <= -50) {
      return {
        type: 'cut_loss',
        title: `${pnlPct.toFixed(0)}% убытка — пробит стоп 50%`,
        reason: `Потеряно $${Math.abs(pnlDollars).toFixed(0)} от вложенных $${(pos.entry_price * mult).toFixed(0)}.`,
        detail: `Правило стоп-лосса для покупателей опционов: закрывать при -50% чтобы не потерять всю премию. ` +
          `${daysToExpiry > 21 ? `У тебя ещё ${daysToExpiry} дней — если тезис изменился, выход оправдан. Если нет — оцени, что должно произойти с акцией.` : `До экспирации ${daysToExpiry} дней — время поджимает.`}`,
        urgency: 'high',
      }
    }

    // Theta warning in last 21 days with a losing position
    if (daysToExpiry <= 21 && pnlPct < -10 && dailyThetaLoss !== null) {
      return {
        type: 'monitor',
        title: `${daysToExpiry} дней до экспирации — тета ускоряется`,
        reason: `${pnlPct.toFixed(0)}% P&L. Тета: $${dailyThetaLoss.toFixed(2)}/день против позиции.`,
        detail: `В последние 21 день временно́й распад ускоряется. Если акция не делает нужного движения, опцион будет дешеветь всё быстрее. ` +
          `Оцени: насколько реален твой тезис в оставшееся время? Если не уверен — зафиксируй убыток пока есть оставшаяся стоимость ($${(currentOptPrice !== null && currentOptPrice !== undefined ? currentOptPrice * mult : 0).toFixed(0)}).`,
        urgency: 'medium',
      }
    }

    // In profit but early
    if (pnlPct > 0) {
      return {
        type: 'hold',
        title: `+${pnlPct.toFixed(0)}% — позиция в прибыли, держи`,
        reason: `$${pnlDollars.toFixed(0)} прибыли за ${daysHeld} дней, ${daysToExpiry} дней до экспирации.`,
        detail: `Позиция развивается в нужном направлении. ${dailyThetaLoss !== null ? `Тета: $${dailyThetaLoss.toFixed(2)}/день — нормальная стоимость удержания. ` : ''}` +
          `Если изначальный тезис сохраняется — держи согласно плану. Цель: ${pnlPct < 100 ? '+100% (удвоение)' : 'продолжай мониторить'}.`,
        urgency: 'low',
      }
    }

    // Modest loss, plenty of time
    return {
      type: 'hold',
      title: `${pnlPct.toFixed(0)}% — ещё в пределах нормы`,
      reason: `${daysHeld} дней держим, ${daysToExpiry} дней впереди.`,
      detail: `${dailyThetaLoss !== null ? `Тета: $${dailyThetaLoss.toFixed(2)}/день. ` : ''}` +
        `Потери пока в пределах нормы. Следи за тем, движется ли акция в нужном направлении. ` +
        `Стоп-лосс — при достижении -50% от уплаченной премии ($${(pos.entry_price * mult * 0.5).toFixed(0)}).`,
      urgency: 'low',
    }
  }

  return null
}

function PositionAdvicePanel({ pos }: { pos: Position }) {
  const advice = computeAdvice(pos)
  if (!advice) return null
  const styles = ADVICE_STYLES[advice.urgency]
  const icon = ADVICE_ICONS[advice.type]
  return <PositionAdvicePanelInner advice={advice} styles={styles} icon={icon} />
}

function PositionAdvicePanelInner({ advice, styles, icon }: {
  advice: Advice
  styles: typeof ADVICE_STYLES['low']
  icon: string
}) {
  const [expanded, setExpanded] = useState(advice.urgency === 'high')

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span>{icon}</span>
          <span className={`text-xs font-semibold ${styles.title} leading-tight`}>{advice.title}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ml-2 font-medium ${styles.badge}`}>
          {advice.urgency === 'high' ? 'Важно' : advice.urgency === 'medium' ? 'Совет' : 'Инфо'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5">
          <p className="text-xs text-gray-300 leading-relaxed pt-2">{advice.reason}</p>
          <p className="text-xs text-gray-400 leading-relaxed">{advice.detail}</p>
        </div>
      )}
    </div>
  )
}

// ── Add Position Form ─────────────────────────────────────────────────────────

interface FormState {
  ticker: string
  option_type: 'call' | 'put'
  direction: 'long' | 'short'
  strike: string
  expiry: string
  contracts: string
  entry_price: string
  entry_date: string
  notes: string
  is_covered: boolean
  shares_held: string
  stock_cost_basis: string
}

const EMPTY_FORM: FormState = {
  ticker: '',
  option_type: 'call',
  direction: 'long',
  strike: '',
  expiry: '',
  contracts: '1',
  entry_price: '',
  entry_date: today(),
  notes: '',
  is_covered: false,
  shares_held: '',
  stock_cost_basis: '',
}

function AddPositionForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.ticker || !form.strike || !form.expiry || !form.entry_price) {
      setError('Заполните все обязательные поля')
      return
    }
    setLoading(true)
    try {
      const isCovered = form.direction === 'short' ? form.is_covered : false
      await addPosition({
        user_session_id: SESSION_ID,
        ticker: form.ticker.toUpperCase(),
        option_type: form.option_type,
        direction: form.direction,
        strike: parseFloat(form.strike),
        expiry: form.expiry,
        contracts: parseInt(form.contracts) || 1,
        entry_price: parseFloat(form.entry_price),
        entry_date: form.entry_date,
        notes: form.notes || undefined,
        is_covered: isCovered,
        shares_held: isCovered && form.shares_held ? parseInt(form.shares_held) : undefined,
        stock_cost_basis: isCovered && form.stock_cost_basis ? parseFloat(form.stock_cost_basis) : undefined,
      })
      setForm(EMPTY_FORM)
      onAdded()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Ошибка добавления позиции')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500'
  const labelCls = 'block text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1'

  const isShort = form.direction === 'short'
  const coveredLabel = form.option_type === 'call'
    ? 'Покрытый (есть акции)'
    : 'Cash-secured (есть кэш)'

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="text-base font-semibold text-white">Добавить позицию</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Тикер *</label>
          <input value={form.ticker} onChange={set('ticker')} placeholder="AAPL" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Тип *</label>
          <select value={form.option_type} onChange={set('option_type')} className={inputCls}>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Направление *</label>
          <select value={form.direction} onChange={set('direction')} className={inputCls}>
            <option value="long">Long (покупка)</option>
            <option value="short">Short (продажа)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Контрактов</label>
          <input type="number" min="1" value={form.contracts} onChange={set('contracts')} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Страйк *</label>
          <input type="number" step="0.5" placeholder="150" value={form.strike} onChange={set('strike')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Экспирация *</label>
          <input type="date" value={form.expiry} onChange={set('expiry')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Цена входа *</label>
          <input type="number" step="0.01" placeholder="3.50" value={form.entry_price} onChange={set('entry_price')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Дата входа</label>
          <input type="date" value={form.entry_date} onChange={set('entry_date')} className={inputCls} />
        </div>
      </div>

      {isShort && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={form.is_covered}
              onChange={e => setForm(f => ({ ...f, is_covered: e.target.checked }))}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-gray-300">{coveredLabel}</span>
          </label>

          {form.is_covered && (
            <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-blue-500/30">
              <div>
                <label className={labelCls}>Акций в покрытии</label>
                <input
                  type="number"
                  min="1"
                  step="100"
                  placeholder={`${(parseInt(form.contracts) || 1) * 100}`}
                  value={form.shares_held}
                  onChange={set('shares_held')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {form.option_type === 'call' ? 'Себест. акции ($/акц.)' : 'Резерв кэша ($/акц.)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="150.00"
                  value={form.stock_cost_basis}
                  onChange={set('stock_cost_basis')}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2 text-xs text-gray-600">
                {form.option_type === 'call'
                  ? 'Укажите среднюю цену покупки акций для расчёта суммарного P&L позиции'
                  : 'Укажите резервируемую сумму на акцию для расчёта доходности на капитал'}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className={labelCls}>Заметки</label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          placeholder="Тезис, уровни SL/TP..."
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
      >
        {loading ? 'Добавление...' : '+ Добавить позицию'}
      </button>
    </form>
  )
}

// ── Close Position Modal ───────────────────────────────────────────────────────

function CloseModal({
  pos,
  onClose,
  onDone,
}: {
  pos: Position
  onClose: () => void
  onDone: () => void
}) {
  const [price, setPrice] = useState(
    pos.pnl?.current_option_price?.toFixed(2) ?? pos.entry_price.toFixed(2)
  )
  const [loading, setLoading] = useState(false)

  const closePrice = parseFloat(price) || 0
  const sign = pos.direction === 'long' ? 1 : -1
  const pnl = sign * (closePrice - pos.entry_price) * 100 * pos.contracts

  // Show what % of max profit this is for short positions
  const maxProfit = pos.direction === 'short' ? pos.entry_price * 100 * pos.contracts : null
  const pctOfMax = maxProfit && maxProfit > 0 ? (pnl / maxProfit * 100) : null

  const handleClose = async () => {
    setLoading(true)
    try {
      await closePosition(pos.id, closePrice)
      onDone()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm space-y-4 mx-4">
        <h3 className="text-white font-semibold">Закрыть позицию</h3>
        <div className="text-sm text-gray-400">
          {pos.ticker} ${pos.strike} {pos.option_type.toUpperCase()} — {pos.direction === 'long' ? 'Long' : 'Short'}, {pos.contracts} контр.
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Цена закрытия</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className={`text-center text-xl font-bold ${pnlColor(pnl)}`}>
          Реализованный P&L: {fmt$(pnl)}
        </div>
        {pctOfMax !== null && (
          <div className="text-center text-sm text-gray-400">
            {pctOfMax.toFixed(0)}% от максимальной прибыли
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm transition-colors">
            Отмена
          </button>
          <button onClick={handleClose} disabled={loading} className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {loading ? '...' : 'Закрыть'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Position Card ──────────────────────────────────────────────────────────────

const RESULT_OPTIONS = [
  { value: 'win',        label: 'Прибыль',    color: 'text-green-400 bg-green-500/15 border-green-500/30' },
  { value: 'loss',       label: 'Убыток',     color: 'text-red-400 bg-red-500/15 border-red-500/30' },
  { value: 'breakeven',  label: 'Безубыток',  color: 'text-gray-300 bg-gray-700/40 border-gray-600/40' },
]

function resultBadge(r: string | null | undefined) {
  const opt = RESULT_OPTIONS.find(o => o.value === r)
  if (!opt) return null
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${opt.color}`}>{opt.label}</span>
  )
}

function JournalSection({ pos, onSaved }: { pos: Position; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [result, setResult] = useState(pos.trade_result ?? '')
  const [notes, setNotes] = useState(pos.outcome_notes ?? '')
  const [lesson, setLesson] = useState(pos.lesson_learned ?? '')
  const [saving, setSaving] = useState(false)

  const hasJournal = pos.trade_result || pos.outcome_notes || pos.lesson_learned

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateJournal(pos.id, {
        trade_result: result || undefined,
        outcome_notes: notes || undefined,
        lesson_learned: lesson || undefined,
      })
      setEditing(false)
      onSaved()
    } catch {
    } finally {
      setSaving(false)
    }
  }

  if (!editing && !hasJournal) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full py-2 text-xs text-gray-600 hover:text-gray-400 border border-dashed border-gray-700/60 hover:border-gray-600 rounded-lg transition-colors"
      >
        + Добавить запись в журнал
      </button>
    )
  }

  if (!editing) {
    return (
      <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Журнал сделки</div>
          <button onClick={() => setEditing(true)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">редактировать</button>
        </div>
        {pos.trade_result && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Результат:</span>
            {resultBadge(pos.trade_result)}
          </div>
        )}
        {pos.outcome_notes && (
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Итог:</div>
            <p className="text-xs text-gray-300 leading-relaxed">{pos.outcome_notes}</p>
          </div>
        )}
        {pos.lesson_learned && (
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Урок:</div>
            <p className="text-xs text-blue-300 leading-relaxed">{pos.lesson_learned}</p>
          </div>
        )}
      </div>
    )
  }

  const inputCls = 'w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-xs border border-gray-700 focus:outline-none focus:border-blue-500 resize-none'

  return (
    <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3 space-y-3">
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Журнал сделки</div>

      <div>
        <div className="text-xs text-gray-500 mb-1.5">Результат сделки</div>
        <div className="flex gap-2">
          {RESULT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setResult(result === opt.value ? '' : opt.value)}
              className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors font-medium
                ${result === opt.value ? opt.color : 'text-gray-500 bg-gray-800 border-gray-700 hover:border-gray-600'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-500 mb-1">Что произошло?</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Как развивалась сделка, что сработало или нет..."
          rows={2}
          className={inputCls}
        />
      </div>

      <div>
        <div className="text-xs text-gray-500 mb-1">Что я узнал?</div>
        <textarea
          value={lesson}
          onChange={e => setLesson(e.target.value)}
          placeholder="Что применю в следующий раз..."
          rows={2}
          className={inputCls}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-3 py-2 rounded-lg bg-gray-700 text-gray-400 hover:text-white text-xs transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

function PositionCard({
  pos,
  onClose,
  onDelete,
  onJournalSaved,
}: {
  pos: Position
  onClose: () => void
  onDelete: () => void
  onJournalSaved: () => void
}) {
  const [showClose, setShowClose] = useState(false)
  const [showExpiry, setShowExpiry] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const pnl = pos.pnl
  const typeColor = pos.option_type === 'call' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
  const dirColor = pos.direction === 'long' ? 'text-blue-400 bg-blue-500/10' : 'text-orange-400 bg-orange-500/10'
  const isShort = pos.direction === 'short'

  const handleDelete = async () => {
    if (!confirm('Удалить позицию?')) return
    setDeleting(true)
    try { await deletePosition(pos.id); onDelete() } catch { setDeleting(false) }
  }

  // Covered/naked badge for short positions
  const coverageBadge = isShort
    ? pos.is_covered
      ? <span className="text-xs px-2 py-0.5 rounded border font-semibold text-green-400 bg-green-500/10 border-green-500/30">Покрытый</span>
      : <span className="text-xs px-2 py-0.5 rounded border font-semibold text-orange-400 bg-orange-500/10 border-orange-500/30">Непокрытый</span>
    : null

  return (
    <>
      <div className={`card space-y-3 ${pos.status === 'closed' ? 'opacity-60' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-white">{pos.ticker}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${typeColor}`}>
              {pos.option_type.toUpperCase()}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${dirColor}`}>
              {pos.direction === 'long' ? 'Long' : 'Short'}
            </span>
            {coverageBadge}
            <span className="text-gray-400 text-sm">
              ${pos.strike} · {pos.expiry}
            </span>
            <span className="text-gray-500 text-xs">{pos.contracts} контр.</span>
          </div>
          <div className="flex items-center gap-2">
            {pos.status === 'closed' && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">Закрыта</span>
            )}
            {pos.status === 'open' && pnl?.days_to_expiry !== undefined && pnl.days_to_expiry !== null && (
              <span className={`text-xs px-2 py-0.5 rounded ${pnl.days_to_expiry <= 7 ? 'bg-red-500/15 text-red-400' : 'bg-gray-700 text-gray-300'}`}>
                {pnl.days_to_expiry} дн. до экспир.
              </span>
            )}
          </div>
        </div>

        {/* Smart signals */}
        {pos.status === 'open' && <SignalChips pos={pos} />}

        {/* Advice panel */}
        {pos.status === 'open' && <PositionAdvicePanel pos={pos} />}

        {/* P&L row */}
        {pos.status === 'open' && pnl && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-gray-400 mb-0.5">Цена акции</div>
              <div className="text-white font-semibold">
                {pnl.current_price ? `$${pnl.current_price.toFixed(2)}` : '—'}
              </div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-gray-400 mb-0.5">Текущая цена опц.</div>
              <div className="text-white font-semibold">
                {pnl.current_option_price != null ? `$${pnl.current_option_price.toFixed(2)}` : '—'}
              </div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-gray-400 mb-0.5">Нереализ. P&L</div>
              <div className={`font-bold ${pnlColor(pnl.unrealized_pnl)}`}>
                {fmt$(pnl.unrealized_pnl)}
              </div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-2 text-center">
              <div className="text-gray-400 mb-0.5">% изменение</div>
              <div className={`font-bold ${pnlColor(pnl.unrealized_pnl_pct)}`}>
                {fmtPct(pnl.unrealized_pnl_pct)}
              </div>
            </div>
          </div>
        )}

        {/* Closed P&L */}
        {pos.status === 'closed' && pos.realized_pnl !== null && (
          <div className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-2">
            <span className="text-xs text-gray-400">Реализованный P&L</span>
            <span className={`font-bold ${pnlColor(pos.realized_pnl)}`}>
              {fmt$(pos.realized_pnl)} ({pos.close_price ? `закрыт $${pos.close_price.toFixed(2)}` : ''})
            </span>
          </div>
        )}

        {/* Greeks row */}
        {pos.status === 'open' && pnl?.greeks && (
          <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
            <span>Δ {pnl.greeks.delta?.toFixed(3) ?? '—'}</span>
            <span>Γ {pnl.greeks.gamma?.toFixed(5) ?? '—'}</span>
            <span>Θ {pnl.greeks.theta?.toFixed(3) ?? '—'}/д</span>
            <span>V {pnl.greeks.vega?.toFixed(3) ?? '—'}</span>
            <span>IV {pnl.greeks.iv ? `${(pnl.greeks.iv * 100).toFixed(1)}%` : '—'}</span>
          </div>
        )}

        {/* Expiration P&L toggle */}
        {pos.status === 'open' && (
          <button
            onClick={() => setShowExpiry(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${showExpiry ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {showExpiry ? 'Скрыть' : 'P&L при экспирации'}
          </button>
        )}
        {pos.status === 'open' && showExpiry && <ExpirationPanel pos={pos} />}

        {/* Entry info */}
        <div className="flex gap-4 text-xs text-gray-500 flex-wrap border-t border-gray-700/40 pt-2">
          <span>Вход: ${pos.entry_price.toFixed(2)}</span>
          <span>Дата: {pos.entry_date}</span>
          {pnl && <span>Держим: {pnl.days_held} дн.</span>}
          {pos.notes && <span className="text-gray-600 italic">"{pos.notes}"</span>}
        </div>

        {/* Journal (always shown for closed, optional for open) */}
        {pos.status === 'closed' && (
          <JournalSection pos={pos} onSaved={onJournalSaved} />
        )}

        {/* Actions */}
        {pos.status === 'open' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowClose(true)}
              className="flex-1 py-2 rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/40 text-xs font-semibold transition-colors"
            >
              Закрыть позицию
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-2 rounded-lg bg-gray-700/50 border border-gray-600/30 text-gray-400 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors"
            >
              {deleting ? '...' : 'Удалить'}
            </button>
          </div>
        )}
        {pos.status === 'closed' && (
          <div className="flex justify-end">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors"
            >
              Удалить
            </button>
          </div>
        )}
      </div>

      {showClose && (
        <CloseModal
          pos={pos}
          onClose={() => setShowClose(false)}
          onDone={() => { setShowClose(false); onClose() }}
        />
      )}
    </>
  )
}

// ── Summary Bar ────────────────────────────────────────────────────────────────

function SummaryBar({
  positions,
  greeks,
}: {
  positions: Position[]
  greeks: PortfolioGreeks | null
}) {
  const open = positions.filter(p => p.status === 'open')
  const closed = positions.filter(p => p.status === 'closed')

  const totalUnrealized = open.reduce((sum, p) => sum + (p.pnl?.unrealized_pnl ?? 0), 0)
  const totalRealized = closed.reduce((sum, p) => sum + (p.realized_pnl ?? 0), 0)
  const totalCost = open.reduce((sum, p) => sum + p.entry_price * 100 * p.contracts, 0)

  // Max possible profit from all open short positions
  const maxShortProfit = open
    .filter(p => p.direction === 'short')
    .reduce((sum, p) => sum + p.entry_price * 100 * p.contracts, 0)

  return (
    <div className="space-y-3">
      {/* P&L summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Открытых позиций', value: open.length.toString(), color: 'text-white' },
          { label: 'Нереализ. P&L', value: fmt$(totalUnrealized), color: pnlColor(totalUnrealized) },
          { label: 'Реализов. P&L', value: fmt$(totalRealized), color: pnlColor(totalRealized) },
          { label: 'Вложено / Max короткие', value: totalCost > 0 ? `$${totalCost.toFixed(0)}` : '—', color: 'text-white',
            sub: maxShortProfit > 0 ? `Макс. от short: $${maxShortProfit.toFixed(0)}` : undefined },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="card text-center py-3">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Portfolio Greeks */}
      {greeks && greeks.positions_with_greeks > 0 && (
        <div className="card">
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">
            Портфельные греки (суммарно по {greeks.positions_with_greeks} позициям)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-500 mb-0.5">Нетто Дельта</div>
              <div className={`text-lg font-bold ${greeks.net_delta > 0 ? 'text-green-400' : greeks.net_delta < 0 ? 'text-red-400' : 'text-white'}`}>
                {greeks.net_delta > 0 ? '+' : ''}{greeks.net_delta.toFixed(0)}
              </div>
              <div className="text-gray-600 mt-0.5">≈ {Math.abs(greeks.net_delta).toFixed(0)} акций</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-500 mb-0.5">Нетто Тета</div>
              <div className={`text-lg font-bold ${greeks.net_theta > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                {greeks.net_theta > 0 ? '+' : ''}${greeks.net_theta.toFixed(2)}/д
              </div>
              <div className="text-gray-600 mt-0.5">
                {greeks.net_theta > 0 ? 'Тета работает на вас' : 'Тета против вас'}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-500 mb-0.5">Нетто Вега</div>
              <div className={`text-lg font-bold ${greeks.net_vega > 0 ? 'text-blue-400' : 'text-purple-400'}`}>
                {greeks.net_vega > 0 ? '+' : ''}${greeks.net_vega.toFixed(2)}
              </div>
              <div className="text-gray-600 mt-0.5">на 1% изменения IV</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-500 mb-0.5">Риск при IV +5%</div>
              <div className={`text-lg font-bold ${greeks.net_vega * 5 > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {greeks.net_vega * 5 > 0 ? '+' : ''}${(greeks.net_vega * 5).toFixed(0)}
              </div>
              <div className="text-gray-600 mt-0.5">Vega × 5%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Positions() {
  const [positions, setPositions] = useState<Position[]>([])
  const [greeks, setGreeks] = useState<PortfolioGreeks | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'open' | 'closed'>('open')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await listPositions(SESSION_ID, 'all')
      setPositions(all)
      fetchPortfolioGreeks(SESSION_ID).then(setGreeks).catch(() => {})
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const open = positions.filter(p => p.status === 'open')
  const closed = positions.filter(p => p.status === 'closed')
  const shown = tab === 'open' ? open : closed

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Трекер позиций</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Отслеживайте открытые опционные позиции с живым P&L, греками и сигналами.
        </p>
      </div>

      <AddPositionForm onAdded={load} />

      {positions.length > 0 && <SummaryBar positions={positions} greeks={greeks} />}

      {/* Tabs */}
      {positions.length > 0 && (
        <div className="flex gap-2">
          {(['open', 'closed'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 bg-gray-800'
              }`}
            >
              {t === 'open' ? `Открытые (${open.length})` : `Закрытые (${closed.length})`}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-10 text-gray-500">
          <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Загрузка позиций...
        </div>
      )}

      {!loading && shown.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <div className="text-5xl mb-4">📋</div>
          <div className="text-gray-500 font-semibold">
            {tab === 'open' ? 'Нет открытых позиций' : 'Нет закрытых позиций'}
          </div>
          {tab === 'open' && (
            <p className="text-sm mt-2 text-gray-600">
              Добавьте позицию выше или найдите сетап в Сканере
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {shown.map(pos => (
          <PositionCard
            key={pos.id}
            pos={pos}
            onClose={load}
            onDelete={load}
            onJournalSaved={load}
          />
        ))}
      </div>
    </div>
  )
}
