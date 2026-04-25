import numpy as np
from fastapi import APIRouter
from schemas import SimulateRequest, SimulateResponse, ScenarioPoint
from analytics.black_scholes import black_scholes

router = APIRouter()


@router.post("/simulate", response_model=SimulateResponse)
def simulate(req: SimulateRequest):
    """
    Compute P&L scenarios at different stock prices at expiry.
    Returns 50 data points from S*0.7 to S*1.3.
    """
    S = req.S
    K = req.K
    T = req.T
    r = req.r
    sigma = req.sigma
    option_type = req.option_type
    premium_paid = req.premium_paid
    contracts = req.contracts
    multiplier = 100 * contracts  # each contract = 100 shares

    # Generate stock price range: 70% to 130% of current price
    price_range = np.linspace(S * 0.7, S * 1.3, 60)
    scenarios = []

    for sp in price_range:
        # Option value at expiry = intrinsic value
        if option_type == "call":
            option_value = max(0.0, sp - K)
        else:
            option_value = max(0.0, K - sp)

        pnl = (option_value - premium_paid) * multiplier
        scenarios.append(ScenarioPoint(
            stock_price=round(float(sp), 2),
            pnl=round(pnl, 2),
            option_value=round(option_value, 4),
        ))

    # Breakeven calculation
    if option_type == "call":
        breakeven = K + premium_paid
    else:
        breakeven = K - premium_paid

    max_loss = premium_paid * multiplier  # max loss = premium paid

    # Max profit: unlimited for calls, capped for puts
    if option_type == "call":
        max_profit = None  # theoretically unlimited
    else:
        max_profit = (K - premium_paid) * multiplier  # stock goes to 0

    return SimulateResponse(
        scenarios=scenarios,
        breakeven=round(breakeven, 2),
        max_profit=round(max_profit, 2) if max_profit is not None else None,
        max_loss=round(max_loss, 2),
    )
