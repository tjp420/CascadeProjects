# SimpleBeacon Frontend — secure multi-stage production image
# Build: docker build -t simplebeacon-coming-soon:prod .
# Run:   docker run -p 3001:3001 simplebeacon-coming-soon:prod

### Builder stage
FROM node:22-alpine AS builder
WORKDIR /app

# Install build deps and build app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

### Runtime stage (minimal, non-root)
FROM node:22-alpine AS runtime
WORKDIR /srv/app

# Install tini to handle signals correctly
RUN apk add --no-cache tini

# Copy only production files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm ci --only=production

# Copy built public assets and server entrypoint
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.cjs ./server.cjs

# Use an unprivileged user (node exists in official node images)
USER node

EXPOSE 3001

# Health check — uses Node.js http module (no curl in alpine image)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/', r => process.exit(r.statusCode < 400 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.cjs"]
