# راهنمای نصب روی سرور (VPS)

این سند مراحل استقرار سامانه **Aghrin PishFactor** روی یک سرور لینوکسی (Ubuntu/Debian) را به‌صورت گام‌به‌گام توضیح می‌دهد.

## پیش‌نیازها

- سرور Ubuntu 22.04 یا 24.04 با حداقل ۲ گیگابایت RAM و ۱۰ گیگابایت فضای آزاد
- دسترسی SSH و کاربر با مجوز `sudo`
- Docker Engine 24+ و Docker Compose v2
- دامنه یا زیردامنه‌ای که به IP سرور اشاره کند (برای HTTPS)

نصب Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# پس از خروج و ورود مجدد:
docker --version && docker compose version
```

## ۱. دریافت کد

```bash
sudo mkdir -p /opt/pishfactor
sudo chown $USER:$USER /opt/pishfactor
git clone <repository-url> /opt/pishfactor
cd /opt/pishfactor
```

## ۲. تنظیم متغیرهای محیطی

```bash
cp .env.example .env
openssl rand -hex 32   # مقدار SESSION_SECRET
nano .env
```

حداقل مقادیر لازم:

| متغیر | توضیح |
| --- | --- |
| `POSTGRES_USER` | نام کاربری دیتابیس |
| `POSTGRES_PASSWORD` | رمز دیتابیس (قوی و تصادفی) |
| `POSTGRES_DB` | نام دیتابیس (`pishfactor`) |
| `SESSION_SECRET` | کلید امضای نشست، حداقل ۳۲ کاراکتر تصادفی |
| `SEED_ADMIN_USERNAME` | نام کاربری مدیر اولیه |
| `SEED_ADMIN_PASSWORD` | رمز مدیر اولیه (حداقل ۸ کاراکتر) |
| `APP_URL` | آدرس عمومی سامانه، مانند `https://pishfactor.example.com` |
| `APP_PORT` | پورت میزبان (پیش‌فرض ۳۰۰۰) |

> فایل `.env` هرگز نباید در Git قرار گیرد. دسترسی آن را محدود کنید:
> `chmod 600 .env`

## ۳. اجرا

```bash
docker compose up -d --build
docker compose logs -f migrate   # اجرای Migration و ساخت مدیر اولیه
docker compose logs -f app
```

فضای خالی برای سرویس‌ها:

- `db`: PostgreSQL 16 با volume پایدار `pishfactor_pgdata` — پورت آن به بیرون باز نیست
- `migrate`: یک‌بار `prisma migrate deploy` و seed را اجرا می‌کند
- `app`: برنامه Next.js روی پورت `APP_PORT`

بررسی سلامت:

```bash
curl -I http://127.0.0.1:3000/login
```

## ۴. ساخت مدیر سیستم (در صورت نیاز)

مدیر اولیه توسط seed ساخته می‌شود. برای ساخت یا بازنشانی مدیر از خط فرمان:

```bash
docker compose run --rm migrate npx tsx scripts/create-admin.ts admin 'Ramz-e-Ghavi-1405' 'مدیر سیستم'
```

## ۵. Nginx و HTTPS

نمونه تنظیمات Nginx (`/etc/nginx/sites-available/pishfactor`):

```nginx
server {
    listen 80;
    server_name pishfactor.example.com;

    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pishfactor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pishfactor.example.com
```

پس از فعال‌سازی HTTPS، مقدار `APP_URL` را به آدرس `https://` تغییر دهید و سرویس را دوباره راه‌اندازی کنید:

```bash
docker compose up -d app
```

> در محیط HTTPS، کوکی نشست به‌صورت `Secure` ارسال می‌شود (چون `NODE_ENV=production` است).

## ۶. به‌روزرسانی نسخه

```bash
cd /opt/pishfactor
git pull
docker compose up -d --build
docker compose logs -f migrate
```

## ۷. پشتیبان‌گیری خودکار (پیشنهادی)

فایل `/etc/cron.d/pishfactor-backup`:

```cron
0 2 * * * root docker exec pishfactor-db pg_dump -U pishfactor -Fc pishfactor > /var/backups/pishfactor/pishfactor-$(date +\%F).dump
```

و برای انتقال به فضای خارج از سرور، از `rclone` یا `scp` به یک مقصد جداگانه استفاده کنید.
جزئیات بیشتر در [BACKUP.md](./BACKUP.md).

## ۸. مشکلات رایج

| نشانه | بررسی |
| --- | --- |
| صفحه ورود باز نمی‌شود | `docker compose ps` و `docker compose logs app` |
| خطای اتصال دیتابیس | `docker compose logs db` و صحت `POSTGRES_PASSWORD` |
| فراموشی رمز مدیر | اجرای دستور بخش ۴ |
| PDF با فونت نادرست | وجود پوشه `assets/fonts` در تصویر و `docker compose logs app` |
