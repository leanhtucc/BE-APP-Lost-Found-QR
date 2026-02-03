#!/bin/sh
set -e

echo ">>> [SYSTEM] Starting Entrypoint Script..."

# Print environment info (masking secrets)
echo ">>> [SYSTEM] NODE_ENV: $NODE_ENV"
echo ">>> [SYSTEM] PORT: $PORT"

echo ">>> [SYSTEM] Running Database Migrations..."
npx prisma migrate deploy

echo ">>> [SYSTEM] Checking build files..."
if [ -f "./dist/server.js" ]; then
    echo ">>> [SYSTEM] dist/server.js found. Starting server..."
    # Chạy node trực tiếp
    exec node dist/server.js
else
    echo ">>> [ERROR] dist/server.js NOT FOUND!"
    ls -R dist || echo "dist directory does not exist"
    exit 1
fi
