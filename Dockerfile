# All stages are pinned to Debian 12 (Bookworm) slim.

# ── Stage 1: build Next.js standalone ────────────────────────────────────────
FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . ./

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV API_BASE_URL_SERVER=http://localhost:8000

RUN npm run build

# ── Stage 2: install Python deps ─────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS backend-builder

ENV PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 3: combined runtime image ──────────────────────────────────────────
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3000

# Node.js 22 runtime from NodeSource (Debian bookworm package)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python packages from builder
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages \
                             /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# Backend source and data
COPY server   ./server
COPY database ./database

# Next.js standalone build + static assets
# server.js expects .next/static relative to its own directory (/app/web)
COPY --from=frontend-builder /app/.next/standalone ./web
COPY --from=frontend-builder /app/.next/static     ./web/.next/static

EXPOSE 3000 8000
