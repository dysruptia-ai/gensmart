-- Up Migration
-- Defense-in-depth deduplication for inbound MCP webhooks. The MCP also
-- dedups upstream, but we record every delivery_id we accept so a re-send
-- for the same UUID short-circuits before processing.
-- See docs/INTEGRATION.md §6, §10.3.
CREATE TABLE IF NOT EXISTS mcp_deliveries (
  delivery_id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  event VARCHAR(50) NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_deliveries_agent ON mcp_deliveries(agent_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_deliveries_received_at ON mcp_deliveries(received_at);

-- Down Migration
DROP TABLE IF EXISTS mcp_deliveries CASCADE;
