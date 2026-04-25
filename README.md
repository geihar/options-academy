# Options Academy

An interactive options trading education web app that takes you from absolute zero to intermediate level.

## Features

- **Academy** — 8 interactive lessons from "What is an option?" to earnings plays and IV crush
- **Simulator** — Free-play sandbox with real-time Black-Scholes Greeks and payoff diagrams
- **Calculator** — Live options chain data with IV analysis and specific trading advice

## Quick Start

### Requirements
- Python 3.11+
- Node.js 20+

### Install dependencies

```bash
make install
```

### Run the app

```bash
make dev
```

This starts:
- FastAPI backend at http://localhost:8000
- Vite frontend at http://localhost:5173

## Project Structure

```
options_academy/
├── backend/          # FastAPI Python backend
│   ├── main.py       # App entry point
│   ├── analytics/    # Black-Scholes, IV calculations, advice engine
│   ├── data/         # yfinance fetcher + SQLite cache
│   └── routes/       # API endpoints
├── frontend/         # React + Vite frontend
│   └── src/
│       ├── pages/    # Academy, Simulator, Calculator
│       ├── lessons/  # 8 interactive lesson components
│       ├── components/interactive/  # PayoffDiagram, GreeksDashboard, etc.
│       └── components/calculator/  # Options chain table, advice panel
└── books/            # Drop PDF books here for context
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calculate` | POST | Black-Scholes price + all Greeks |
| `/api/options-chain/{ticker}` | GET | Live options chain with computed IVs |
| `/api/stock/{ticker}` | GET | Current price + basic info |
| `/api/advice` | POST | Full IV analysis + trading advice |
| `/api/simulate` | POST | P&L scenarios at different stock prices |

## Environment Variables (Backend)

Create `backend/.env`:

```env
# Optional: polygon.io free tier for fallback data
POLYGON_API_KEY=your_key_here

# Database
DATABASE_URL=sqlite:///./options_academy.db

# Cache TTL in seconds (default: 900 = 15 minutes)
CACHE_TTL=900

# Risk-free rate (default: 0.05 = 5%)
RISK_FREE_RATE=0.05
```

No paid API keys required — yfinance provides free market data.

## Notes

- Options chain data is cached for 15 minutes to avoid rate limits
- All Black-Scholes calculations on the Simulator page use client-side JS (instant, no server needed)
- The Calculator page uses server-side Python scipy for more accurate IV inversion
- Data provided for educational purposes only — not financial advice
