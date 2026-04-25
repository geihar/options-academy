import { useMemo } from 'react'
import { blackScholes, BSInputs, BSOutput } from '../lib/blackScholes'

export function useBlackScholes(inputs: Partial<BSInputs>): BSOutput | null {
  return useMemo(() => {
    const { S, K, T, r, sigma, optionType } = inputs
    if (!S || !K || !T || !r || !sigma || !optionType) return null
    if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return null
    return blackScholes({ S, K, T, r, sigma, optionType })
  }, [inputs.S, inputs.K, inputs.T, inputs.r, inputs.sigma, inputs.optionType])
}
