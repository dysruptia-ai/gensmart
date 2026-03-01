-- Up Migration

-- Enable Row Level Security on multi-tenant tables
-- The app always filters by organization_id in queries.
-- RLS is defense-in-depth. When using a dedicated DB user per org (future),
-- set app.current_org_id with: SET LOCAL app.current_org_id = '<uuid>';

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Bypass RLS for the app superuser role (the connection pool user)
-- This allows the app to manage data across all orgs as needed
-- while RLS still applies if a restricted role is ever used.
ALTER TABLE agents FORCE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE calendars FORCE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_files FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

-- Org isolation policies using current_setting (set by the application)
-- These policies apply when app.current_org_id is set

CREATE POLICY org_isolation_agents ON agents
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

CREATE POLICY org_isolation_conversations ON conversations
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

CREATE POLICY org_isolation_contacts ON contacts
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

CREATE POLICY org_isolation_calendars ON calendars
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

CREATE POLICY org_isolation_appointments ON appointments
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

CREATE POLICY org_isolation_knowledge_files ON knowledge_files
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
    )
  );

CREATE POLICY org_isolation_knowledge_chunks ON knowledge_chunks
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
    )
  );

CREATE POLICY org_isolation_notifications ON notifications
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Down Migration
DROP POLICY IF EXISTS org_isolation_agents ON agents;
DROP POLICY IF EXISTS org_isolation_conversations ON conversations;
DROP POLICY IF EXISTS org_isolation_contacts ON contacts;
DROP POLICY IF EXISTS org_isolation_calendars ON calendars;
DROP POLICY IF EXISTS org_isolation_appointments ON appointments;
DROP POLICY IF EXISTS org_isolation_knowledge_files ON knowledge_files;
DROP POLICY IF EXISTS org_isolation_knowledge_chunks ON knowledge_chunks;
DROP POLICY IF EXISTS org_isolation_notifications ON notifications;

ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendars DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
