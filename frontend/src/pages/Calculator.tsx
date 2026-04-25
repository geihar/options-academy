import { useState } from 'react'
import { useOptionsChain } from '../hooks/useOptionsChain'
import { TickerSearch } from '../components/calculator/TickerSearch'
import { OptionsChainTable } from '../components/calculator/OptionsChainTable'
import { OptionDetail } from '../components/calculator/OptionDetail'
import { AdvicePanel } from '../components/calculator/AdvicePanel'
import { HVChart } from '../components/calculator/HVChart'
import { IVRankGauge } from '../components/interactive/IVRankGauge'
import { PayoffDiagram } from '../components/interactive/PayoffDiagram'
import { OptionContract, fetchAdvice, AdviceResponse } from '../api/client'

export default function Calculator() {
  const [ticker, setTicker] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<OptionContract | null>(null)
  const [advice, setAdvice] = useState<AdviceResponse | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceError, setAdviceError] = useState<string | null>(null)

  const { data: chain, isLoading, error } = useOptionsChain(ticker)

  const handleSelectOption = async (option: OptionContract) => {
    setSelectedOption(option)
    setAdvice(null)
    setAdviceError(null)

    if (!chain) return

    const marketPrice = option.last > 0 ? option.last : (option.bid + option.ask) / 2
    if (!marketPrice) return

    setAdviceLoading(true)
    try {
      const result = await fetchAdvice({
        ticker: chain.ticker,
        strike: option.strike,
        expiry: option.expiry,
        option_type: option.option_type,
        market_price: marketPrice,
      })
      setAdvice(result)
    } catch (e: any) {
      setAdviceError(e?.message || 'Не удалось получить рекомендации')
    } finally {
      setAdviceLoading(false)
    }
  }

  const midPrice = selectedOption
    ? selectedOption.last > 0
      ? selectedOption.last
      : (selectedOption.bid + selectedOption.ask) / 2
    : 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Калькулятор опционов</h1>
        <p className="text-gray-400 mt-1">
          Введите тикер для просмотра цепочки опционов, греков, анализа ИВ и торговых рекомендаций.
        </p>
      </div>

      <TickerSearch onSearch={setTicker} isLoading={isLoading} />

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm">
          Не удалось загрузить цепочку опционов. Тикер может быть недействительным или yfinance временно ограничен.
          Попробуйте ещё раз.
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3 text-gray-400">
            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Загрузка цепочки опционов для {ticker}...
          </div>
        </div>
      )}

      {chain && (
        <div className="space-y-6">
          {/* Header with stock info */}
          <div className="card space-y-4">
            <div className="flex flex-wrap gap-6 items-center">
              <div>
                <span className="text-3xl font-bold text-white">{chain.ticker}</span>
                <div className="text-2xl font-mono text-green-400 mt-1">${chain.current_price.toFixed(2)}</div>
              </div>
              {chain.iv_rank !== null && (
                <div className="flex-1 max-w-xs">
                  <IVRankGauge
                    ivRank={chain.iv_rank}
                    ivPercentile={chain.iv_percentile ?? undefined}
                    hv30={chain.hv_30 ?? undefined}
                    ticker={chain.ticker}
                  />
                </div>
              )}
            </div>
            {/* HV history chart */}
            <div className="border-t border-gray-700/40 pt-4">
              <HVChart
                ticker={chain.ticker}
                currentIV={advice?.iv ?? selectedOption?.iv ?? null}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Left: Options chain table (wider) */}
            <div className="xl:col-span-3">
              <OptionsChainTable
                calls={chain.calls}
                puts={chain.puts}
                currentPrice={chain.current_price}
                expirations={chain.expirations}
                onSelectOption={handleSelectOption}
                selectedOption={selectedOption}
              />
            </div>

            {/* Right: Detail + Advice */}
            <div className="xl:col-span-2 space-y-4">
              {selectedOption ? (
                <>
                  <OptionDetail
                    option={selectedOption}
                    currentPrice={chain.current_price}
                  />
                  {midPrice > 0 && (
                    <div className="card">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Выплата при экспирации</h3>
                      <PayoffDiagram
                        K={selectedOption.strike}
                        premium={midPrice}
                        optionType={selectedOption.option_type as 'call' | 'put'}
                        currentPrice={chain.current_price}
                      />
                    </div>
                  )}
                  {adviceLoading && (
                    <div className="card text-center text-gray-400 py-8">
                      <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Анализ...
                    </div>
                  )}
                  {adviceError && (
                    <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm">
                      {adviceError}
                    </div>
                  )}
                  {advice && <AdvicePanel advice={advice} />}
                </>
              ) : (
                <div className="card text-center py-12 text-gray-500">
                  <div className="text-4xl mb-3">👆</div>
                  <div>Нажмите на любую строку в таблице опционов, чтобы увидеть детали и рекомендации</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!chain && !isLoading && !error && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-400 mb-2">Введите тикер для начала работы</h2>
          <p className="text-sm">Попробуйте AAPL, TSLA, SPY или любую акцию с опционами</p>
        </div>
      )}
    </div>
  )
}
