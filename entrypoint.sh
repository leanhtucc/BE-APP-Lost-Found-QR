#!/bin/sh
set -e

echo ">>> [SYSTEM] Starting Entrypoint Script..."
echo ">>> [SYSTEM] NODE_ENV: $NODE_ENV"
echo ">>> [SYSTEM] PORT: $PORT"

# Migrations are opt-in so a restart or a scale-out never touches the schema by
# surprise. Set RUN_MIGRATIONS=true on the first deploy (or run
# `npx prisma migrate deploy` as a one-off job) and turn it off afterwards.
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo ">>> [SYSTEM] Running Database Migrations..."
    npx prisma migrate deploy
else
    echo ">>> [SYSTEM] Skipping migrations (RUN_MIGRATIONS is not 'true')"
fi

echo ">>> [SYSTEM] Checking build files..."
if [ -f "./dist/server.js" ]; then
    echo ">>> [SYSTEM] dist/server.js found. Starting server..."
    exec node dist/server.js
else
    echo ">>> [ERROR] dist/server.js NOT FOUND!"
    ls -R dist || echo "dist directory does not exist"
    exit 1
fi
