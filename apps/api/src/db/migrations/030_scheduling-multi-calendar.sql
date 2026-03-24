-- Up Migration
-- Multi-calendar support for scheduling tools.
-- No schema changes needed — the multi-calendar mapping lives in agent_tools.config (JSONB)
-- as calendar_ids: string[]. The existing calendars and appointments tables are unchanged.

-- Down Migration
-- No-op
