-- Communication analytics — inbox vs outbox response patterns.
-- A view (not materialized for now; the underlying email_messages table
-- is small enough that on-demand is fine. Switch to MATERIALIZED + a
-- refresh trigger once we hit >50k messages).

CREATE OR REPLACE VIEW v_email_communication_metrics AS
WITH thread_metrics AS (
  SELECT
    t.id                                          AS thread_id,
    t.subject,
    t.client_id,
    t.project_id,
    t.assigned_profile_id,
    t.status,
    -- counts
    count(m.id) FILTER (WHERE m.direction = 'inbound')::int  AS inbound_count,
    count(m.id) FILTER (WHERE m.direction = 'outbound')::int AS outbound_count,
    -- first inbound and first outbound (after the first inbound)
    min(m.sent_at) FILTER (WHERE m.direction = 'inbound')  AS first_inbound_at,
    min(m.sent_at) FILTER (WHERE m.direction = 'outbound') AS first_outbound_at,
    -- response time: time from first inbound to first outbound (if any)
    EXTRACT(EPOCH FROM (
      min(m.sent_at) FILTER (WHERE m.direction = 'outbound')
      - min(m.sent_at) FILTER (WHERE m.direction = 'inbound')
    )) / 3600.0 AS hours_to_first_response,
    -- last seen
    max(m.sent_at) AS last_message_at,
    max(m.sent_at) FILTER (WHERE m.direction = 'inbound')  AS last_inbound_at,
    max(m.sent_at) FILTER (WHERE m.direction = 'outbound') AS last_outbound_at
  FROM email_threads t
  LEFT JOIN email_messages m ON m.thread_id = t.id
  GROUP BY t.id
)
SELECT
  tm.*,
  -- derived state for the dashboard
  CASE
    WHEN tm.inbound_count = 0 AND tm.outbound_count > 0 THEN 'we_initiated_pending'
    WHEN tm.outbound_count = 0 AND tm.inbound_count > 0 THEN 'awaiting_our_reply'
    WHEN tm.last_inbound_at > coalesce(tm.last_outbound_at, '1970-01-01'::timestamptz) THEN 'awaiting_our_reply'
    WHEN tm.last_outbound_at > coalesce(tm.last_inbound_at, '1970-01-01'::timestamptz) THEN 'awaiting_their_reply'
    ELSE 'idle'
  END AS reply_state,
  EXTRACT(EPOCH FROM (now() - tm.last_inbound_at)) / 3600.0  AS hours_since_last_inbound,
  EXTRACT(EPOCH FROM (now() - tm.last_outbound_at)) / 3600.0 AS hours_since_last_outbound
FROM thread_metrics tm;

GRANT SELECT ON v_email_communication_metrics TO authenticated;
COMMENT ON VIEW v_email_communication_metrics IS
  'Per-thread inbox↔outbox metrics: counts, response time, current reply state.';

-- Per-client roll-up — useful for /crm/clients/[id] activity tab + dashboards.

CREATE OR REPLACE VIEW v_client_communication_health AS
SELECT
  c.id  AS client_id,
  c.code,
  c.name_ar,
  c.name_en,
  count(DISTINCT vm.thread_id)::int AS thread_count,
  sum(vm.inbound_count)::int        AS total_inbound,
  sum(vm.outbound_count)::int       AS total_outbound,
  avg(vm.hours_to_first_response) FILTER (WHERE vm.hours_to_first_response IS NOT NULL)
    AS avg_response_hours,
  count(*) FILTER (WHERE vm.reply_state = 'awaiting_our_reply')::int  AS awaiting_our_reply,
  count(*) FILTER (WHERE vm.reply_state = 'awaiting_their_reply')::int AS awaiting_their_reply,
  max(vm.last_message_at) AS last_activity_at,
  -- health: very loose heuristic. Green if we always reply within 24h
  -- AND we're in step (no awaiting_our_reply > 48h). Red if there's an
  -- awaiting_our_reply older than 72h.
  CASE
    WHEN count(*) FILTER (WHERE vm.reply_state = 'awaiting_our_reply'
                            AND vm.hours_since_last_inbound > 72) > 0 THEN 'red'
    WHEN count(*) FILTER (WHERE vm.reply_state = 'awaiting_our_reply'
                            AND vm.hours_since_last_inbound > 24) > 0 THEN 'amber'
    WHEN coalesce(avg(vm.hours_to_first_response), 0) > 24 THEN 'amber'
    ELSE 'green'
  END AS health
FROM clients c
LEFT JOIN v_email_communication_metrics vm ON vm.client_id = c.id
WHERE c.archived_at IS NULL
GROUP BY c.id, c.code, c.name_ar, c.name_en;

GRANT SELECT ON v_client_communication_health TO authenticated;
COMMENT ON VIEW v_client_communication_health IS
  'Per-client communication health roll-up: response times, pending replies, traffic-light status.';
