.PHONY: dev backend frontend install build

dev:
	make -j2 backend frontend

backend:
	cd backend && uvicorn main:app --reload --port 3001

frontend:
	cd frontend && npm run dev

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

build:
	cd frontend && npm run build
