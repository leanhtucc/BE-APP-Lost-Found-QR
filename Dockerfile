FROM node:22-alpine

# Install system dependencies + build tools for native modules (bcrypt)
RUN apk add --no-cache libc6-compat openssl python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Change ownership to node user
RUN chown -R node:node /app

# Use non-root node user
USER node

# Expose port
EXPOSE 3000

# Standard start command
CMD ["npm", "start"]
