-- Up Migration

-- Associate orphan contacts (agent_id IS NULL) with their agent
-- by looking up the most recent conversation for each contact.
UPDATE contacts c
SET agent_id = conv.agent_id,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (contact_id) contact_id, agent_id
  FROM conversations
  WHERE contact_id IS NOT NULL
    AND agent_id IS NOT NULL
  ORDER BY contact_id, created_at DESC
) conv
WHERE c.id = conv.contact_id
  AND c.agent_id IS NULL;

-- Down Migration

-- Cannot reliably revert — agent_id was NULL by mistake, no original value to restore.
-- This migration is intentionally a no-op on rollback.
