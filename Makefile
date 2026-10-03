# KShisen Web - a web port of KShisen, the KDE Shisen-Sho game
#
# Convenience targets around the npm scripts. "make check" runs everything.
#
# SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>
#
# SPDX-FileCopyrightText: 2026 Giuliano Zorzi
# SPDX-License-Identifier: GPL-2.0-or-later

NPM ?= npm
DOCKER ?= docker
COMPOSE ?= $(DOCKER) compose
PORT ?= 8080

.PHONY: all install dev build preview test typecheck check check-render check-app \
	clean serve serve-stop serve-restart serve-logs serve-image serve-nuke help

all: check build

install:
	$(NPM) install

dev:
	$(NPM) run dev

build:
	$(NPM) run build

preview:
	$(NPM) run preview

test:
	$(NPM) run test

typecheck:
	$(NPM) run typecheck

check: test typecheck check-render check-app

check-render:
	$(NPM) run check:render

check-app:
	$(NPM) run check:app

clean:
	rm -rf dist

# Serve the game on the network in a container. PORT changes the published
# port, e.g. "make serve PORT=9000".

serve: ## build the game and serve it on http://$(PORT), also on the network
	$(COMPOSE) up -d --build
	@echo "kshisen serves on http://localhost:$(PORT), published on all interfaces"

serve-stop: ## stop the running container
	$(COMPOSE) stop

serve-restart: ## stop and start again, with a rebuild
	$(COMPOSE) stop
	$(MAKE) serve

serve-logs: ## follow the logs of the container
	$(COMPOSE) logs -f

serve-image: ## build the container image without starting it
	$(COMPOSE) build

serve-nuke: ## stop the container and remove it
	$(COMPOSE) down --remove-orphans

help: ## list the targets
	@grep -E '^[a-zA-Z-]+:.*?##' $(MAKEFILE_LIST) | sed -e 's/:.*##/\t/'