SHELL := /bin/bash
.DEFAULT_GOAL := help

UV ?= uv
NPM ?= npm
COMPOSE ?= docker compose

VENV_DIR ?= .venv
PYTEST_PATH ?= tests/server
UVICORN_APP ?= server.app:app
SERVER_HOST ?= 0.0.0.0
SERVER_PORT ?= 8000

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"; print "\nTargets:\n"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-24s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ------------------------------------------------------------------------------
# Setup / dependencies
# ------------------------------------------------------------------------------

.PHONY: check-tools
check-tools: ## Check required local tools are installed
	@command -v $(UV) >/dev/null || (echo "Missing: $(UV)" && exit 1)
	@command -v $(NPM) >/dev/null || (echo "Missing: $(NPM)" && exit 1)
	@command -v docker >/dev/null || (echo "Missing: docker" && exit 1)
	@echo "All required tools found."

.PHONY: venv
venv: ## Create Python virtual environment with uv
	$(UV) venv $(VENV_DIR)

.PHONY: venv-recreate
venv-recreate: ## Recreate Python virtual environment from scratch
	rm -rf $(VENV_DIR)
	$(UV) venv $(VENV_DIR)

.PHONY: py-sync
py-sync: ## Sync Python dependencies (including dev group)
	$(UV) sync --group dev

.PHONY: py-lock
py-lock: ## Refresh uv.lock from pyproject.toml
	$(UV) lock

.PHONY: node-install
node-install: ## Install Node dependencies
	$(NPM) install

.PHONY: setup
setup: check-tools venv py-sync node-install ## Full project setup for local development

.PHONY: install
install: setup ## Alias for setup

# ------------------------------------------------------------------------------
# Local development
# ------------------------------------------------------------------------------

.PHONY: dev-server
dev-server: ## Run backend in reload mode (uvicorn)
	$(UV) run uvicorn $(UVICORN_APP) --reload --host $(SERVER_HOST) --port $(SERVER_PORT)

.PHONY: dev-web
dev-web: ## Run Next.js development server
	$(NPM) run dev

.PHONY: dev
dev: ## Run backend + frontend together (parallel)
	$(MAKE) -j2 dev-server dev-web


.PHONY: dev-server-ro
dev-server-ro: ## Run backend in reload mode (uvicorn)
	READ_ONLY=true $(UV) run uvicorn $(UVICORN_APP) --reload --host $(SERVER_HOST) --port $(SERVER_PORT)

.PHONY: dev-web-ro
dev-web-ro: ## Run Next.js development server
	READ_ONLY=true $(NPM) run dev

.PHONY: dev-server-rw
dev-server-rw: ## Run backend in reload mode (uvicorn)
	READ_ONLY=false $(UV) run uvicorn $(UVICORN_APP) --reload --host $(SERVER_HOST) --port $(SERVER_PORT)

.PHONY: dev-web-rw
dev-web-rw: ## Run Next.js development server
	READ_ONLY=false $(NPM) run dev

.PHONY: dev-ro
dev-ro: ## Run backend + frontend together (parallel)
	READ_ONLY=true $(MAKE) -j2 dev-server-ro dev-web-ro

.PHONY: dev-rw
dev-rw: ## Run backend + frontend together (parallel)
	READ_ONLY=false $(MAKE) -j2 dev-server-rw dev-web-rw

.PHONY: start-web-ro
start-web-ro: ## Run Next.js production server
	READ_ONLY=true $(NPM) run start

.PHONY: start-web-rw
start-web-rw: ## Run Next.js production server
	READ_ONLY=false $(NPM) run start

# ------------------------------------------------------------------------------
# Testing / quality
# ------------------------------------------------------------------------------

.PHONY: test
test: ## Run Python test suite
	READ_ONLY=false $(UV) run pytest $(PYTEST_PATH) -q

.PHONY: test-verbose
test-verbose: ## Run Python tests with full verbosity
	READ_ONLY=false $(UV) run pytest $(PYTEST_PATH) -vv

.PHONY: typecheck
typecheck: ## Run TypeScript typecheck
	$(NPM) run typecheck

.PHONY: lint
lint: ## Run frontend linter
	$(NPM) run lint

.PHONY: check
check: test typecheck lint ## Run all routine checks

# ------------------------------------------------------------------------------
# Build
# ------------------------------------------------------------------------------

.PHONY: build-web
build-web: ## Build Next.js app for production
	$(NPM) run build

.PHONY: build
build: build-web ## Alias for build-web

# ------------------------------------------------------------------------------
# Docker / compose
# ------------------------------------------------------------------------------

.PHONY: docker-build-ro
docker-build-ro: ## Build Docker images
	READ_ONLY=true $(COMPOSE) build

.PHONY: docker-build-rw
docker-build-rw: ## Build Docker images
	READ_ONLY=false $(COMPOSE) build

.PHONY: docker-up-ro
docker-up-ro: ## Start Docker services in foreground
	READ_ONLY=true $(COMPOSE) up

.PHONY: docker-up-rw
docker-up-rw: ## Start Docker services in foreground
	READ_ONLY=false $(COMPOSE) up

.PHONY: docker-up-build-ro
docker-up-build-ro: ## Build and start Docker services in foreground
	READ_ONLY=true $(COMPOSE) up --build

.PHONY: docker-up-build-rw
docker-up-build-rw: ## Build and start Docker services in foreground
	READ_ONLY=false $(COMPOSE) up --build

.PHONY: docker-up-detached-ro
docker-up-detached-ro: ## Start Docker services in background
	READ_ONLY=true $(COMPOSE) up -d

.PHONY: docker-up-detached-rw
docker-up-detached-rw: ## Start Docker services in background
	READ_ONLY=false $(COMPOSE) up -d

.PHONY: docker-restart-ro
docker-restart-ro: ## Restart Docker services
	READ_ONLY=true $(COMPOSE) restart

.PHONY: docker-restart-rw
docker-restart-rw: ## Restart Docker services
	READ_ONLY=false $(COMPOSE) restart

.PHONY: docker-down
docker-down: ## Stop and remove Docker services
	$(COMPOSE) down

.PHONY: docker-logs
docker-logs: ## Stream Docker compose logs
	$(COMPOSE) logs -f

.PHONY: docker-ps
docker-ps: ## Show Docker compose service status
	$(COMPOSE) ps

.PHONY: docker-shell-server
docker-shell-server: ## Open shell in running server container
	$(COMPOSE) exec server sh

.PHONY: docker-shell-web
docker-shell-web: ## Open shell in running web container
	$(COMPOSE) exec web sh

# ------------------------------------------------------------------------------
# Housekeeping
# ------------------------------------------------------------------------------

.PHONY: clean-python
clean-python: ## Remove Python caches and test artifacts
	rm -rf .pytest_cache .mypy_cache .ruff_cache
	find . -type d -name "__pycache__" -prune -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

.PHONY: clean-web
clean-web: ## Remove frontend build artifacts
	rm -rf .next out

.PHONY: clean
clean: clean-python clean-web ## Clean cache/build artifacts

.PHONY: clean-all
clean-all: clean ## Also remove installed dependency directories
	rm -rf node_modules $(VENV_DIR)

.PHONY: status
status: ## Show concise git status
	git status --short
