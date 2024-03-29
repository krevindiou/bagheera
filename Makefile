SHELL:=/bin/bash
MAKEFILE_PATH:=$(abspath $(lastword $(MAKEFILE_LIST)))
PROJECT_DIR:=$(patsubst %/,%,$(dir $(MAKEFILE_PATH)))
PROJECT_NAME:=$(notdir $(PROJECT_DIR))
APP_ENV?=dev
DOCKER_BIN=docker
DOCKER_COMPOSE_BIN=docker-compose
DOCKER_CONFIG_DIR=$(PROJECT_DIR)/.docker
DOCKER_COMPOSE_CONFIG=$(DOCKER_CONFIG_DIR)/docker-compose-$(APP_ENV).yml
DOCKER_COMPOSE_OPTIONS=-p $(PROJECT_NAME) -f $(DOCKER_CONFIG_DIR)/docker-compose.yml -f $(DOCKER_COMPOSE_CONFIG)
CONTAINER?=bagheera-php
COMMAND?=$(SHELL)

export APP_ENV:=$(APP_ENV)

.PHONY: help
help:
	@echo -e "$$(grep -hE '^\S+:.*##' $(MAKEFILE_LIST) | sed -e 's/:.*##\s*/:/' -e 's/^\(.\+\):\(.*\)/\\x1b[36m\1\\x1b[m:\2/' | column -c2 -t -s :)"

.PHONY: build
build: ## Build application
	@umask 000
	@composer --working-dir="$(PROJECT_DIR)" install --no-ansi --no-interaction --no-progress
	@yarn --cwd=$(PROJECT_DIR) install --production=false
	@yarn --cwd=$(PROJECT_DIR) encore dev
	@(php $(PROJECT_DIR)/bin/console bagheera:init-database src/Resources/config/db/structure.sql src/Resources/config/db/data.sql || php $(PROJECT_DIR)/bin/console doctrine:migrations:migrate --no-interaction) \
		&& php $(PROJECT_DIR)/bin/console doctrine:migrations:sync-metadata-storage --no-interaction \
		&& php $(PROJECT_DIR)/bin/console doctrine:migrations:version --no-interaction --add --all

.PHONY: test
test: ## Run tests
	@./vendor/bin/simple-phpunit -c /srv/www/bagheera/tests/Controller
	@./vendor/bin/simple-phpunit -c /srv/www/bagheera/tests/Api

.PHONY: docker-run
docker-run: check-config ## Execute program in a new container
	@$(DOCKER_BIN) run --rm -ti $(CONTAINER) $(COMMAND)

.PHONY: docker-exec
docker-exec: check-config ## Execute program in container
	@$(DOCKER_BIN) exec -ti $(CONTAINER) $(COMMAND)

.PHONY: docker-logs
docker-logs: check-config ## Display containers logs
	@$(DOCKER_COMPOSE_BIN) $(DOCKER_COMPOSE_OPTIONS) logs -t -f

.PHONY: docker-build
docker-build: check-config ## Build containers
	@$(DOCKER_COMPOSE_BIN) $(DOCKER_COMPOSE_OPTIONS) build

.PHONY: docker-push
docker-push: check-config ## Push containers to registry
	@$(DOCKER_COMPOSE_BIN) $(DOCKER_COMPOSE_OPTIONS) push

.PHONY: docker-start
docker-start: check-config ## Start containers
ifeq ("$(APP_ENV)","prod")
	@$(DOCKER_COMPOSE_BIN) $(DOCKER_COMPOSE_OPTIONS) up -d
else
	@$(DOCKER_COMPOSE_BIN) $(DOCKER_COMPOSE_OPTIONS) up --build -d
endif

.PHONY: docker-stop
docker-stop: check-config ## Stop containers
	@$(DOCKER_COMPOSE_BIN) $(DOCKER_COMPOSE_OPTIONS) stop

.PHONY: docker-test-ci
docker-test-ci: check-config ## Run tests for CI in container
	@make docker-exec COMMAND="php-cs-fixer fix --dry-run --diff"
	@make docker-exec COMMAND="./vendor/bin/simple-phpunit -c /srv/www/bagheera/tests/Controller --coverage-clover=coverage.xml"
	@make docker-exec COMMAND="./vendor/bin/simple-phpunit -c /srv/www/bagheera/tests/Api --coverage-clover=coverage.xml"
	@make docker-exec COMMAND="./vendor/bin/phpstan analyse --no-progress"
	@make docker-exec COMMAND="./vendor/bin/rector process --dry-run --no-progress-bar"

.PHONY: check-config
check-config:
ifeq ("$(wildcard $(DOCKER_COMPOSE_CONFIG))","")
	@echo '"'$(DOCKER_COMPOSE_CONFIG)'"' file is missing
	@exit 1
endif
