-- Up Migration
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Down Migration
-- (extensions are shared, don't drop them)
