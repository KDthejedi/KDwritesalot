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

# Install dependencies (the collab server needs @hocuspocus/*, @prisma/client, jose).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Generate the Prisma client from the schema.
COPY prisma ./prisma
RUN npx prisma generate

# The server itself.
COPY collab-server ./collab-server

ENV COLLAB_PORT=1234
EXPOSE 1234

# DATABASE_URL and AUTH_SECRET are provided at runtime (env-file or platform).
CMD ["node", "collab-server/server.mjs"]
