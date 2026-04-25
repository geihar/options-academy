import math
from scipy.stats import norm
from dataclasses import dataclass


@dataclass
class BSResult:
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


def black_scholes(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> BSResult:
    """
    Full Black-Scholes pricing with all Greeks.

    Args:
        S: Current stock price
        K: Strike price
        T: Time to expiry in years (e.g. 30 days = 30/365)
        r: Risk-free rate (e.g. 0.05 for 5%)
        sigma: Implied volatility (e.g. 0.30 for 30%)
        option_type: "call" or "put"

    Returns:
        BSResult with price and all first/second order Greeks.
        Theta is in dollars per day.
        Vega is per 1 percentage point change in IV.
    """
    if T <= 0:
        # At expiry, intrinsic value only
        if option_type == "call":
            intrinsic = max(0.0, S - K)
        else:
            intrinsic = max(0.0, K - S)
        return BSResult(
            price=intrinsic, delta=(1.0 if S > K else 0.0) if option_type == "call" else (-1.0 if S < K else 0.0),
            gamma=0.0, theta=0.0, vega=0.0, rho=0.0, charm=0.0, vanna=0.0,
            d1=0.0, d2=0.0, itm_probability=1.0 if S > K else 0.0
        )

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    if option_type == "call":
        price = S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
        delta = norm.cdf(d1)
        itm_prob = norm.cdf(d2)
        rho_sign = norm.cdf(d2)
    else:
        price = K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
        delta = norm.cdf(d1) - 1
        itm_prob = norm.cdf(-d2)
        rho_sign = -norm.cdf(-d2)

    gamma = norm.pdf(d1) / (S * sigma * math.sqrt(T))

    # Theta per year, then divide by 365 for per-day
    theta_annual = (-(S * norm.pdf(d1) * sigma) / (2 * math.sqrt(T))
                    - r * K * math.exp(-r * T) * (norm.cdf(d2) if option_type == "call" else norm.cdf(-d2)))
    if option_type == "put":
        theta_annual = (-(S * norm.pdf(d1) * sigma) / (2 * math.sqrt(T))
                        + r * K * math.exp(-r * T) * norm.cdf(-d2))
    theta_per_day = theta_annual / 365

    # Vega per 1% change in vol
    vega_per_pct = S * norm.pdf(d1) * math.sqrt(T) / 100

    # Rho per 1% change in rate
    rho = K * T * math.exp(-r * T) * (norm.cdf(d2) if option_type == "call" else -norm.cdf(-d2)) / 100

    # Charm: delta decay per day
    charm_annual = -norm.pdf(d1) * (2 * r * T - d2 * sigma * math.sqrt(T)) / (2 * T * sigma * math.sqrt(T))
    charm_per_day = charm_annual / 365

    # Vanna: sensitivity of delta to volatility
    vanna = (vega_per_pct * 100) * (1 - d1 / (sigma * math.sqrt(T))) / S

    return BSResult(
        price=price,
        delta=delta,
        gamma=gamma,
        theta=theta_per_day,
        vega=vega_per_pct,
        rho=rho,
        charm=charm_per_day,
        vanna=vanna,
        d1=d1,
        d2=d2,
        itm_probability=itm_prob,
    )


def implied_volatility(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    option_type: str,
    max_iter: int = 100,
    tol: float = 1e-6,
) -> float | None:
    """
    Newton-Raphson IV inversion using Brenner-Subrahmanyam initial guess.
    Returns None if no solution found (deep ITM/OTM, numerical issues).
    """
    if T <= 0 or market_price <= 0:
        return None

    # Brenner-Subrahmanyam approximation as starting guess
    sigma = math.sqrt(2 * math.pi / T) * market_price / S
    sigma = max(0.001, min(sigma, 5.0))

    for _ in range(max_iter):
        try:
            bs = black_scholes(S, K, T, r, sigma, option_type)
        except (ValueError, ZeroDivisionError):
            break

        diff = bs.price - market_price
        if abs(diff) < tol:
            return sigma

        # vega in per-unit terms (undo the /100 division)
        vega = bs.vega * 100
        if abs(vega) < 1e-10:
            break

        sigma -= diff / vega
        sigma = max(0.001, min(sigma, 5.0))

    return None
