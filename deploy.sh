#!/bin/bash
set -e

DOMAIN="codepush-api.orderx.vn"
APP_DIR="/home/speed/fastpush"
EMAIL="${1:-admin@orderx.vn}"
DB_PASS="${2:-$(openssl rand -hex 8)}"

echo "======================================"
echo "  FastPush Deploy — $DOMAIN"
echo "======================================"

# 1. Node.js 20
echo "[1/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version

# 2. PostgreSQL
echo "[2/7] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

sudo -u postgres psql -c "CREATE USER fastpush WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE fastpush OWNER fastpush;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fastpush TO fastpush;" 2>/dev/null || true

# 3. PM2 + Nginx
echo "[3/7] Installing PM2 and Nginx..."
npm install -g pm2
apt-get install -y nginx
systemctl enable nginx

# 4. App directory + .env
echo "[4/7] Configuring app..."
mkdir -p $APP_DIR/server/uploads $APP_DIR/dashboard

cat > $APP_DIR/server/.env << EOF
DATABASE_URL="postgresql://fastpush:${DB_PASS}@localhost:5432/fastpush?schema=public"
JWT_SECRET="$(openssl rand -hex 32)"
PORT=3000
UPLOAD_DIR="${APP_DIR}/server/uploads"
EOF

echo ">>> .env written. DB Password: $DB_PASS"

# 5. Install deps + DB migrate
echo "[5/7] Installing dependencies and migrating DB..."
cd $APP_DIR/server
npm install
npx prisma db push

# 6. PM2
echo "[6/7] Starting server with PM2..."
pm2 delete fastpush-server 2>/dev/null || true
pm2 start src/index.js --name fastpush-server
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | tail -1 | bash || true

curl -s http://localhost:3000/api/health && echo " ✓ Server OK"

# 7. Nginx + SSL
echo "[7/7] Configuring Nginx..."
cat > /etc/nginx/sites-available/fastpush << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        root $APP_DIR/dashboard;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/fastpush /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# SSL
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL \
  && echo "✓ SSL OK" \
  || echo "⚠ SSL failed — check DNS A record points to this server, then run: certbot --nginx -d $DOMAIN"

echo ""
echo "======================================"
echo "  ✅ Deploy complete!"
echo "  Dashboard : https://$DOMAIN"
echo "  API health: https://$DOMAIN/api/health"
echo "  DB Password: $DB_PASS"
echo "  (saved in $APP_DIR/server/.env)"
echo "======================================"
