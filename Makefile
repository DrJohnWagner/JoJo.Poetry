SHELL := /bin/bash
.DEFAULT_GOAL := help

UV ?= uv
NPM ?= npm
COMPOSE ?= docker compose
GCLOUD ?= gcloud

GCLOUD_PROJECT ?= jojo-poetry
GCLOUD_REGION  ?= us-east1
GCLOUD_REPO    ?= jojo-poetry
GCLOUD_SERVICE ?= jojo-poetry
GCLOUD_DOCKERFILE ?= Dockerfile-gcloud

VENV_DIR ?= .venv
PYTEST_PATH ?= tests/server
UVICORN_APP ?= server.app:app
UVICORN_RELOAD_DIRS ?= --reload-dir server --reload-dir database
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
	$(UV) run uvicorn $(UVICORN_APP) --reload $(UVICORN_RELOAD_DIRS) --host $(SERVER_HOST) --port $(SERVER_PORT)

.PHONY: dev-web
dev-web: ## Run Next.js development server
	$(NPM) run dev

.PHONY: dev
dev: ## Run backend first, wait for it, then run frontend
	@$(UV) run uvicorn $(UVICORN_APP) --reload $(UVICORN_RELOAD_DIRS) --host $(SERVER_HOST) --port $(SERVER_PORT) & \
	until curl -sf http://localhost:$(SERVER_PORT)/api/author >/dev/null 2>&1; do sleep 0.5; done; \
	$(NPM) run dev


.PHONY: dev-server-ro
dev-server-ro: ## Run backend in reload mode (uvicorn)
	READ_ONLY=true $(UV) run uvicorn $(UVICORN_APP) --reload $(UVICORN_RELOAD_DIRS) --host $(SERVER_HOST) --port $(SERVER_PORT)

.PHONY: dev-web-ro
dev-web-ro: ## Run Next.js development server
	READ_ONLY=true $(NPM) run dev

.PHONY: dev-server-rw
dev-server-rw: ## Run backend in reload mode (uvicorn)
	READ_ONLY=false $(UV) run uvicorn $(UVICORN_APP) --reload $(UVICORN_RELOAD_DIRS) --host $(SERVER_HOST) --port $(SERVER_PORT)

.PHONY: dev-web-rw
dev-web-rw: ## Run Next.js development server
	READ_ONLY=false $(NPM) run dev

.PHONY: dev-ro
dev-ro: ## Run backend first, wait for it, then run frontend (read-only)
	@READ_ONLY=true $(UV) run uvicorn $(UVICORN_APP) --reload $(UVICORN_RELOAD_DIRS) --host $(SERVER_HOST) --port $(SERVER_PORT) & \
	until curl -sf http://localhost:$(SERVER_PORT)/api/author >/dev/null 2>&1; do sleep 0.5; done; \
	READ_ONLY=true $(NPM) run dev

.PHONY: dev-rw
dev-rw: ## Run backend first, wait for it, then run frontend (read-write)
	@READ_ONLY=false $(UV) run uvicorn $(UVICORN_APP) --reload $(UVICORN_RELOAD_DIRS) --host $(SERVER_HOST) --port $(SERVER_PORT) & \
	until curl -sf http://localhost:$(SERVER_PORT)/api/author >/dev/null 2>&1; do sleep 0.5; done; \
	READ_ONLY=false $(NPM) run dev

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
# Google Cloud Run
# ------------------------------------------------------------------------------

GCLOUD_IMAGE = $(GCLOUD_REGION)-docker.pkg.dev/$(GCLOUD_PROJECT)/$(GCLOUD_REPO)/$(GCLOUD_SERVICE)
GCLOUD_ENV_VARS = READ_ONLY=true,NEXT_PUBLIC_READ_ONLY=true,API_BASE_URL_SERVER=http://127.0.0.1:8000,FASTAPI_PORT=8000

.PHONY: gcloud-login
gcloud-login: ## Authenticate with Google Cloud and configure Docker
	$(GCLOUD) auth login
	$(GCLOUD) config set project $(GCLOUD_PROJECT)
	$(GCLOUD) auth configure-docker $(GCLOUD_REGION)-docker.pkg.dev --quiet

.PHONY: gcloud-deploy
gcloud-deploy: ## First-time setup: enable services, create repo, build, push, deploy
	$(GCLOUD) config set project $(GCLOUD_PROJECT)
	$(GCLOUD) services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
	$(GCLOUD) artifacts repositories create $(GCLOUD_REPO) \
	    --repository-format=docker \
	    --location=$(GCLOUD_REGION) \
	    || true
	$(GCLOUD) auth configure-docker $(GCLOUD_REGION)-docker.pkg.dev --quiet
	docker build -f $(GCLOUD_DOCKERFILE) -t $(GCLOUD_IMAGE):latest .
	docker push $(GCLOUD_IMAGE):latest
	$(GCLOUD) run deploy $(GCLOUD_SERVICE) \
	    --image $(GCLOUD_IMAGE):latest \
	    --region $(GCLOUD_REGION) \
	    --platform managed \
	    --allow-unauthenticated \
	    --port 8080 \
	    --set-env-vars $(GCLOUD_ENV_VARS)
	@$(GCLOUD) run services describe $(GCLOUD_SERVICE) \
	    --region $(GCLOUD_REGION) \
	    --format 'value(status.url)'

.PHONY: gcloud-update
gcloud-update: ## Build, push, and deploy a new revision (timestamped tag)
	$(eval TAG := $(shell date +%Y%m%d-%H%M%S))
	$(GCLOUD) config set project $(GCLOUD_PROJECT)
	$(GCLOUD) auth configure-docker $(GCLOUD_REGION)-docker.pkg.dev --quiet
	docker build -f $(GCLOUD_DOCKERFILE) \
	    -t $(GCLOUD_IMAGE):$(TAG) \
	    -t $(GCLOUD_IMAGE):latest \
	    .
	@echo "Python version:"; docker run --rm $(GCLOUD_IMAGE):$(TAG) python --version
	@echo "sklearn path:";   docker run --rm $(GCLOUD_IMAGE):$(TAG) python -c "import sklearn; print(sklearn.__file__)"
	docker push $(GCLOUD_IMAGE):$(TAG)
	docker push $(GCLOUD_IMAGE):latest
	$(GCLOUD) run deploy $(GCLOUD_SERVICE) \
	    --image $(GCLOUD_IMAGE):$(TAG) \
	    --region $(GCLOUD_REGION) \
	    --platform managed \
	    --allow-unauthenticated \
	    --port 8080 \
	    --set-env-vars $(GCLOUD_ENV_VARS)
	@echo "Deployed: $(GCLOUD_IMAGE):$(TAG)"
	@$(GCLOUD) run services describe $(GCLOUD_SERVICE) \
	    --region $(GCLOUD_REGION) \
	    --format 'value(status.url)'

.PHONY: gcloud-logs
gcloud-logs: ## Show traffic and recent Cloud Run logs
	$(GCLOUD) config set project $(GCLOUD_PROJECT)
	@$(GCLOUD) run services describe $(GCLOUD_SERVICE) \
	    --region $(GCLOUD_REGION) \
	    --format 'table(status.traffic.revisionName,status.traffic.percent)'
	@echo
	$(GCLOUD) run services logs read $(GCLOUD_SERVICE) \
	    --region $(GCLOUD_REGION) \
	    --limit 100 \
	    --freshness 10m

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
