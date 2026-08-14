# syntax=docker/dockerfile:1
# Build context is the repo root (pnpm workspace), e.g.:
#   docker build -f apps/web/Dockerfile -t bagheera-web .
# The resulting image holds nothing but the built static assets under /assets,
# ready to be copied into the Caddy image that serves them.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
# Workspace install resolves apps/api's deps too; argon2 compiles a native
# addon on install.
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter web build

FROM scratch AS runtime
COPY --from=build /app/apps/web/dist /assets
