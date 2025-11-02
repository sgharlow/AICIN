# Profile Analyzer Agent Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY shared/types/package.json shared/types/
COPY shared/utils/package.json shared/utils/
COPY agents/profile-analyzer/package.json agents/profile-analyzer/
RUN npm install --workspaces
COPY shared/ shared/
COPY agents/profile-analyzer/ agents/profile-analyzer/
RUN npm run build --workspace=@aicin/types
RUN npm run build --workspace=@aicin/utils
RUN npm run build --workspace=@aicin/profile-analyzer

FROM node:18-alpine
WORKDIR /app
COPY package.json ./
COPY shared/types/package.json shared/types/
COPY shared/utils/package.json shared/utils/
COPY agents/profile-analyzer/package.json agents/profile-analyzer/
RUN npm install --workspaces --production
COPY --from=builder /app/shared/types/dist shared/types/dist
COPY --from=builder /app/shared/utils/dist shared/utils/dist
COPY --from=builder /app/agents/profile-analyzer/dist agents/profile-analyzer/dist
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "agents/profile-analyzer/dist/index.js"]
