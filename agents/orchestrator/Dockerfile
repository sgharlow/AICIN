# AICIN Orchestrator Agent Dockerfile
# Multi-stage build for optimized container size

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY package.json ./
COPY shared/types/package.json shared/types/
COPY shared/database/package.json shared/database/
COPY shared/utils/package.json shared/utils/
COPY agents/orchestrator/package.json agents/orchestrator/

# Install all dependencies
RUN npm install --workspaces

# Copy source code
COPY shared/ shared/
COPY agents/orchestrator/ agents/orchestrator/

# Build all packages
RUN npm run build --workspace=@aicin/types
RUN npm run build --workspace=@aicin/database
RUN npm run build --workspace=@aicin/utils
RUN npm run build --workspace=@aicin/orchestrator

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY shared/types/package.json shared/types/
COPY shared/database/package.json shared/database/
COPY shared/utils/package.json shared/utils/
COPY agents/orchestrator/package.json agents/orchestrator/

# Install production dependencies only
RUN npm install --workspaces --production

# Copy built artifacts from builder
COPY --from=builder /app/shared/types/dist shared/types/dist
COPY --from=builder /app/shared/database/dist shared/database/dist
COPY --from=builder /app/shared/utils/dist shared/utils/dist
COPY --from=builder /app/agents/orchestrator/dist agents/orchestrator/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["node", "agents/orchestrator/dist/index.js"]
