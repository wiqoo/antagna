-- 067 — disable the equipment charging/battery alerts (owner request, phase-1)
--
-- The team isn't tracking equipment charging yet, so the battery alerts were
-- noise. Disable the three charging-related rules; the alert-scanner skips
-- inactive rules so this takes effect immediately. Re-enable later by setting
-- active = true (or via the admin alerts UI). The repair alert is left active
-- (it's maintenance, not charging).

UPDATE public.alert_rules
SET active = false
WHERE key IN ('battery_stale_30d', 'battery_never_charged', 'equipment_battery_low');
