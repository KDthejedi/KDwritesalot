# Container for the standalone Hocuspocus real-time collaboration server.
# Build from the repo root:
#   docker build -f collab-server/Dockerfile -t marquee-collab .
# Run (provide the same DATABASE_URL and AUTH_SECRET as the app):
#   docker run -p 1234:1234 --env-file .env marquee-collab
FROM node:22-slim

# OpenSSL is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests AND the Prisma schema before install: the `postinstall` hook
# runs `prisma generate`, which needs the schema present. `npm ci` includes dev
# deps so the Prisma CLI is available for that step.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# The server itself.
COPY collab-server ./collab-server

ENV COLLAB_PORT=1234
EXPOSE 1234

# DATABASE_URL and AUTH_SECRET are provided at runtime (env-file or platform).
CMD ["node", "collab-server/server.mjs"]
