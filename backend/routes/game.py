import json
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db, GameSession, PlayerScore
from schemas import (
    ScenarioRequest, ScenarioResponse, TradeRequest, TradeResponse,
    ResolveResponse, PlayerScoreResponse,
)
from analytics.scenario_generator import (
    pick_random_scenario, fetch_scenario_data, resolve_scenario,
    compute_score, get_rank,
)
from data.cache import cache

router = APIRouter()


def get_or_create_player(db: Session, user_session_id: str) -> PlayerScore:
    player = db.query(PlayerScore).filter_by(user_session_id=user_session_id).first()
    if not player:
        player = PlayerScore(id=str(uuid.uuid4()), user_session_id=user_session_id)
        db.add(player)
        db.commit()
        db.refresh(player)
    return player


@router.post("/game/scenario", response_model=ScenarioResponse)
async def create_scenario(req: ScenarioRequest, db: Session = Depends(get_db)):
    ticker = req.ticker
    max_retries = 5
    scenario_data = None
    for _ in range(max_retries):
        try:
            t, d = pick_random_scenario() if not ticker else (ticker, None)
            if ticker and not d:
                # pick a random date for this ticker
                _, d = pick_random_scenario()
                t = ticker
            scenario_data = fetch_scenario_data(t, d)
            break
        except Exception:
            ticker = None  # retry with random on failure
            continue
    if not scenario_data:
        raise HTTPException(
            status_code=503,
            detail="Не удалось загрузить исторические данные. Попробуйте ещё раз.",
        )

    # Store session in DB (future_closes stored server-side in cache)
    session_id = str(uuid.uuid4())
    game_session = GameSession(
        id=session_id,
        user_session_id=req.user_session_id,
        ticker=scenario_data["ticker"],
        scenario_date=scenario_data["scenario_date"],
        entry_price=scenario_data["entry_price"],
        hv_used=scenario_data["hv_30"],
        iv_used=scenario_data["iv_used"],
        status="open",
    )
    db.add(game_session)
    db.commit()

    # Cache future prices (don't send to client)
    cache.set(
        f"game_future:{session_id}",
        scenario_data["future_closes"],
        db,
        ttl_seconds=7200,
    )

    # Build client response (exclude future_closes)
    return ScenarioResponse(
        session_id=session_id,
        ticker=scenario_data["ticker"],
        scenario_date=scenario_data["scenario_date"],
        entry_price=scenario_data["entry_price"],
        iv_used=scenario_data["iv_used"],
        hv_30=scenario_data["hv_30"],
        narrative=scenario_data["narrative"],
        market_context=scenario_data["market_context"],
        past_prices_30d=scenario_data["past_prices_30d"],
        options_chain=scenario_data["options_chain"],
    )


@router.post("/game/trade", response_model=TradeResponse)
async def submit_trade(req: TradeRequest, db: Session = Depends(get_db)):
    session = db.query(GameSession).filter_by(id=req.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Игровая сессия не найдена")
    if session.status != "open":
        raise HTTPException(status_code=400, detail="Эта сессия уже завершена")
    if not req.legs:
        raise HTTPException(status_code=400, detail="Нужна хотя бы одна нога позиции")
    if req.forward_days not in (7, 14, 30):
        raise HTTPException(status_code=400, detail="forward_days должно быть 7, 14 или 30")

    legs_data = [l.dict() for l in req.legs]
    session.strategy_json = json.dumps(legs_data)
    session.forward_days = req.forward_days
    db.commit()

    net = sum(
        (-l.entry_premium if l.direction == "long" else l.entry_premium) * 100 * l.contracts
        for l in req.legs
    )
    max_risk = abs(
        min(net, -sum(l.entry_premium * 100 * l.contracts for l in req.legs if l.direction == "long"))
    )

    return TradeResponse(
        session_id=req.session_id,
        legs_count=len(req.legs),
        net_debit_credit=round(net, 2),
        max_risk=round(max_risk, 2),
        message=f"Позиция принята. Перематываем {req.forward_days} дней вперёд...",
    )


@router.post("/game/{session_id}/resolve", response_model=ResolveResponse)
async def resolve_game(session_id: str, db: Session = Depends(get_db)):
    session = db.query(GameSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Игровая сессия не найдена")
    if session.status == "resolved":
        raise HTTPException(status_code=400, detail="Сессия уже разрешена")
    if not session.strategy_json or session.strategy_json == "[]":
        raise HTTPException(status_code=400, detail="Нет сохранённой стратегии")

    # Get future prices from cache
    future_closes = cache.get(f"game_future:{session_id}", db)
    if not future_closes:
        # Re-fetch from market data
        scenario_data = fetch_scenario_data(session.ticker, session.scenario_date)
        future_closes = scenario_data["future_closes"]

    legs = json.loads(session.strategy_json)
    result = resolve_scenario(
        ticker=session.ticker,
        scenario_date=session.scenario_date,
        forward_days=session.forward_days,
        legs=legs,
        entry_price=session.entry_price,
        iv_at_entry=session.iv_used,
        future_closes=future_closes,
    )

    # Compute score
    capital_risked = sum(
        l.get("entry_premium", 0) * 100 * l.get("contracts", 1)
        for l in legs if l.get("direction") == "long"
    )
    capital_risked = max(capital_risked, 100)
    score_breakdown = compute_score(
        result["total_pnl"], capital_risked, legs,
        session.entry_price, result["exit_price"],
    )

    # Update game session
    session.exit_price = result["exit_price"]
    session.pnl = result["total_pnl"]
    session.score_awarded = score_breakdown["total"]
    session.status = "resolved"
    db.commit()

    # Update player score
    player = get_or_create_player(db, session.user_session_id)
    player.total_score += score_breakdown["total"]
    player.rounds_played += 1
    player.total_pnl += result["total_pnl"]
    if result["total_pnl"] > 0:
        player.win_count += 1
    if result["total_pnl"] > player.best_pnl:
        player.best_pnl = result["total_pnl"]
    player.updated_at = datetime.utcnow()
    db.commit()

    return ResolveResponse(
        session_id=session_id,
        entry_price=session.entry_price,
        exit_price=result["exit_price"],
        forward_days=session.forward_days,
        ticker=session.ticker,
        pnl=result["total_pnl"],
        pnl_per_leg=result["pnl_per_leg"],
        score_awarded=score_breakdown["total"],
        score_breakdown=score_breakdown,
        total_score=player.total_score,
        price_history=result["price_history"],
        rank=get_rank(player.total_score),
    )


@router.get("/game/{user_session_id}/score", response_model=PlayerScoreResponse)
async def get_score(user_session_id: str, db: Session = Depends(get_db)):
    player = get_or_create_player(db, user_session_id)
    win_rate = player.win_count / player.rounds_played if player.rounds_played > 0 else 0
    return PlayerScoreResponse(
        user_session_id=user_session_id,
        total_score=player.total_score,
        rounds_played=player.rounds_played,
        total_pnl=player.total_pnl,
        win_count=player.win_count,
        win_rate=round(win_rate, 3),
        best_pnl=player.best_pnl,
        rank=get_rank(player.total_score),
    )


@router.get("/game/leaderboard")
async def leaderboard(db: Session = Depends(get_db)):
    players = (
        db.query(PlayerScore)
        .order_by(PlayerScore.total_score.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "session_id": p.user_session_id[:8] + "...",  # anonymize
            "total_score": p.total_score,
            "rounds_played": p.rounds_played,
            "win_rate": round(p.win_count / p.rounds_played, 2) if p.rounds_played > 0 else 0,
            "rank": get_rank(p.total_score),
        }
        for p in players
    ]
