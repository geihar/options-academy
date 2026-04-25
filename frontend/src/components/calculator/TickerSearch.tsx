import { useState, useRef, KeyboardEvent } from 'react'

interface TickerSearchProps {
  onSearch: (ticker: string) => void
  isLoading?: boolean
}

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'SPY', 'QQQ', 'META']

export function TickerSearch({ onSearch, isLoading }: TickerSearchProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = () => {
    const ticker = value.trim().toUpperCase()
    if (ticker) onSearch(ticker)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          onKeyDown={handleKey}
          placeholder="Введите тикер (напр. AAPL)"
          className="input flex-1 uppercase font-mono text-lg tracking-widest"
          maxLength={10}
        />
        <button
          onClick={handleSearch}
          disabled={isLoading || !value.trim()}
          className="btn-primary min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Загрузка
            </span>
          ) : 'Найти'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {POPULAR_TICKERS.map((t) => (
          <button
            key={t}
            onClick={() => { setValue(t); onSearch(t) }}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-mono rounded-lg transition-colors"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
