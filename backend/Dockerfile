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

# Apply pending migrations, then start the server (uses Railway's $PORT)
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
