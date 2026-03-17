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

echo "3. Building all packages..."
npm run build

echo "4. Running database migrations..."
cd apps/api && npx node-pg-migrate up && cd ../..

echo "5. Reloading PM2 processes..."
pm2 reload ecosystem.config.cjs

echo "=== Deploy complete! ==="
echo "Finished at: $(date)"
