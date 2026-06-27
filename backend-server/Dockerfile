# Stage 1: Build TypeScript app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies for typescript compilation)
RUN npm ci

# Copy configuration and sources
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
# Copy openapi.yaml if present in the build context
COPY openapi.yaml* ./openapi.yaml

# Build the typescript files
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled files and assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
# Copy openapi.yaml (if present) to the container root
COPY --from=builder /app/openapi.yaml* ./openapi.yaml

# Expose port (Cloud Run will override this with its own PORT env var, default to 5000)
EXPOSE 5000

# Start the standalone express server
CMD ["node", "dist/local.js"]
