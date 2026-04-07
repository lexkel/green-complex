-- Migration: Add putt annotation fields (read, break, slope)
-- Date: 2026-04-07

ALTER TABLE putts
ADD COLUMN IF NOT EXISTS putt_read TEXT CHECK (putt_read IN ('over', 'good', 'under')),
ADD COLUMN IF NOT EXISTS putt_break TEXT CHECK (putt_break IN ('right-to-left', 'straight', 'left-to-right')),
ADD COLUMN IF NOT EXISTS putt_slope TEXT CHECK (putt_slope IN ('uphill', 'flat', 'downhill'));

COMMENT ON COLUMN putts.putt_read IS 'Whether the green was over-read, well-read, or under-read';
COMMENT ON COLUMN putts.putt_break IS 'Break direction of the putt: right-to-left, straight, or left-to-right';
COMMENT ON COLUMN putts.putt_slope IS 'Slope of the putt: uphill, flat, or downhill';
