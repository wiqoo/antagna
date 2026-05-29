-- Phase 0 — data reset (Mohammed's explicit request: remove ALL smoke/test
-- data; keep ONLY the 2 real users + equipment + reference/config data).
--
-- KEEP: equipment* / kits / skills / positions / permissions /
--       position_default_permissions / departments / work_calendar_defaults /
--       system_settings / alert_rules / kpi_definitions / inbound_email_routes /
--       notification_event_types / email_templates / locations / geo_fences /
--       project_templates / stage_task_templates / tags / custom_field_definitions /
--       cron_heartbeat + the 2 real profiles (Mohammed, Claude QA) and their
--       user_skills / overrides.
-- WIPE: every content/transactional table + all other (smoke) profiles.
--
-- All wiped data is dummy. Equipment has NO profile FK (no created_by column)
-- so it is fully isolated. Tripwire: equipment stays 172.

BEGIN;

-- 1. Clear smoke join/override rows in KEEP tables (so deleting smoke profiles
--    later doesn't FK-violate). Keep the 2 real users' rows.
DELETE FROM user_skills              WHERE profile_id NOT IN
  (SELECT id FROM profiles WHERE email IN ('mohammedelghareib@gmail.com','claude.qa@antagna.me'));
DELETE FROM user_permission_overrides WHERE profile_id NOT IN
  (SELECT id FROM profiles WHERE email IN ('mohammedelghareib@gmail.com','claude.qa@antagna.me'));
DELETE FROM user_position_overrides   WHERE profile_id NOT IN
  (SELECT id FROM profiles WHERE email IN ('mohammedelghareib@gmail.com','claude.qa@antagna.me'));

-- 2. Null profile FK landmines in KEEP tables / self-refs.
UPDATE departments SET head_profile_id = NULL WHERE head_profile_id NOT IN
  (SELECT id FROM profiles WHERE email IN ('mohammedelghareib@gmail.com','claude.qa@antagna.me'));
UPDATE profiles SET acting_for_id = NULL, reports_to_id = NULL;

-- 3. Wipe all content/transactional tables. TRUNCATE … CASCADE handles FK order
--    (none of the KEEP tables reference these, so cascade cannot reach reference
--    data; profiles is preserved and wiped selectively in step 4).
TRUNCATE TABLE
  activity_events, agency_brand_links, ai_action_log, ai_memory_chunks,
  ai_suggestions, ai_usage, ai_user_limits, alert_fires, attachments,
  attendance_records, audit_log, briefs, client_assignments,
  client_health_snapshots, clients, compatibility_feedback, contact_methods,
  contacts, content_posts, conversation_summaries, custom_field_values,
  daily_briefs, daily_tasks, decision_outcomes, deliverable_groups, deliverables,
  email_attachments, email_drafts, email_extractions, email_messages,
  email_threads, equipment_activity_log, equipment_repairs,
  equipment_reservations, external_links, freelancer_availability, freelancers,
  gmail_watch, google_integrations, integration_log, internal_approvals,
  invoice_line_items, invoices, kit_suggestions, kpi_snapshots, leads,
  managed_accounts, meeting_notes, notification_subscriptions, notifications,
  oauth_tokens, payments, post_analytics_snapshots, project_assignments,
  project_comments, project_contacts, project_insights, project_learnings,
  project_pins, project_recurrence_rules, project_share_views,
  project_squad_assignments, project_stages_log, project_tasks, projects,
  quote_line_items, quotes, revision_items, revision_rounds, sponsored_deals,
  squad_members, squads, state_transition_overrides, tag_assignments, talents,
  template_edit_patterns, whatsapp_messages, employees, migration_runs,
  legacy_client_import, legacy_equipment_import, legacy_project_import
CASCADE;

-- 4. Delete all smoke profiles (content FKs to them are gone after step 3).
DELETE FROM profiles
WHERE email NOT IN ('mohammedelghareib@gmail.com','claude.qa@antagna.me');

COMMIT;
