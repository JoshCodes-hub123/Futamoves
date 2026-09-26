ALTER TABLE public.notifications
  ADD COLUMN event_key text;

CREATE UNIQUE INDEX notifications_recipient_event_key_idx
  ON public.notifications (recipient_id, event_key)
  WHERE event_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.emit_notification(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_trip_id uuid,
  p_event_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_recipient_id IS NULL THEN
    RETURN;
  END IF;

  IF p_event_key IS NULL OR btrim(p_event_key) = '' THEN
    RAISE EXCEPTION 'Notification event_key is required';
  END IF;

  INSERT INTO public.notifications (recipient_id, notification_type, title, body, trip_id, event_key)
  VALUES (p_recipient_id, p_type, p_title, p_body, p_trip_id, p_event_key)
  ON CONFLICT (recipient_id, event_key) WHERE event_key IS NOT NULL DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.emit_admin_notifications(
  p_type text,
  p_title text,
  p_body text,
  p_trip_id uuid,
  p_event_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE admin_id uuid;
BEGIN
  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.emit_notification(admin_id, p_type, p_title, p_body, p_trip_id, p_event_key);
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_verification_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE account_label text;
BEGIN
  account_label := CASE WHEN NEW.account_type = 'lecturer' THEN 'lecturer' ELSE 'student' END;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    PERFORM public.emit_admin_notifications(
      'verification_submitted', 'New ' || account_label || ' verification',
      'A FUTA ' || account_label || ' verification is ready for review.', NULL,
      'verification-submitted:' || NEW.id::text
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'verified' THEN
      PERFORM public.emit_notification(
        NEW.student_id, 'verification_approved', 'Verification approved',
        'Your FUTA identity has been verified.', NULL,
        'verification-reviewed:' || NEW.id::text || ':verified'
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.emit_notification(
        NEW.student_id, 'verification_rejected', 'Verification needs attention',
        'Your FUTA identity submission needs to be reviewed again.', NULL,
        'verification-reviewed:' || NEW.id::text || ':rejected'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER notifications_verification_submitted
  AFTER INSERT ON public.verification_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_verification_event();
CREATE TRIGGER notifications_verification_reviewed
  AFTER UPDATE OF status ON public.verification_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_verification_event();

CREATE OR REPLACE FUNCTION public.notify_shared_group_formed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE member_id uuid;
BEGIN
  IF NEW.is_private THEN RETURN NULL; END IF;

  FOR member_id IN
    SELECT student_id FROM public.ride_group_members
    WHERE group_id = NEW.id GROUP BY student_id
  LOOP
    PERFORM public.emit_notification(
      member_id, 'shared_ride_matched', 'Shared ride matched',
      'Your request has been matched with other passengers.', NULL,
      'shared-group-formed:' || NEW.id::text
    );
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER notifications_shared_group_formed
  AFTER INSERT ON public.ride_groups
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.notify_shared_group_formed();

CREATE OR REPLACE FUNCTION public.notify_shared_group_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE group_is_private boolean; group_created_at timestamptz; member_id uuid;
BEGIN
  SELECT is_private, created_at INTO group_is_private, group_created_at
  FROM public.ride_groups WHERE id = NEW.group_id;
  IF NOT FOUND OR group_is_private OR NEW.joined_at <= group_created_at THEN RETURN NULL; END IF;

  FOR member_id IN
    SELECT student_id FROM public.ride_group_members
    WHERE group_id = NEW.group_id GROUP BY student_id
  LOOP
    PERFORM public.emit_notification(
      member_id, 'shared_group_member_joined', 'Passenger joined your group',
      CASE WHEN member_id = NEW.student_id
        THEN 'You joined a shared ride group.'
        ELSE 'Another passenger joined your shared ride group.'
      END,
      NULL,
      'shared-group-member-joined:' || NEW.id::text
    );
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER notifications_shared_group_member_joined
  AFTER INSERT ON public.ride_group_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_shared_group_member_joined();

CREATE OR REPLACE FUNCTION public.notify_shared_group_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE member_id uuid;
BEGIN
  IF NEW.is_private THEN RETURN NULL; END IF;

  FOR member_id IN
    SELECT student_id FROM public.ride_group_members
    WHERE group_id = NEW.id GROUP BY student_id
  LOOP
    PERFORM public.emit_notification(
      member_id, 'shared_group_ready', 'Meeting point agreed',
      'Everyone has agreed on the meeting point. Your group is ready.', NULL,
      'shared-group-ready:' || NEW.id::text || ':' || NEW.updated_at::text
    );
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER notifications_shared_group_ready
  AFTER UPDATE OF status ON public.ride_groups
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ready')
  EXECUTE FUNCTION public.notify_shared_group_ready();

CREATE OR REPLACE FUNCTION public.notify_trip_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE trip_group_id uuid; trip_rider_id uuid; recipient_id uuid;
  notification_type text; notification_title text; notification_body text; notification_key text;
BEGIN
  SELECT group_id, rider_id INTO trip_group_id, trip_rider_id
  FROM public.trips WHERE id = NEW.trip_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  notification_key := 'trip-status:' || NEW.id::text;
  CASE NEW.to_status
    WHEN 'assigned' THEN
      notification_type := 'ride_rider_assigned';
      notification_title := 'Rider assigned';
      notification_body := 'A rider has been assigned to your ride.';
    WHEN 'accepted' THEN
      notification_type := 'ride_rider_accepted';
      notification_title := 'Rider accepted';
      notification_body := 'A rider accepted and is assigned to your ride.';
    WHEN 'arriving' THEN
      notification_type := 'ride_rider_on_the_way';
      notification_title := 'Rider on the way';
      notification_body := 'Your rider is heading to the meeting point.';
    WHEN 'picked_up' THEN
      notification_type := 'ride_pickup_arrived';
      notification_title := 'Rider reached pickup';
      notification_body := 'Your rider has arrived at the meeting point. Confirm pickup when you board.';
    WHEN 'in_progress' THEN
      notification_type := 'ride_started';
      notification_title := 'Ride started';
      notification_body := 'Your ride has started.';
    WHEN 'completed' THEN
      IF NEW.actor_role = 'admin' THEN
        notification_type := 'ride_completed_by_admin';
        notification_title := 'Ride completed';
        notification_body := 'FUTAMOVE support marked your ride complete.';
      ELSE
        notification_type := 'ride_completed';
        notification_title := 'Ride completed';
        notification_body := 'Your ride has been marked complete.';
      END IF;
    WHEN 'cancelled_by_student', 'cancelled_by_rider', 'cancelled_by_admin' THEN
      notification_type := 'ride_cancelled';
      notification_title := 'Ride cancelled';
      notification_body := 'Your ride was cancelled.';
      notification_key := 'ride-cancelled:' || NEW.trip_id::text;
    WHEN 'expired' THEN
      notification_type := 'ride_expired';
      notification_title := 'Ride expired';
      notification_body := 'Your ride expired before it could be completed.';
    WHEN 'no_show' THEN
      notification_type := 'ride_no_show';
      notification_title := 'Ride marked no-show';
      notification_body := 'This ride was marked as a no-show.';
    ELSE
      RETURN NEW;
  END CASE;

  FOR recipient_id IN
    SELECT student_id FROM public.ride_group_members WHERE group_id = trip_group_id
    UNION SELECT trip_rider_id WHERE trip_rider_id IS NOT NULL
  LOOP
    IF NEW.to_status = 'accepted' AND NEW.from_status = 'confirmed' THEN
      PERFORM public.emit_notification(
        recipient_id, 'ride_rider_assigned', 'Rider assigned',
        'A rider has been assigned to your ride.', NEW.trip_id,
        notification_key || ':assigned'
      );
      PERFORM public.emit_notification(
        recipient_id, notification_type, notification_title,
        notification_body, NEW.trip_id, notification_key || ':accepted'
      );
    ELSE
      PERFORM public.emit_notification(
        recipient_id, notification_type, notification_title,
        notification_body, NEW.trip_id, notification_key
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER notifications_trip_status_event
  AFTER INSERT ON public.trip_status_history
  FOR EACH ROW EXECUTE FUNCTION public.notify_trip_status_event();

-- Cancellation notifications intentionally remain tied to the ride-request cancellation path.
-- The current schema does not provide a single, authoritative per-row cancellation signal that is
-- both safe to derive from trip history and consistent with the existing ride lifecycle rules without
-- changing the lifecycle behavior itself. This preserves established cancellation semantics and avoids
-- inventing a new state machine in this migration.
CREATE OR REPLACE FUNCTION public.notify_cancelled_ride_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE ride public.trips; group_member_count integer; recipient_id uuid;
BEGIN
  IF OLD.group_id IS NULL OR NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN RETURN NEW; END IF;
  SELECT * INTO ride FROM public.trips WHERE group_id = OLD.group_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT count(*) INTO group_member_count
  FROM public.ride_group_members WHERE group_id = OLD.group_id;
  IF NOT public.trip_is_terminal(ride.status)
     AND (group_member_count > 2 OR ride.status IN ('arriving', 'picked_up', 'in_progress')) THEN
    RETURN NEW;
  END IF;

  FOR recipient_id IN
    SELECT student_id FROM public.ride_group_members WHERE group_id = OLD.group_id
    UNION SELECT ride.rider_id WHERE ride.rider_id IS NOT NULL
  LOOP
    PERFORM public.emit_notification(
      recipient_id, 'ride_cancelled', 'Ride cancelled', 'Your ride was cancelled.',
      ride.id, 'ride-cancelled:' || ride.id::text
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER notifications_cancelled_ride_request
  BEFORE UPDATE OF status ON public.ride_requests
  FOR EACH ROW
  WHEN (OLD.group_id IS NOT NULL AND NEW.status = 'cancelled')
  EXECUTE FUNCTION public.notify_cancelled_ride_request();

CREATE OR REPLACE FUNCTION public.notify_rider_offer_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.emit_notification(
    NEW.rider_id, 'dispatch_offer_received', 'New ride offer',
    'A ride offer is waiting for your response.', NEW.trip_id,
    'ride-offer:' || NEW.id::text || ':received'
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER notifications_rider_offer_received
  AFTER INSERT ON public.ride_offers
  FOR EACH ROW
  WHEN (NEW.response = 'pending')
  EXECUTE FUNCTION public.notify_rider_offer_received();

CREATE OR REPLACE FUNCTION public.notify_rider_offer_expired()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.emit_notification(
    NEW.rider_id, 'dispatch_offer_expired', 'Ride offer expired',
    'The time to respond to this ride offer has passed.', NEW.trip_id,
    'ride-offer:' || NEW.id::text || ':expired'
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER notifications_rider_offer_expired
  AFTER UPDATE OF response ON public.ride_offers
  FOR EACH ROW
  WHEN (OLD.response = 'pending' AND NEW.response = 'timed_out')
  EXECUTE FUNCTION public.notify_rider_offer_expired();

CREATE OR REPLACE FUNCTION public.notify_dispatch_attention_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE trip_group_id uuid; passenger_id uuid;
BEGIN
  CASE NEW.event_type
    WHEN 'OFFER_TIMED_OUT' THEN
      PERFORM public.emit_admin_notifications(
        'dispatch_offer_expired', 'Ride offer expired',
        'A rider did not respond before the offer deadline.', NEW.trip_id,
        'dispatch-event:' || NEW.id::text
      );
    WHEN 'OFFER_DECLINED' THEN
      PERFORM public.emit_admin_notifications(
        'dispatch_offer_declined', 'Ride offer declined',
        'A rider declined an offer. Dispatch is continuing.', NEW.trip_id,
        'dispatch-event:' || NEW.id::text
      );
    WHEN 'DISPATCH_ESCALATED' THEN
      PERFORM public.emit_admin_notifications(
        'dispatch_escalated', 'Ride needs admin attention',
        'Dispatch could not assign a rider automatically.', NEW.trip_id,
        'dispatch-event:' || NEW.id::text
      );
    WHEN 'RIDER_LATE_REPORTED' THEN
      PERFORM public.emit_admin_notifications(
        'passenger_reported_rider_late', 'Passenger reported a late rider',
        'A passenger reported that their rider has not arrived.', NEW.trip_id,
        'dispatch-event:' || NEW.id::text
      );

      IF NEW.rider_id IS NOT NULL THEN
        PERFORM public.emit_notification(
          NEW.rider_id, 'dispatch_rider_late_reported', 'Rider marked late',
          'A passenger reported that the assigned rider has not arrived yet.', NEW.trip_id,
          'dispatch-event:' || NEW.id::text || ':rider'
        );
      END IF;

      SELECT group_id INTO trip_group_id FROM public.trips WHERE id = NEW.trip_id;
      IF trip_group_id IS NOT NULL THEN
        FOR passenger_id IN
          SELECT student_id FROM public.ride_group_members WHERE group_id = trip_group_id
        LOOP
          PERFORM public.emit_notification(
            passenger_id, 'ride_rider_late', 'Assigned rider is late',
            'Your rider has not arrived at the meeting point yet.', NEW.trip_id,
            'dispatch-event:' || NEW.id::text || ':passenger:' || passenger_id::text
          );
        END LOOP;
      END IF;
    WHEN 'PASSENGER_NO_SHOW' THEN
      PERFORM public.emit_admin_notifications(
        'rider_reported_passenger_no_show', 'Ride marked passenger no-show',
        'A rider reported that passengers did not arrive.', NEW.trip_id,
        'dispatch-event:' || NEW.id::text
      );

      SELECT group_id INTO trip_group_id FROM public.trips WHERE id = NEW.trip_id;
      IF trip_group_id IS NOT NULL THEN
        FOR passenger_id IN
          SELECT student_id FROM public.ride_group_members WHERE group_id = trip_group_id
        LOOP
          PERFORM public.emit_notification(
            passenger_id, 'ride_passenger_no_show', 'Passenger no-show reported',
            'A rider reported that the trip did not proceed as expected.', NEW.trip_id,
            'dispatch-event:' || NEW.id::text || ':passenger:' || passenger_id::text
          );
        END LOOP;
      END IF;
  END CASE;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER notifications_dispatch_attention_event
  AFTER INSERT ON public.dispatch_events
  FOR EACH ROW
  WHEN (NEW.event_type IN ('OFFER_TIMED_OUT', 'OFFER_DECLINED', 'DISPATCH_ESCALATED', 'RIDER_LATE_REPORTED', 'PASSENGER_NO_SHOW'))
  EXECUTE FUNCTION public.notify_dispatch_attention_event();

REVOKE ALL ON FUNCTION public.emit_notification(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.emit_admin_notifications(text, text, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_verification_event() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_shared_group_formed() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_shared_group_member_joined() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_shared_group_ready() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_trip_status_event() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_cancelled_ride_request() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_rider_offer_received() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_rider_offer_expired() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_dispatch_attention_event() FROM PUBLIC, anon, authenticated, service_role;
