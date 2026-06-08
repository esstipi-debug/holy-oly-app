# syntax=docker/dockerfile:1
# Holy Oly — single Node service that serves the API + the built SPA on the same origin.
# Portable container build: works on Railway, Fly.io, Render, or any container host.
# The DB is external (managed Postgres): provide DATABASE_URL at runtime.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- build stage: install all deps, build web (API mode) + api, fold the SPA into the server ----
FROM base AS build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# Copy only manifests first for better layer caching on the install step.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @holy-oly/api exec prisma generate \
 && VITE_API_ENABLED=true pnpm --filter @holy-oly/web build \
 && pnpm --filter @holy-oly/api build \
 && rm -rf apps/api/dist/public && cp -r apps/web/dist apps/api/dist/public

# ---- runtime stage ----
FROM base AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV SERVE_WEB=true
# Bring the fully-installed + built workspace (keeps prisma engines + the core workspace link intact).
COPY --from=build /app /app
WORKDIR /app/apps/api
# The platform injects PORT (Railway/Render). main.ts binds 0.0.0.0:$PORT. 8787 is the local default.
EXPOSE 8787
# Apply migrations, then boot. (start:prod = "prisma migrate deploy && node dist/main.js")
CMD ["pnpm", "start:prod"]
