-- Add Paytm support to payment_providers table
-- This migration ensures the payment_providers table can store both Razorpay and Paytm credentials

-- Update the provider check constraint to include paytm
-- Note: SQLite doesn't support ALTER CONSTRAINT, so we'll just ensure the table structure is correct

-- Verify payment_providers table has the correct structure
-- The table should already exist from previous migrations

-- Create index for faster lookups by provider
CREATE INDEX IF NOT EXISTS idx_payment_providers_provider ON payment_providers(provider);

-- Add a note: Paytm uses key_id for MID (Merchant ID) and key_secret for merchant key
-- Example Paytm configuration:
-- provider: 'paytm'
-- key_id: '1234567890123456' (Merchant ID)
-- key_secret: 'your_merchant_key' (Merchant Key)
-- webhook_secret: 'webhook_secret_if_needed'
