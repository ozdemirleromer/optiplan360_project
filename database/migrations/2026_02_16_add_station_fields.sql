-- Migration: Add station tracking fields
-- Date: 2026-02-16
-- Description: Adds active status, scan tracking, and status fields to stations table

-- Add new columns to stations table
ALTER TABLE stations ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS scan_count_today INTEGER DEFAULT 0;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS istasyon_durumu VARCHAR(50) DEFAULT 'Hazır';

-- Update existing records to have default values
UPDATE stations SET active = TRUE WHERE active IS NULL;
UPDATE stations SET scan_count_today = 0 WHERE scan_count_today IS NULL;
UPDATE stations SET istasyon_durumu = 'Hazır' WHERE istasyon_durumu IS NULL;

-- Create index for active stations lookup (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_stations_active ON stations(active);
CREATE INDEX IF NOT EXISTS idx_stations_last_scan ON stations(last_scan_at);

-- Verify changes
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'stations'
ORDER BY ordinal_position;
