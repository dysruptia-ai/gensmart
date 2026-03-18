#!/bin/bash
# GenSmart — Deploy Script
# Run on the Lightsail instance to pull latest changes and restart services

set -e

echo "=== GenSmart Deploy ==="
echo "Started at: $(date)"

cd /home/ubuntu/gensmart

echo "1. Pulling latest changes..."
git pull origin main

echo "2. Installing dependencies..."
npm ci --production=false

echo "3. Building shared package..."
cd packages/shared && npm run build && cd ../..

echo "4. Building Next.js frontend..."
cd apps/web && npm run build && cd ../..

echo "5. Running database migrations..."
cd apps/api && npx node-pg-migrate --migrations-dir=src/db/migrations --migration-file-language=sql up && cd ../..

echo "6. Reloading PM2 processes..."
pm2 reload ecosystem.config.cjs

echo "=== Deploy complete! ==="
echo "Finished at: $(date)"
