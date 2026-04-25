import { useQuery } from '@tanstack/react-query'
import { fetchOptionsChain, OptionsChainResponse } from '../api/client'

export function useOptionsChain(ticker: string | null) {
  return useQuery<OptionsChainResponse, Error>({
    queryKey: ['options-chain', ticker],
    queryFn: () => fetchOptionsChain(ticker!),
    enabled: !!ticker && ticker.length >= 1,
    staleTime: 5 * 60 * 1000, // 5 minutes (server caches for 15min)
    retry: 1,
  })
}
