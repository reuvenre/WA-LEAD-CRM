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

# Apply pending migrations, then start the server (uses Railway's $PORT).
# Use `;` (not `&&`) before the server so a migration hiccup can never stop the
# HTTP server from coming up; echo markers make the boot sequence visible in logs.
CMD ["sh", "-c", "echo '== migrate ==' && npx prisma migrate deploy; echo '== starting server ==' && node dist/server.js"]
