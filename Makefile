# Opina stack management
# Usage: make help
#
#   make dev   → Nuxt on the host with hot reload (UI work)
#   make up    → production Docker image (no HMR; rebuild to pick up changes)

.DEFAULT_GOAL := help

COMPOSE_FILE ?= docker-compose.yml
PROJECT      ?= opina
COMPOSE      := docker compose -f $(COMPOSE_FILE) -p $(PROJECT)
SERVICE      ?= opina
PORT         ?= $(shell grep -E '^OPINA_PORT=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
PORT         := $(if $(PORT),$(PORT),3000)

export DOCKER_UID := $(shell id -u)
export DOCKER_GID := $(shell id -g)

.PHONY: help env sync-env urls install-url up down stop start restart build rebuild \
	logs ps status shell health clean prune reset-data fix-data-perms \
	dev widget demo

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*?## "; printf "\nOpina commands:\n\n"} \
		/^[a-zA-Z_-]+:.*?## / { printf "  \033[36mmake %-12s\033[0m %s\n", $$1, $$2 } \
		END { printf "\n" }' $(MAKEFILE_LIST)

env: ## Create .env from .env.example if missing
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env — edit NUXT_SESSION_PASSWORD before production use."; \
	else \
		echo ".env already exists."; \
	fi

sync-env: env ## Sync root .env → apps/server/.env for local Nuxt
	@url=$$(grep -E '^NUXT_PUBLIC_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'"); \
	pass=$$(grep -E '^NUXT_SESSION_PASSWORD=' .env | cut -d= -f2- | tr -d '"' | tr -d "'"); \
	printf '%s\n' \
		"NUXT_PUBLIC_URL=$${url:-http://localhost:$(PORT)}" \
		"NUXT_SESSION_PASSWORD=$${pass:-dev-only-change-me-32chars-min!!}" \
		"OPINA_DATA_DIR=$(CURDIR)/data" \
		> apps/server/.env
	@echo "Wrote apps/server/.env (OPINA_DATA_DIR=$(CURDIR)/data)"

fix-data-perms: ## Make ./data writable by the current user
	@docker run --rm -v "$(CURDIR)/data:/data" alpine \
		chown -R $(DOCKER_UID):$(DOCKER_GID) /data
	@echo "data/ ownership → $(DOCKER_UID):$(DOCKER_GID)"

urls: ## Print interesting local URLs
	@url=$$(grep -E '^NUXT_PUBLIC_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'"); \
	port="$(PORT)"; \
	if [ -z "$$url" ]; then url="http://localhost:$$port"; fi; \
	base=$${url%/}; \
	echo ""; \
	echo "Opina is running:"; \
	echo "  Panel:   $$base/"; \
	echo "  Install: $$base/install  (needs setup URL from logs)"; \
	echo "  Login:   $$base/login"; \
	echo "  Health:  $$base/api/health"; \
	echo "  Widget:  $$base/widget.js"; \
	echo ""; \
	if [ -f data/setup-url.txt ]; then \
		echo "Setup URL (from data/setup-url.txt):"; \
		echo "  $$(cat data/setup-url.txt)"; \
		echo ""; \
	fi

install-url: ## Show first-time setup URL (one-time token link)
	@if [ -f data/setup-url.txt ]; then \
		echo ""; \
		echo "Setup URL:"; \
		echo "  $$(cat data/setup-url.txt)"; \
		echo ""; \
	else \
		echo "No data/setup-url.txt yet. Trying container logs..."; \
		url=$$($(COMPOSE) logs $(SERVICE) 2>/dev/null | grep -oE 'https?://[^ ]+/setup/[a-f0-9]+' | tail -1); \
		if [ -n "$$url" ]; then \
			echo ""; \
			echo "Setup URL:"; \
			echo "  $$url"; \
			echo ""; \
		else \
			echo "No setup URL found. If setup is already done, use make urls /login."; \
			echo "For a fresh install: make reset-data && make up"; \
		fi; \
	fi

dev: sync-env fix-data-perms widget ## Nuxt HMR on the host (stops Docker first)
	@$(COMPOSE) down --remove-orphans 2>/dev/null || true
	@echo ""
	@echo "Hot reload (Nuxt) → http://localhost:$(PORT)/"
	@echo "Stop with Ctrl+C. Use make up for the production Docker image."
	@echo ""
	pnpm --filter @opina/server exec nuxt dev --host 127.0.0.1 --port $(PORT)

widget: ## Build packages/widget → apps/server/public/widget.js
	pnpm --filter @opina/widget build

demo: ## Vue demo site on :3001 (needs make dev on :3000)
	@echo "Demo → http://127.0.0.1:3001/  (Opina API must be on :3000)"
	pnpm --filter @opina/demo dev

up: env ## Build + start production Docker stack (no HMR)
	$(COMPOSE) up -d --build --wait
	@$(MAKE) --no-print-directory urls
	@$(MAKE) --no-print-directory install-url

down: ## Stop and remove containers (keeps ./data)
	$(COMPOSE) down --remove-orphans

stop: ## Stop containers without removing them
	$(COMPOSE) stop

start: ## Start existing containers
	$(COMPOSE) start --wait
	@$(MAKE) --no-print-directory urls
	@$(MAKE) --no-print-directory install-url

restart: ## Restart the stack (or SERVICE=opina)
	$(COMPOSE) restart $(SERVICE)
	@$(MAKE) --no-print-directory urls
	@$(MAKE) --no-print-directory install-url

build: ## Build images without starting
	$(COMPOSE) build

rebuild: ## Rebuild images with no cache, then start
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d --wait
	@$(MAKE) --no-print-directory urls
	@$(MAKE) --no-print-directory install-url

logs: ## Follow logs (SERVICE=opina optional)
	$(COMPOSE) logs -f --tail=200 $(SERVICE)

ps: ## Show container status
	$(COMPOSE) ps

status: ps urls ## Show status and URLs

shell: ## Open a shell in the app container
	$(COMPOSE) exec $(SERVICE) sh

health: ## Hit /api/health and print URLs
	@curl -fsS "http://127.0.0.1:$(PORT)/api/health" && echo
	@$(MAKE) --no-print-directory urls

clean: ## Stop stack and remove orphans (keeps ./data bind mount)
	$(COMPOSE) down --remove-orphans

reset-data: down ## Wipe SQLite data (fresh install / new setup token)
	docker run --rm -v "$(CURDIR)/data:/data" alpine \
		sh -c 'rm -f /data/opina.db /data/opina.db-shm /data/opina.db-wal /data/setup-url.txt'
	@echo "Data wiped. Run: make up  or  make dev"

prune: ## Remove unused Docker build cache for this project images
	docker image prune -f --filter label=com.docker.compose.project=$(PROJECT)
