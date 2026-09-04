COMPOSE := docker compose -f docker/compose.yml
COMPOSE_E2E := docker compose -p bagheera-e2e -f docker/compose.yml -f docker/compose.e2e.yml

.PHONY: help build up down ps shell-api shell-web migrate test test-unit test-integration test-e2e lint format

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build images
	$(COMPOSE) build

up: ## Start stack
	$(COMPOSE) up

down: ## Stop stack
	$(COMPOSE) down

ps: ## List containers
	$(COMPOSE) ps

shell-api: ## Shell into api container
	$(COMPOSE) exec api sh

shell-web: ## Shell into web container
	$(COMPOSE) exec web sh

migrate: ## Run db migrations
	$(COMPOSE) exec --workdir /app/apps/api api pnpm db:migrate

test: test-unit test-integration test-e2e ## Run unit + integration + e2e tests

test-unit: ## Run api + web unit tests
	$(COMPOSE) exec --workdir /app/apps/api api pnpm test
	$(COMPOSE) exec --workdir /app/apps/web web pnpm test

test-integration: ## Run api integration tests
	$(COMPOSE) exec --workdir /app/apps/api api pnpm test:integration

test-e2e: ## Run e2e tests
	$(COMPOSE_E2E) up -d --build
	@echo "Waiting for api (db:migrate runs as part of its startup command)..."
	@until [ "$$($(COMPOSE_E2E) ps api --format '{{.Health}}')" = "healthy" ]; do sleep 2; done
	$(COMPOSE_E2E) exec --workdir /app/apps/api api pnpm db:seed
	$(COMPOSE_E2E) --profile e2e run --rm playwright; status=$$?; $(COMPOSE_E2E) --profile e2e down -v; exit $$status

lint: ## Lint whole repo
	$(COMPOSE) exec --workdir /app/apps/api api pnpm lint
	$(COMPOSE) exec --workdir /app/apps/web web pnpm lint

format: ## Format whole repo
	$(COMPOSE) exec --workdir /app/apps/api api pnpm format
	$(COMPOSE) exec --workdir /app/apps/web web pnpm format
