ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS tax_invoice_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS payment_method    VARCHAR(20) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS business_purpose  TEXT,
  ADD COLUMN IF NOT EXISTS vat_class         VARCHAR(30) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS vat_reason        TEXT,
  ADD COLUMN IF NOT EXISTS deductibility     VARCHAR(30) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS tax_review_status VARCHAR(20) NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS tax_review_reason TEXT,
  ADD COLUMN IF NOT EXISTS ocr_quality       VARCHAR(10) NOT NULL DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS ocr_failure_mode  TEXT,
  ADD COLUMN IF NOT EXISTS tax_period        VARCHAR(7);

UPDATE expenses SET tax_review_status = 'blocked'
WHERE (amount IS NULL OR date IS NULL OR merchant IS NULL OR merchant = '')
  AND tax_review_status = 'needs_review';

CREATE INDEX IF NOT EXISTS idx_expenses_tax_period        ON expenses(project_id, tax_period);
CREATE INDEX IF NOT EXISTS idx_expenses_tax_review_status ON expenses(project_id, tax_review_status);
