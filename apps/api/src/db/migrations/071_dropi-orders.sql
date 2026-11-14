-- Up Migration
-- Orders created by the Dropi sales toolkit (services/dropi-sales). One row per create_order
-- attempt that may have reached Dropi; the row id is sent as shop_order_id.
-- Buyer name, address and document are NOT stored here (they live in Dropi); only the last 10
-- phone digits, to let a WhatsApp buyer track their own orders.
CREATE TABLE IF NOT EXISTS dropi_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  -- NULL for orders created from the agent preview (no conversations row) or after the
  -- conversation is deleted: the order still exists in Dropi.
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- NULL while the outcome of create_order is unknown (network error / timeout).
  external_order_id VARCHAR(32),
  status_local VARCHAR(20) NOT NULL DEFAULT 'desconocido'
    CHECK (status_local IN ('creada', 'desconocido')),
  status_cached VARCHAR(40),
  total NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  -- [{producto_id, opcion_id, nombre, opcion, cantidad, precio_unitario}]
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  city_name VARCHAR(120),
  buyer_phone_last10 VARCHAR(10),
  carrier_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dropi_orders_agent_contact ON dropi_orders (agent_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_dropi_orders_agent_phone ON dropi_orders (agent_id, buyer_phone_last10);
CREATE INDEX IF NOT EXISTS idx_dropi_orders_org ON dropi_orders (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dropi_orders_agent_external
  ON dropi_orders (agent_id, external_order_id) WHERE external_order_id IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS uq_dropi_orders_agent_external;
DROP INDEX IF EXISTS idx_dropi_orders_org;
DROP INDEX IF EXISTS idx_dropi_orders_agent_phone;
DROP INDEX IF EXISTS idx_dropi_orders_agent_contact;
DROP TABLE IF EXISTS dropi_orders;
