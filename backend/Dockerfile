# Deterministic backend build for Railway (guarantees Node 20 + npm).
FROM node:20-slim

WORKDIR /app

# Prisma needs openssl at build (generate) and runtime (migrate deploy).
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run db:generate && npm run build

ENV NODE_ENV=production

# Stop the Prisma CLI from making update-check / telemetry network calls. On
# Railway's restricted egress these can hang the `migrate deploy` step after it
# prints "No pending migrations", which blocks the server from ever starting.
ENV CHECKPOINT_DISABLE=1
ENV PRISMA_HIDE_UPDATE_MESSAGE=1

# Start the HTTP server directly. Migrations are NOT run here: `npx prisma
# migrate deploy` hangs on Railway's restricted egress (npx package resolution),
# which blocked the server from ever starting. Run migrations separately via
# Railway's "Pre-deploy Command" or manually when the schema changes.
CMD ["node", "dist/server.js"]
