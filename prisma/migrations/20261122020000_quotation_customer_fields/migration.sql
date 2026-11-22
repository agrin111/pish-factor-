-- Add optional buyer snapshot fields to Quotation
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "customerNationalId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "customerEconomicCode" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "customerCity" TEXT;
