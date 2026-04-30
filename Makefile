.PHONY: dev backend frontend install install-backend install-frontend build clean

VENV = backend/venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip
UVICORN = $(VENV)/bin/uvicorn

# ── Main entry point ──────────────────────────────────────────────────────────

dev:
	@make -j2 backend frontend

# ── Services ──────────────────────────────────────────────────────────────────

backend:
	cd backend && $(abspath $(UVICORN)) main:app --reload --port 3001

frontend:
	cd frontend && npm run dev

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
