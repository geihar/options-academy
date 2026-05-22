.PHONY: dev start stop restart start-backend start-frontend stop-backend stop-frontend \
        install install-backend install-frontend build clean

VENV     = backend/venv
PIP      = $(VENV)/bin/pip
UVICORN  = $(VENV)/bin/uvicorn

BACKEND_PORT = 3221
FRONTEND_PORT = 5765

PID_DIR     = .pids
BACKEND_PID = $(PID_DIR)/backend.pid
FRONTEND_PID = $(PID_DIR)/frontend.pid

# ── Start ─────────────────────────────────────────────────────────────────────

start: start-backend start-frontend
	@echo ""
	@echo "  Backend  → http://localhost:$(BACKEND_PORT)"
	@echo "  Frontend → http://localhost:$(FRONTEND_PORT)"
	@echo ""

start-backend:
	@mkdir -p $(PID_DIR)
	@if [ -f $(BACKEND_PID) ] && kill -0 $$(cat $(BACKEND_PID)) 2>/dev/null; then \
		echo "Backend already running (PID $$(cat $(BACKEND_PID)))"; \
	else \
		cd backend && ../$(UVICORN) main:app --reload --port $(BACKEND_PORT) \
			> /tmp/backend.log 2>&1 & echo $$! > ../$(BACKEND_PID); \
		echo "Backend started (PID $$(cat $(BACKEND_PID))) on :$(BACKEND_PORT)"; \
	fi

start-frontend:
	@mkdir -p $(PID_DIR)
	@if [ -f $(FRONTEND_PID) ] && kill -0 $$(cat $(FRONTEND_PID)) 2>/dev/null; then \
		echo "Frontend already running (PID $$(cat $(FRONTEND_PID)))"; \
	else \
		cd frontend && npm run dev > /tmp/frontend.log 2>&1 & echo $$! > ../$(FRONTEND_PID); \
		echo "Frontend started (PID $$(cat $(FRONTEND_PID))) on :$(FRONTEND_PORT)"; \
	fi

# ── Stop ──────────────────────────────────────────────────────────────────────

stop: stop-backend stop-frontend

stop-backend:
	@if [ -f $(BACKEND_PID) ]; then \
		PID=$$(cat $(BACKEND_PID)); \
		kill -9 $$PID 2>/dev/null && echo "Backend stopped (PID $$PID)" || echo "Backend not running"; \
		rm -f $(BACKEND_PID); \
	else \
		pkill -f "uvicorn main:app" 2>/dev/null && echo "Backend stopped" || echo "Backend not running"; \
	fi

stop-frontend:
	@if [ -f $(FRONTEND_PID) ]; then \
		PID=$$(cat $(FRONTEND_PID)); \
		kill -9 $$PID 2>/dev/null && echo "Frontend stopped (PID $$PID)" || echo "Frontend not running"; \
		rm -f $(FRONTEND_PID); \
	else \
		pkill -f "vite" 2>/dev/null && echo "Frontend stopped" || echo "Frontend not running"; \
	fi

# ── Restart ───────────────────────────────────────────────────────────────────

restart: stop start

restart-backend: stop-backend start-backend

restart-frontend: stop-frontend start-frontend

# ── Dev (foreground, с логами) ────────────────────────────────────────────────

dev:
	@make -j2 dev-backend dev-frontend

dev-backend:
	cd backend && ../$(UVICORN) main:app --reload --port $(BACKEND_PORT)

dev-frontend:
	cd frontend && npm run dev

# ── Logs ──────────────────────────────────────────────────────────────────────

logs-backend:
	@tail -f /tmp/backend.log

logs-frontend:
	@tail -f /tmp/frontend.log

# ── Status ────────────────────────────────────────────────────────────────────

status:
	@echo "=== Backend ==="
	@if [ -f $(BACKEND_PID) ] && kill -0 $$(cat $(BACKEND_PID)) 2>/dev/null; then \
		echo "  RUNNING  (PID $$(cat $(BACKEND_PID))) on :$(BACKEND_PORT)"; \
	else \
		echo "  STOPPED"; \
	fi
	@echo "=== Frontend ==="
	@if [ -f $(FRONTEND_PID) ] && kill -0 $$(cat $(FRONTEND_PID)) 2>/dev/null; then \
		echo "  RUNNING  (PID $$(cat $(FRONTEND_PID))) on :$(FRONTEND_PORT)"; \
	else \
		echo "  STOPPED"; \
	fi

# ── Install ───────────────────────────────────────────────────────────────────

install: install-backend install-frontend

install-backend:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/requirements.txt

install-frontend:
	cd frontend && npm install

# ── Build & clean ─────────────────────────────────────────────────────────────

build:
	cd frontend && npm run build

clean:
	rm -rf frontend/dist frontend/node_modules
	rm -rf $(VENV)
	rm -rf $(PID_DIR)
