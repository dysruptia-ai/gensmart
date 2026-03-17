#!/bin/bash
# GenSmart — Initial Server Setup Script
# Run on fresh Ubuntu 24.04 Lightsail instance
# Usage: bash setup.sh

set -e

echo "=== GenSmart Server Setup ==="

# 1. System updates
echo "1. Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Node.js 20 LTS
echo "2. Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 3. PostgreSQL 16
echo "3. Installing PostgreSQL 16..."
sudo apt install -y postgresql-16 postgresql-server-dev-16

# 4. pgvector extension
echo "4. Building pgvector extension..."
cd /tmp
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
cd ~

# 5. Redis 7
echo "5. Installing Redis..."
sudo apt install -y redis-server
sudo systemctl enable redis-server

# 6. Nginx
echo "6. Installing Nginx..."
sudo apt install -y nginx
sudo systemctl enable nginx

# 7. Certbot (Let's Encrypt)
echo "7. Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# 8. Create PostgreSQL database and user
echo "8. Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER gensmart WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE gensmart OWNER gensmart;"
sudo -u postgres psql -d gensmart -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d gensmart -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 9. Configure Redis (bind to localhost only)
echo "9. Securing Redis..."
sudo sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf
sudo systemctl restart redis-server

# 10. Create app directory
echo "10. Creating app directory..."
mkdir -p /home/ubuntu/gensmart
sudo chown ubuntu:ubuntu /home/ubuntu/gensmart

# 11. Setup Nginx config
echo "11. Configuring Nginx..."
sudo cp /home/ubuntu/gensmart/infra/nginx/gensmart.conf /etc/nginx/sites-available/gensmart
sudo ln -sf /etc/nginx/sites-available/gensmart /etc/nginx/sites-enabled/gensmart
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 12. Firewall
echo "12. Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 13. SSL certificates
echo "13. Obtaining SSL certificates..."
sudo certbot --nginx -d gensmart.co -d www.gensmart.co -d api.gensmart.co --non-interactive --agree-tos -m admin@gensmart.co

# 14. Certbot auto-renewal
sudo systemctl enable certbot.timer

# 15. Daily pg_dump backup at 3 AM
echo "15. Setting up daily database backups..."
mkdir -p /home/ubuntu/backups
(crontab -l 2>/dev/null; echo "0 3 * * * pg_dump -U gensmart gensmart | gzip > /home/ubuntu/backups/gensmart-\$(date +\%Y\%m\%d).sql.gz") | crontab -

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1. Clone repo: cd /home/ubuntu/gensmart && git clone https://github.com/dysruptia-ai/gensmart.git ."
echo "2. Create .env file with production values (see .env.example)"
echo "3. Run: npm ci && npm run build"
echo "4. Run migrations: cd apps/api && npx node-pg-migrate up"
echo "5. Start PM2: pm2 start ecosystem.config.cjs && pm2 save && pm2 startup"
