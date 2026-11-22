-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "LetterheadType" AS ENUM ('MAIN', 'MISC');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable Quotation
ALTER TABLE "Quotation"
    ADD COLUMN IF NOT EXISTS "letterheadType" "LetterheadType" NOT NULL DEFAULT 'MAIN';

-- AlterTable company_settings
ALTER TABLE "company_settings"
    ADD COLUMN IF NOT EXISTS "miscCompanyName" TEXT,
    ADD COLUMN IF NOT EXISTS "miscSubtitle" TEXT,
    ADD COLUMN IF NOT EXISTS "miscLogoDataUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "miscPhone" TEXT,
    ADD COLUMN IF NOT EXISTS "miscSecondaryPhone" TEXT,
    ADD COLUMN IF NOT EXISTS "miscEmail" TEXT,
    ADD COLUMN IF NOT EXISTS "miscWebsite" TEXT,
    ADD COLUMN IF NOT EXISTS "miscAddress" TEXT,
    ADD COLUMN IF NOT EXISTS "miscNationalId" TEXT,
    ADD COLUMN IF NOT EXISTS "miscEconomicCode" TEXT,
    ADD COLUMN IF NOT EXISTS "miscRegistrationNo" TEXT,
    ADD COLUMN IF NOT EXISTS "miscBankInfo" TEXT;
