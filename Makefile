ENV ?= dev

ifeq ($(ENV),prod)
COMPOSE := docker compose -f docker/compose.prod.yml
else
COMPOSE := docker compose -f docker/compose.yml
endif

.PHONY: help build up down ps shell-api shell-web migrate test lint

help: ## Show this help (ENV=prod for prod stack, default dev)
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
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

test: ## Run api + web tests
	$(COMPOSE) exec --workdir /app/apps/api api pnpm test
	$(COMPOSE) exec --workdir /app/apps/web web pnpm test

lint: ## Lint whole repo
	$(COMPOSE) exec --workdir /app/apps/api api pnpm lint
	$(COMPOSE) exec --workdir /app/apps/web web pnpm lint
