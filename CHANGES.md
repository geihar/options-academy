# Changes

## Frontend

### `frontend/src/lib/blackScholes.ts`
Added `PayoffLeg` interface, `computeMultiLegPayoff()`, and `findBreakevens()` — required for rendering multi-leg strategy payoff diagrams in strategy cards.

### `frontend/src/pages/Simulator.tsx`
Complete rewrite: added Strategy Decision Wizard (3-question outlook × risk × IV env → filtered strategy cards via `/api/strategy-wizard`), URL param pre-fill from scanner navigation (`?S=`, `?sigma=`, `?ticker=`, `?ivr=`), and enhanced strategy cards with 4 tabs — when-to-use, multi-leg payoff diagram (Recharts), Greek direction badges with contextual educational tooltips, common mistakes + strategy-aware exit guidance.

## Backend

No backend changes. The following were already fully implemented prior to this session:

- `backend/analytics/scanner_engine.py` — options scanner with composite scoring and forecast
- `backend/analytics/ticker_universe.py` — S&P 500 + NDX universe with Wikipedia source and 6-hour cache
- `backend/analytics/strategy_profiles.py` — 10 strategy profiles with wizard filter logic
- `backend/analytics/finviz_screener.py` — Finviz-based ticker discovery by category
- `backend/analytics/squeeze_engine.py` — short squeeze analytics
- `backend/routes/scanner.py` — `/scan`, `/naked-scan`, `/scanner-universe` routes
- `backend/routes/squeeze.py` — `/squeeze-scan`, `/squeeze-universe` routes
- `backend/routes/universe_scanner.py` — `/ticker-universe`, `/universe-scan`, `/strategies`, `/strategy-wizard` routes
