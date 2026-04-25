from fastapi import APIRouter
from schemas import BSRequest, BSResult
from analytics.black_scholes import black_scholes, BSResult as AnalyticsBSResult

router = APIRouter()


def to_schema(result: AnalyticsBSResult) -> BSResult:
    return BSResult(
        price=round(result.price, 4),
        delta=round(result.delta, 4),
        gamma=round(result.gamma, 6),
        theta=round(result.theta, 4),
        vega=round(result.vega, 4),
        rho=round(result.rho, 4),
        charm=round(result.charm, 6),
        vanna=round(result.vanna, 6),
        d1=round(result.d1, 4),
        d2=round(result.d2, 4),
        itm_probability=round(result.itm_probability, 4),
    )


@router.post("/calculate", response_model=BSResult)
def calculate(req: BSRequest):
    """
    Compute Black-Scholes price and all Greeks for given parameters.
    No external data fetch — purely mathematical computation.
    """
    result = black_scholes(
        S=req.S,
        K=req.K,
        T=req.T,
        r=req.r,
        sigma=req.sigma,
        option_type=req.option_type,
    )
    return to_schema(result)
