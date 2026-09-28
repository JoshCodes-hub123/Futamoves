-- lovable-cron-fallback-reviewed: offer expiry is purely time-based; ~20s server-side dispatch required
-- P0: signed-out visitors cannot call privileged functions; internal dispatch/notification helpers are server-only.
DO $$ DECLARE r record; BEGIN
FOR r IN select p.oid::regprocedure f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists (select 1 from pg_policies pol where pol.qual ilike '%'||p.proname||'(%' or pol.with_check ilike '%'||p.proname||'(%') LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.f);
END LOOP;
FOR r IN select p.oid::regprocedure f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('dispatch_tick','dispatch_trip','dispatch_escalate','dispatch_candidates','emit_notification','emit_admin_notifications','log_dispatch','log_trip_status','rider_dispatch_score','notify_cancelled_ride_request','notify_dispatch_attention_event','notify_rider_offer_expired','notify_rider_offer_received','notify_shared_group_formed','notify_shared_group_member_joined','notify_shared_group_ready','notify_trip_status_event','notify_verification_event','enforce_group_max_size','locations_deactivation_guard','ride_members_reset_confirmations','ride_requests_group_guard','ride_requests_location_guard','trips_after_change_dispatch','trips_cancel_stale_offers') LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.f);
END LOOP; END $$;
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'futamove-dispatch-tick';
SELECT cron.schedule('futamove-dispatch-tick', '20 seconds', $$SELECT public.dispatch_tick();$$);
