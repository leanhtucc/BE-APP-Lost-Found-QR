FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

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

# Start command
CMD ["npm", "start"]
