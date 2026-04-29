import uuid
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, DateTime, Float, Integer, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CacheEntry(Base):
    __tablename__ = "cache"

    key = Column(String, primary_key=True, index=True)
    data = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)


class GameSession(Base):
    __tablename__ = "game_sessions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_session_id = Column(String, nullable=False, index=True)
    ticker = Column(String, nullable=False)
    scenario_date = Column(String, nullable=False)
    entry_price = Column(Float, nullable=False)
    hv_used = Column(Float, nullable=False)
    iv_used = Column(Float, nullable=False)
    strategy_json = Column(Text, nullable=False, default="[]")
    forward_days = Column(Integer, nullable=True)
    exit_price = Column(Float, nullable=True)
    pnl = Column(Float, nullable=True)
    score_awarded = Column(Integer, default=0)
    status = Column(String, default="open")  # "open" | "resolved"
    created_at = Column(DateTime, default=datetime.utcnow)


class PlayerScore(Base):
    __tablename__ = "player_scores"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_session_id = Column(String, nullable=False, unique=True, index=True)
    total_score = Column(Integer, default=0)
    rounds_played = Column(Integer, default=0)
    total_pnl = Column(Float, default=0.0)
    win_count = Column(Integer, default=0)
    best_pnl = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_session_id = Column(String, nullable=False, index=True)
    lesson_id = Column(Integer, nullable=False)
    score = Column(Integer, nullable=False)
    total_q = Column(Integer, nullable=False)
    answers_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)


class OptionPosition(Base):
    __tablename__ = "option_positions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_session_id = Column(String, nullable=False, index=True)
    ticker = Column(String, nullable=False)
    option_type = Column(String, nullable=False)   # "call" | "put"
    direction = Column(String, nullable=False)      # "long" | "short"
    strike = Column(Float, nullable=False)
    expiry = Column(String, nullable=False)         # ISO date
    contracts = Column(Integer, default=1)
    entry_price = Column(Float, nullable=False)     # premium per share
    entry_date = Column(String, nullable=False)     # ISO date
    notes = Column(Text, nullable=True)
    status = Column(String, default="open")         # "open" | "closed"
    close_price = Column(Float, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_covered = Column(Boolean, default=False)      # covered call / cash-secured put
    shares_held = Column(Integer, nullable=True)     # shares owned for covered call
    stock_cost_basis = Column(Float, nullable=True)  # avg cost basis per share
    # Trade Journal fields
    trade_result = Column(String, nullable=True)    # "win" | "loss" | "breakeven"
    outcome_notes = Column(Text, nullable=True)     # post-trade reflection
    lesson_learned = Column(Text, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_db()


def _migrate_db():
    """Add new columns to existing tables without dropping data."""
    from sqlalchemy import text, inspect as sa_inspect
    with engine.connect() as conn:
        cols = {c["name"] for c in sa_inspect(engine).get_columns("option_positions")}
        if "shares_held" not in cols:
            conn.execute(text("ALTER TABLE option_positions ADD COLUMN shares_held INTEGER"))
        if "stock_cost_basis" not in cols:
            conn.execute(text("ALTER TABLE option_positions ADD COLUMN stock_cost_basis REAL"))
        conn.commit()
