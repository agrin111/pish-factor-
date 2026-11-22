-- Add optional SMTP email delivery fields to company_settings
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "smtpHost" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "smtpPort" INTEGER DEFAULT 587;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "smtpSecure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "smtpUser" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "smtpPass" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "smtpFrom" TEXT;
