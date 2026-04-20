-- 003_add_subscribers.sql
-- Waiting list for multi-user enrollment notifications.

SET search_path = alice, public;

CREATE TABLE IF NOT EXISTS tb_subscribers (
    subscriber_id   SERIAL PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    source          TEXT,                       -- page they signed up from (e.g. 'collaborate', 'vision')
    dttm_created_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tb_subscribers IS
'PURPOSE: Enrollment waiting list for multi-user launch.
USE CASE: Collect emails from /collaborate and /vision pages.
MUTABILITY: Append-only.
FOOTER: dttm_created_utc only (no modified, single-write).';
