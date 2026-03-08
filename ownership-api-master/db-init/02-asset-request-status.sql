-- Add status tracking to asset_request (safe to run on existing DBs).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'asset_request' AND column_name = 'status') THEN
    ALTER TABLE asset_request ADD COLUMN status VARCHAR(20) DEFAULT 'PENDING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'asset_request' AND column_name = 'assigned_asset_id') THEN
    ALTER TABLE asset_request ADD COLUMN assigned_asset_id VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'asset_request' AND column_name = 'resolved_at') THEN
    ALTER TABLE asset_request ADD COLUMN resolved_at TIMESTAMP;
  END IF;
END $$;
