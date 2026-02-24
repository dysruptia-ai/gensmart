-- Up Migration
CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  file_path TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_export_org ON data_export_requests(organization_id);

-- Down Migration
DROP TABLE IF EXISTS data_export_requests CASCADE;
