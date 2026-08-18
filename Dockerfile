# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for tsc)
RUN npm install

# Copy source code and config
COPY tsconfig.json ./
COPY src/ ./src/

# Build the TypeScript code to /dist
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Copy tesseract models so they don't need to be downloaded at runtime
COPY eng.traineddata ./
COPY osd.traineddata ./

# Cloud Run defaults to port 8080
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
