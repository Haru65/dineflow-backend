-- Migration 004: Add notes column to order_items
-- Allow admin to add special instructions/notes to individual dishes

ALTER TABLE order_items ADD COLUMN notes TEXT;

-- Create index for faster queries
CREATE INDEX idx_order_items_notes ON order_items(order_id, notes) WHERE notes IS NOT NULL;
