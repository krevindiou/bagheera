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
ifeq ($(APP_ENV),prod)
	@composer --working-dir="$(PROJECT_DIR)" install --no-ansi --no-interaction --no-progress --no-dev --optimize-autoloader
	@yarn --cwd=$(PROJECT_DIR) install --production=true
	@yarn --cwd=$(PROJECT_DIR) encore production
else
	@composer --working-dir="$(PROJECT_DIR)" install --no-ansi --no-interaction --no-progress
	@yarn --cwd=$(PROJECT_DIR) install --production=false
	@yarn --cwd=$(PROJECT_DIR) encore dev
endif
	@php $(PROJECT_DIR)/bin/console doctrine:migrations:migrate --no-interaction

.PHONY: test
test: ## Run tests
	@php bin/phpunit -c /srv/www/bagheera

.PHONY: docker-exec
docker-exec: check-config ## Execute program in container
	@$(DOCKER_BIN) exec -ti $(CONTAINER) $(COMMAND)

.PHONY: docker-logs
docker-logs: check-config ## Display containers logs
	@$(DOCKER_COMPOSE_BIN) $(DOCKER_COMPOSE_OPTIONS) logs -f

.PHONY: docker-start
docker-start: check-config ## Start containers
	@$(DOCKER_COMPOSE_BIN) $(DOCKER_COMPOSE_OPTIONS) up -d

.PHONY: docker-stop
docker-stop: check-config ## Stop containers
	@$(DOCKER_COMPOSE_BIN) $(DOCKER_COMPOSE_OPTIONS) stop

.PHONY: docker-test
docker-test: check-config ## Run tests in container
	@make docker-exec COMMAND="make test"

.PHONY: check-config
check-config:
ifeq ("$(wildcard $(DOCKER_COMPOSE_CONFIG))","")
	@echo '"'$(DOCKER_COMPOSE_CONFIG)'"' file is missing
	@exit 1
endif
