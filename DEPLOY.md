# FastPush — Deploy lên VPS Ubuntu

Domain: `codepush-api.orderx.vn`
SSH Port: `22116`
User: `speed`

---

## Bước 1 — Upload code lên VPS (chạy trên máy Mac)

```bash
# Tạo thư mục trên VPS trước
ssh -p 22116 speed@net.orderx.vn "mkdir -p /opt/fastpush/server /opt/fastpush/dashboard"

# Nén server (bỏ qua node_modules, .env, uploads)
cd /Users/dangtrungthang/Documents/GitHub/fastpush
tar --exclude='server/node_modules' \
    --exclude='server/.env' \
    --exclude='server/uploads' \
    -czf /tmp/fastpush-server.tar.gz server/

scp -P 22116 /tmp/fastpush-server.tar.gz speed@net.orderx.vn:/opt/fastpush/
ssh -p 22116 speed@net.orderx.vn \
  "cd /opt/fastpush && tar -xzf fastpush-server.tar.gz && rm fastpush-server.tar.gz"

echo "Server code uploaded"
```

```bash
# Build dashboard rồi upload
cd /Users/dangtrungthang/Documents/GitHub/fastpush/dashboard
npm run build

tar -czf /tmp/fastpush-dashboard.tar.gz -C dist .
scp -P 22116 /tmp/fastpush-dashboard.tar.gz speed@net.orderx.vn:/opt/fastpush/
ssh -p 22116 speed@net.orderx.vn \
  "cd /opt/fastpush && tar -xzf fastpush-dashboard.tar.gz -C dashboard && rm fastpush-dashboard.tar.gz"

echo "Dashboard uploaded"
```

```bash
# Upload deploy script
scp -P 22116 /Users/dangtrungthang/Documents/GitHub/fastpush/deploy.sh \
  speed@net.orderx.vn:/opt/deploy.sh
```

---

## Bước 2 — SSH vào VPS và chạy deploy script

```bash
ssh -p 22116 speed@net.orderx.vn
```

Trên VPS:
```bash
sudo bash /opt/deploy.sh your-email@gmail.com
```

Script sẽ tự động làm hết các bước 3–9 bên dưới. Nếu muốn làm thủ công thì đọc tiếp.

---

## Bước 3 — Nâng Node.js lên 20 LTS (trên VPS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
node --version   # phải ra v20.x.x
```

---

## Bước 4 — Cài PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Tạo user và database
sudo -u postgres psql << 'SQL'
CREATE USER fastpush WITH PASSWORD 'fastpush_strong_password_123';
CREATE DATABASE fastpush OWNER fastpush;
GRANT ALL PRIVILEGES ON DATABASE fastpush TO fastpush;
SQL
```

---

## Bước 5 — Cài PM2 và Nginx

```bash
npm install -g pm2
sudo apt install -y nginx
sudo systemctl enable nginx
```

---

## Bước 6 — Cấu hình .env

```bash
mkdir -p /opt/fastpush/server/uploads

cat > /opt/fastpush/server/.env << 'EOF'
DATABASE_URL="postgresql://fastpush:fastpush_strong_password_123@localhost:5432/fastpush?schema=public"
JWT_SECRET="change-this-to-a-random-64-char-string"
PORT=3000
UPLOAD_DIR="/opt/fastpush/server/uploads"
EOF
```

---

## Bước 7 — Cài dependencies và migrate database

```bash
cd /opt/fastpush/server
npm install
npx prisma db push
```

---

## Bước 8 — Chạy server bằng PM2

```bash
cd /opt/fastpush/server
pm2 start src/index.js --name fastpush-server
pm2 save
pm2 startup   # copy và chạy lệnh nó in ra

# Kiểm tra
pm2 status
curl http://localhost:3000/api/health
```

---

## Bước 9 — Cấu hình Nginx

```bash
cat > /etc/nginx/sites-available/fastpush << 'EOF'
server {
    listen 80;
    server_name codepush-api.orderx.vn;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        root /opt/fastpush/dashboard;
        try_files $uri $uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/fastpush /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

## Bước 10 — Cài SSL (HTTPS)

> Trước khi chạy: đảm bảo DNS A record `codepush-api.orderx.vn` đã trỏ về IP VPS.

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d codepush-api.orderx.vn \
  --non-interactive --agree-tos -m your-email@gmail.com

# Auto-renew
sudo systemctl enable certbot.timer
```

---

## Bước 11 — Cập nhật URL trong app RN (trên máy Mac)

Sau khi server chạy, vào `https://codepush-api.orderx.vn` → đăng ký → tạo app → lấy deployment key mới.

Đổi trong `FastPushDemo/App.tsx`:
```
serverUrl: 'https://codepush-api.orderx.vn'
```

Đổi trong `FastPushDemo/android/.../MainApplication.kt`:
```kotlin
FastPushConfig.serverUrl = "https://codepush-api.orderx.vn"
FastPushConfig.deploymentKey = "KEY_MỚI_TỪ_DASHBOARD"
```

Đổi CLI:
```bash
fastpush server https://codepush-api.orderx.vn
fastpush login
```

---

## Re-deploy khi có code mới (trên máy Mac)

```bash
# Server
cd /Users/dangtrungthang/Documents/GitHub/fastpush
tar --exclude='server/node_modules' --exclude='server/.env' --exclude='server/uploads' \
    -czf /tmp/fastpush-server.tar.gz server/
scp -P 22116 /tmp/fastpush-server.tar.gz speed@net.orderx.vn:/opt/fastpush/
ssh -p 22116 speed@net.orderx.vn \
  "cd /opt/fastpush && tar -xzf fastpush-server.tar.gz && rm fastpush-server.tar.gz && \
   cd server && npm install && npx prisma db push && pm2 restart fastpush-server"

# Dashboard
cd /Users/dangtrungthang/Documents/GitHub/fastpush/dashboard && npm run build
tar -czf /tmp/fastpush-dashboard.tar.gz -C dist .
scp -P 22116 /tmp/fastpush-dashboard.tar.gz speed@net.orderx.vn:/opt/fastpush/
ssh -p 22116 speed@net.orderx.vn \
  "cd /opt/fastpush && tar -xzf fastpush-dashboard.tar.gz -C dashboard && rm fastpush-dashboard.tar.gz"
```

---

## Kiểm tra

```bash
curl https://codepush-api.orderx.vn/api/health

# Log realtime
ssh -p 22116 speed@net.orderx.vn "pm2 logs fastpush-server --lines 50"
```

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `502 Bad Gateway` | Server Node chưa chạy | `pm2 restart fastpush-server` |
| `413 Request Entity Too Large` | File upload quá lớn | Đã set `client_max_body_size 500M` |
| `SSL cert failed` | Domain chưa trỏ về VPS | Kiểm tra DNS A record |
| `Prisma error P1001` | PostgreSQL chưa chạy | `systemctl start postgresql` |
| `EACCES uploads` | Thiếu quyền thư mục | `chmod 777 /opt/fastpush/server/uploads` |
| `node: command not found` (PM2) | Node chưa nâng lên 20 | Chạy lại Bước 3 |
