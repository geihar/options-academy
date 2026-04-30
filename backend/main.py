import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from config import settings
from routes import calculator, market_data, advisor, simulator, game, quiz, scanner, positions, market_history, squeeze, universe_scanner

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    init_db()
    logger.info("Database ready.")
    yield
    # Shutdown
    logger.info("Shutting down.")


app = FastAPI(
    title="Options Academy API",
    description="Backend for the Options Academy interactive education platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api
app.include_router(calculator.router, prefix="/api", tags=["Calculator"])
app.include_router(market_data.router, prefix="/api", tags=["Market Data"])
app.include_router(advisor.router, prefix="/api", tags=["Advisor"])
app.include_router(simulator.router, prefix="/api", tags=["Simulator"])
app.include_router(game.router, prefix="/api", tags=["Game"])
app.include_router(quiz.router, prefix="/api", tags=["Quiz"])
app.include_router(scanner.router, prefix="/api", tags=["Scanner"])
app.include_router(positions.router, prefix="/api", tags=["Positions"])
app.include_router(market_history.router, prefix="/api", tags=["Market History"])
app.include_router(squeeze.router, prefix="/api", tags=["Squeeze"])
app.include_router(universe_scanner.router, prefix="/api", tags=["Universe Scanner"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "options-academy-backend"}
