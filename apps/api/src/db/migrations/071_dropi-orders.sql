-- Up Migration
-- Orders created by the Dropi sales toolkit (services/dropi-sales). One row per create_order
-- attempt that may have reached Dropi; the row id is sent as shop_order_id.
-- Buyer name, address and document are NOT stored here (they live in Dropi); only the last 10
-- digits of the phone given for the delivery and, on WhatsApp, of the sender (Meta) number.
CREATE TABLE IF NOT EXISTS dropi_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- SET NULL: real orders (above all 'desconocido' ones under manual review) outlive the agent
  -- and stay tied to the organization. Rows with a NULL agent are never returned to a buyer.
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  -- NULL for orders created from the agent preview (no conversations row) or after the
  -- conversation is deleted: the order still exists in Dropi.
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- Preview orders: the preview session that created them (ownership in the preview).
  preview_session_id VARCHAR(64),
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
  -- Phone given by the buyer for the delivery (not an identity: anyone can type any phone).
  buyer_phone_last10 VARCHAR(10),
  -- WhatsApp only: last 10 digits of conversations.channel_metadata.wa_from (the sender number
  -- from Meta's signed webhook) of the conversation that created the order. NULL elsewhere.
  owner_wa_last10 VARCHAR(10),
  carrier_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent alignment when an earlier draft of this table exists locally.
ALTER TABLE dropi_orders ADD COLUMN IF NOT EXISTS preview_session_id VARCHAR(64);
ALTER TABLE dropi_orders ADD COLUMN IF NOT EXISTS owner_wa_last10 VARCHAR(10);
ALTER TABLE dropi_orders ALTER COLUMN agent_id DROP NOT NULL;
ALTER TABLE dropi_orders DROP CONSTRAINT IF EXISTS dropi_orders_agent_id_fkey;
ALTER TABLE dropi_orders
  ADD CONSTRAINT dropi_orders_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dropi_orders_agent_contact ON dropi_orders (agent_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_dropi_orders_agent_phone ON dropi_orders (agent_id, buyer_phone_last10);
CREATE INDEX IF NOT EXISTS idx_dropi_orders_agent_owner_wa ON dropi_orders (agent_id, owner_wa_last10);
CREATE INDEX IF NOT EXISTS idx_dropi_orders_agent_conversation ON dropi_orders (agent_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_dropi_orders_org ON dropi_orders (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dropi_orders_agent_external
  ON dropi_orders (agent_id, external_order_id) WHERE external_order_id IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS uq_dropi_orders_agent_external;
DROP INDEX IF EXISTS idx_dropi_orders_org;
DROP INDEX IF EXISTS idx_dropi_orders_agent_conversation;
DROP INDEX IF EXISTS idx_dropi_orders_agent_owner_wa;
DROP INDEX IF EXISTS idx_dropi_orders_agent_phone;
DROP INDEX IF EXISTS idx_dropi_orders_agent_contact;
DROP TABLE IF EXISTS dropi_orders;
