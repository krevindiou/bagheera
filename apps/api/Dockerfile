# syntax=docker/dockerfile:1
# Build context is the repo root (pnpm workspace), e.g.:
#   docker build -f apps/api/Dockerfile -t bagheera-api .

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
# argon2 compiles a native addon on install.
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod --legacy /app/deploy/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/deploy/api/node_modules ./node_modules
COPY --from=build /app/deploy/api/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
