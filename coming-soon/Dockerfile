# SimpleBeacon Frontend — Production Docker Image
# Build: docker build -t simplebeacon-coming-soon .
# Run:   docker run -p 3001:3001 simplebeacon-coming-soon

FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Expose the Express server port
EXPOSE 3001

# Start the server
CMD ["node", "server.cjs"]
