# راهنمای پشتیبان‌گیری و بازیابی

اطلاعات این سامانه در PostgreSQL نگهداری می‌شود. پشتیبان‌ها باید **خارج از همان سرور و فضای دیتابیس** نگهداری شوند.

## ۱. پشتیبان سریع دیتابیس

```bash
# پشتیبان فشرده از داخل کانتینر دیتابیس
docker exec pishfactor-db pg_dump -U pishfactor -Fc pishfactor > pishfactor-$(date +%F).dump
```

بازیابی:

```bash
# هشدار: بازیابی روی داده‌های موجود، آن‌ها را جایگزین می‌کند
docker compose stop app
docker exec -i pishfactor-db pg_restore -U pishfactor -d pishfactor --clean --if-exists < pishfactor-1385-01-01.dump
docker compose start app
```

## ۲. پشتیبان JSON از داخل نرم‌افزار

مدیر سیستم می‌تواند از مسیر **تنظیمات شرکت → دانلود نسخه پشتیبان JSON** یک فایل کامل شامل تنظیمات، کاربران (بدون رمز)، کالاها، مشتریان، پیش‌فاکتورها، ردیف‌ها و تاریخچه وضعیت دریافت کند.

این خروجی برای **بازبینی و انتقال داده** مناسب است، اما برای بازیابی کامل دیتابیس از `pg_dump` استفاده کنید.

## ۳. پشتیبان‌گیری خودکار (cron)

```bash
sudo mkdir -p /var/backups/pishfactor
sudo tee /etc/cron.d/pishfactor-backup >/dev/null <<'EOF'
30 2 * * * root docker exec pishfactor-db pg_dump -U pishfactor -Fc pishfactor > /var/backups/pishfactor/pishfactor-$(date +\%F).dump
EOF
```

نگهداری فقط ۱۴ نسخه آخر:

```bash
sudo tee /etc/cron.d/pishfactor-cleanup >/dev/null <<'EOF'
0 3 * * * root ls -1t /var/backups/pishfactor/*.dump | tail -n +15 | xargs -r rm --
EOF
```

## ۴. انتقال به فضای جداگانه

پشتیبان‌ها را روی همان سرور نگه ندارید. یکی از روش‌ها:

```bash
rclone copy /var/backups/pishfactor/ remote:pishfactor-backup/ --include "*.dump"
```

یا انتقال رمزنگاری‌شده:

```bash
gpg --symmetric --cipher-algo AES256 pishfactor-2026-11-19.dump
scp pishfactor-2026-11-19.dump.gpg backup@another-host:/backups/
```

## ۵. آزمون دوره‌ای بازیابی

حداقل ماهی یک‌بار بازیابی را روی یک سرور آزمایشی انجام دهید:

```bash
docker run --rm -d --name pg-restore-test \
  -e POSTGRES_PASSWORD=test -p 5544:5432 postgres:16-alpine
docker exec -i pg-restore-test pg_restore -U postgres -d postgres --create < pishfactor-2026-11-19.dump
```

سپس با اتصال به دیتابیس آزمایشی، تعداد پیش‌فاکتورها و مبالغ را با سامانه اصلی مقایسه کنید.

## ۶. نکات امنیتی

- فایل `.env` (شامل رمز دیتابیس و کلید نشست) را همراه پشتیبان در جای امن نگه دارید.
- پشتیبان‌ها را رمزنگاری کنید؛ فایل `pg_dump` حاوی اطلاعات مشتریان است.
- لوگوی شرکت در دیتابیس ذخیره می‌شود و در پشتیبان دیتابیس قرار دارد.
- دسترسی پوشه پشتیبان را محدود کنید: `chmod 700 /var/backups/pishfactor`
