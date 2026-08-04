# ==========================================
# MULTI-STAGE BUILD FOR NESTJS BACKEND
# ==========================================

# --- Stage 1: Build & Compile ---
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency configs
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy application source code
COPY . .

# Compile TypeScript to JavaScript production build
RUN npm run build

# --- Stage 2: Production Runner ---
FROM node:18-alpine AS runner

WORKDIR /usr/src/app

# Copy package config
COPY package*.json ./

# Install production dependencies only (excludes TypeScript compilers, etc.)
RUN npm ci --only=production

# Copy compiled build from Stage 1
COPY --from=builder /usr/src/app/dist ./dist

# Expose NestJS port
EXPOSE 3000

# Start NestJS production build
CMD ["node", "dist/main"]
