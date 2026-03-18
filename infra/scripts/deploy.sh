#!/bin/bash
set -e
cd /home/ubuntu/gensmart
git pull origin main
npm ci --production=false
cd packages/shared && npm run build && cd ../..
cd apps/web && npm run build && cd ../..
export $(grep -v '^#' .env | xargs)
cd apps/api && npx node-pg-migrate --migrations-dir=src/db/migrations --migration-file-language=sql up && cd ../..
pm2 reload /home/ubuntu/gensmart/ecosystem.config.cjs
echo "Deploy complete!"
