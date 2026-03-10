-- Migration 007: Add website column to payment_providers table
-- This is needed for Paytm configuration (WEBSTAGING vs DEFAULT)

-- Add website column to payment_providers table
ALTER TABLE payment_providers ADD COLUMN IF NOT EXISTS website TEXT;