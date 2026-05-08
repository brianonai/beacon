# --- deps: install all dependencies (incl. dev) for the build stage --------
FROM node:20-slim AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json* ./
# Use ci when a lockfile exists; fall back to install on first build.
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

# --- build: produce the standalone server bundle ----------------------------
FROM node:20-slim AS build
ARG API_TARGET=http://api:8000
ENV API_TARGET=${API_TARGET}
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web ./
# Next standalone runtime expects ./public; COPY fails if the repo omits it.
RUN mkdir -p public
RUN npm run build

# --- runtime: minimal image, non-root user ---------------------------------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Create dedicated user
RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs nextjs

# Standalone output bundles only what's needed.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
