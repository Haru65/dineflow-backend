-- Migration 006: Fix order status constraint to include 'draft' status
-- This fixes the issue where orders with 'draft' status cannot be created

-- Drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint with 'draft' included
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('draft', 'pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled'));