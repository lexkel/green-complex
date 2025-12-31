-- Migration: Add miss direction, course name, hole number, and recorded timestamp to putts table
-- Date: 2025-12-31

-- Add new columns to putts table
ALTER TABLE putts
ADD COLUMN IF NOT EXISTS miss_direction TEXT CHECK (miss_direction IN ('short', 'long', 'left', 'right')),
ADD COLUMN IF NOT EXISTS course_name TEXT,
ADD COLUMN IF NOT EXISTS hole_number INTEGER CHECK (hole_number >= 1 AND hole_number <= 18),
ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ;

-- Add helpful comments to explain the columns
COMMENT ON COLUMN putts.miss_direction IS 'Direction of missed putt: short, long, left, or right';
COMMENT ON COLUMN putts.course_name IS 'Human-readable course name for easier querying in Supabase dashboard';
COMMENT ON COLUMN putts.hole_number IS 'Hole number (1-18) for easier querying in Supabase dashboard';
COMMENT ON COLUMN putts.recorded_at IS 'Timestamp when the putt was recorded (preserves sequence within a round)';

-- Create index on recorded_at for efficient ordering by time
CREATE INDEX IF NOT EXISTS idx_putts_recorded_at ON putts(recorded_at);

-- Create index on course_name and hole_number for filtering
CREATE INDEX IF NOT EXISTS idx_putts_course_hole ON putts(course_name, hole_number);

-- Backfill recorded_at from created_at for existing records
UPDATE putts
SET recorded_at = created_at
WHERE recorded_at IS NULL;
