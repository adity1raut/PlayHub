# Stage 1: Build the React app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build the production bundle
RUN npm run build

# Stage 2: Serve the built files with a lightweight static server
FROM node:18-alpine AS runner

WORKDIR /app

# Install serve to host static files
RUN npm install -g serve

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Expose port 4173 (serve default) or 80
EXPOSE 4173

# Serve the built app
CMD ["serve", "-s", "dist", "-l", "4173"]
