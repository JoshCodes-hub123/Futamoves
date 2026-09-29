-- Phase 8: manual pricing, locked fares, rider wallet ledger, manual funding. Money is integer kobo.

CREATE TABLE public.financial_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  service_charge_bps integer NOT NULL DEFAULT 500 CHECK (service_charge_bps BETWEEN 0 AND 5000),
  funding_instructions text NOT NULL DEFAULT '',
  min_funding_kobo bigint NOT NULL DEFAULT 10000 CHECK (min_funding_kobo >= 100),
  max_funding_kobo bigint NOT NULL DEFAULT 50000000 CHECK (max_funding_kobo >= min_funding_kobo),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.financial_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.financial_settings TO authenticated;
GRANT ALL ON public.financial_settings TO service_role;
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read financial settings" ON public.financial_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.fare_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_location_id uuid NOT NULL REFERENCES public.locations(id),
  destination_location_id uuid NOT NULL REFERENCES public.locations(id),
  ride_type text NOT NULL CHECK (ride_type IN ('shared','private')),
  -- shared: NULL party_size = per-passenger price; 1-4 = explicit total for that many passengers. private: always NULL (flat per ride).
  party_size integer CHECK (party_size BETWEEN 1 AND 4),
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CHECK (origin_location_id <> destination_location_id),
  CHECK (ride_type = 'shared' OR party_size IS NULL)
);
CREATE UNIQUE INDEX fare_rules_one_active ON public.fare_rules (origin_location_id, destination_location_id, ride_type, coalesce(party_size, 0)) WHERE active;
CREATE INDEX fare_rules_lookup ON public.fare_rules (origin_location_id, destination_location_id, ride_type) WHERE active;
GRANT SELECT ON public.fare_rules TO authenticated;
GRANT ALL ON public.fare_rules TO service_role;
ALTER TABLE public.fare_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read fare rules" ON public.fare_rules FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.fare_rule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fare_rule_id uuid NOT NULL REFERENCES public.fare_rules(id),
  action text NOT NULL,
  previous_amount_kobo bigint,
  new_amount_kobo bigint NOT NULL,
  previous_active boolean,
  new_active boolean NOT NULL,
  origin_location_id uuid NOT NULL,
  destination_location_id uuid NOT NULL,
  ride_type text NOT NULL,
  party_size integer,
  reason text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fare_rule_history_rule ON public.fare_rule_history (fare_rule_id, created_at DESC);
GRANT SELECT ON public.fare_rule_history TO authenticated;
GRANT ALL ON public.fare_rule_history TO service_role;
ALTER TABLE public.fare_rule_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read fare history" ON public.fare_rule_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.fare_rules_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.amount_kobo = NEW.amount_kobo AND OLD.active = NEW.active THEN RETURN NEW; END IF;
  INSERT INTO public.fare_rule_history (fare_rule_id, action, previous_amount_kobo, new_amount_kobo, previous_active, new_active,
    origin_location_id, destination_location_id, ride_type, party_size, reason, changed_by)
  VALUES (NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'created' WHEN OLD.active <> NEW.active THEN CASE WHEN NEW.active THEN 'enabled' ELSE 'disabled' END ELSE 'price_changed' END,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.amount_kobo END, NEW.amount_kobo, CASE WHEN TG_OP = 'UPDATE' THEN OLD.active END, NEW.active,
    NEW.origin_location_id, NEW.destination_location_id, NEW.ride_type, NEW.party_size,
    nullif(current_setting('futamove.fare_reason', true), ''), auth.uid());
  RETURN NEW;
END; $$;
CREATE TRIGGER fare_rules_audit AFTER INSERT OR UPDATE ON public.fare_rules FOR EACH ROW EXECUTE FUNCTION public.fare_rules_audit();
CREATE TRIGGER fare_rules_updated_at BEFORE UPDATE ON public.fare_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Locked fare on each trip (passenger fare only; FUTAMOVE's charge lives separately)
ALTER TABLE public.trips
  ADD COLUMN fare_kobo bigint,
  ADD COLUMN fare_per_passenger_kobo bigint,
  ADD COLUMN fare_rule_id uuid REFERENCES public.fare_rules(id),
  ADD COLUMN fare_ride_type text,
  ADD COLUMN fare_locked_at timestamptz;

CREATE OR REPLACE FUNCTION public.compute_fare(p_origin uuid, p_dest uuid, p_ride_type text, p_party integer)
RETURNS TABLE (fare_kobo bigint, per_passenger_kobo bigint, rule_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.fare_rules;
BEGIN
  IF p_origin IS NULL OR p_dest IS NULL OR p_party IS NULL OR p_party < 1 OR p_party > public.ride_capacity() THEN RETURN; END IF;
  IF p_ride_type = 'private' THEN
    SELECT * INTO r FROM public.fare_rules f WHERE f.active AND f.origin_location_id = p_origin AND f.destination_location_id = p_dest AND f.ride_type = 'private';
    IF FOUND THEN fare_kobo := r.amount_kobo; per_passenger_kobo := NULL; rule_id := r.id; RETURN NEXT; END IF;
    RETURN;
  END IF;
  SELECT * INTO r FROM public.fare_rules f WHERE f.active AND f.origin_location_id = p_origin AND f.destination_location_id = p_dest AND f.ride_type = 'shared' AND f.party_size = p_party;
  IF FOUND THEN fare_kobo := r.amount_kobo; per_passenger_kobo := round(r.amount_kobo::numeric / p_party)::bigint; rule_id := r.id; RETURN NEXT; RETURN; END IF;
  SELECT * INTO r FROM public.fare_rules f WHERE f.active AND f.origin_location_id = p_origin AND f.destination_location_id = p_dest AND f.ride_type = 'shared' AND f.party_size IS NULL;
  IF FOUND THEN fare_kobo := r.amount_kobo * p_party; per_passenger_kobo := r.amount_kobo; rule_id := r.id; RETURN NEXT; END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.compute_fare(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- Student-facing quote before confirming (passenger fare only)
CREATE OR REPLACE FUNCTION public.quote_fare(p_origin uuid, p_dest uuid, p_ride_type text, p_party integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO q FROM public.compute_fare(p_origin, p_dest, p_ride_type, p_party);
  IF NOT FOUND THEN RETURN jsonb_build_object('available', false); END IF;
  RETURN jsonb_build_object('available', true, 'fare_kobo', q.fare_kobo, 'per_passenger_kobo', q.per_passenger_kobo);
END; $$;
REVOKE EXECUTE ON FUNCTION public.quote_fare(uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_fare(uuid, uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.trips_lock_fare() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE priv boolean; q record;
BEGIN
  SELECT is_private INTO priv FROM public.ride_groups WHERE id = NEW.group_id;
  NEW.fare_ride_type := CASE WHEN coalesce(priv, false) THEN 'private' ELSE 'shared' END;
  SELECT * INTO q FROM public.compute_fare(NEW.meeting_point_location_id, NEW.destination_location_id, NEW.fare_ride_type, NEW.passenger_count);
  IF FOUND THEN NEW.fare_kobo := q.fare_kobo; NEW.fare_per_passenger_kobo := q.per_passenger_kobo; NEW.fare_rule_id := q.rule_id; NEW.fare_locked_at := now();
  ELSE NEW.fare_kobo := NULL; NEW.fare_per_passenger_kobo := NULL; NEW.fare_rule_id := NULL; NEW.fare_locked_at := NULL; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trips_lock_fare BEFORE INSERT ON public.trips FOR EACH ROW EXECUTE FUNCTION public.trips_lock_fare();

CREATE OR REPLACE FUNCTION public.trips_fare_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.fare_kobo IS DISTINCT FROM OLD.fare_kobo OR NEW.fare_per_passenger_kobo IS DISTINCT FROM OLD.fare_per_passenger_kobo
     OR NEW.fare_rule_id IS DISTINCT FROM OLD.fare_rule_id OR NEW.fare_locked_at IS DISTINCT FROM OLD.fare_locked_at OR NEW.fare_ride_type IS DISTINCT FROM OLD.fare_ride_type THEN
    RAISE EXCEPTION 'A ride''s fare is locked once confirmed';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trips_fare_immutable BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.trips_fare_immutable();

-- Rider wallet: protected aggregate kept in step with the ledger inside the same transaction.
CREATE TABLE public.rider_wallets (
  rider_id uuid PRIMARY KEY,
  balance_kobo bigint NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
  reserved_kobo bigint NOT NULL DEFAULT 0 CHECK (reserved_kobo >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reserved_kobo <= balance_kobo)
);
GRANT SELECT ON public.rider_wallets TO authenticated;
GRANT ALL ON public.rider_wallets TO service_role;
ALTER TABLE public.rider_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders read own wallet" ON public.rider_wallets FOR SELECT TO authenticated USING (rider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wallet_funding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  method text NOT NULL DEFAULT 'manual_transfer',
  provider_reference text,
  payer_reference text,
  paid_at date,
  receipt_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'rejected' OR coalesce(btrim(rejection_reason), '') <> '')
);
CREATE INDEX wallet_funding_rider ON public.wallet_funding_requests (rider_id, created_at DESC);
CREATE INDEX wallet_funding_status ON public.wallet_funding_requests (status, created_at DESC);
GRANT SELECT ON public.wallet_funding_requests TO authenticated;
GRANT ALL ON public.wallet_funding_requests TO service_role;
ALTER TABLE public.wallet_funding_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders read own funding" ON public.wallet_funding_requests FOR SELECT TO authenticated USING (rider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('FUNDING_PENDING','FUNDING_APPROVED','FUNDING_REJECTED','SERVICE_CHARGE_RESERVED','SERVICE_CHARGE_RELEASED','SERVICE_CHARGE','SERVICE_CHARGE_REVERSAL','ADMIN_CREDIT','ADMIN_DEBIT')),
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 0),
  balance_impact_kobo bigint NOT NULL,
  balance_after_kobo bigint NOT NULL,
  reserved_after_kobo bigint NOT NULL,
  description text NOT NULL,
  trip_id uuid REFERENCES public.trips(id),
  funding_request_id uuid REFERENCES public.wallet_funding_requests(id),
  created_by uuid,
  created_by_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_tx_rider ON public.wallet_transactions (rider_id, created_at DESC);
CREATE UNIQUE INDEX wallet_tx_one_funding_credit ON public.wallet_transactions (funding_request_id) WHERE type = 'FUNDING_APPROVED';
CREATE UNIQUE INDEX wallet_tx_one_charge ON public.wallet_transactions (trip_id, rider_id) WHERE type = 'SERVICE_CHARGE';
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders read own transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (rider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.wallet_tx_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Wallet transactions cannot be changed or deleted'; END; $$;
CREATE TRIGGER wallet_tx_immutable BEFORE UPDATE OR DELETE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.wallet_tx_immutable();

-- FUTAMOVE's charge per trip, frozen when a rider accepts
CREATE TABLE public.trip_service_charges (
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  rider_id uuid NOT NULL,
  fare_kobo bigint NOT NULL,
  service_charge_bps integer NOT NULL,
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 0),
  status text NOT NULL CHECK (status IN ('reserved','charged','released','reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, rider_id, created_at)
);
CREATE INDEX trip_charges_trip ON public.trip_service_charges (trip_id) WHERE status = 'reserved';
CREATE INDEX trip_charges_rider ON public.trip_service_charges (rider_id, created_at DESC);
GRANT SELECT ON public.trip_service_charges TO authenticated;
GRANT ALL ON public.trip_service_charges TO service_role;
ALTER TABLE public.trip_service_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders read own charges" ON public.trip_service_charges FOR SELECT TO authenticated USING (rider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Internal ledger writer: locks the wallet row, updates the aggregate and appends one ledger row.
CREATE OR REPLACE FUNCTION public.wallet_post(p_rider uuid, p_type text, p_amount bigint, p_balance_delta bigint, p_reserved_delta bigint,
  p_description text, p_trip uuid, p_funding uuid, p_actor uuid, p_actor_role text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.rider_wallets;
BEGIN
  INSERT INTO public.rider_wallets (rider_id) VALUES (p_rider) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM public.rider_wallets WHERE rider_id = p_rider FOR UPDATE;
  IF w.balance_kobo + p_balance_delta < 0 THEN RAISE EXCEPTION 'This would make the wallet balance negative'; END IF;
  IF w.reserved_kobo + p_reserved_delta < 0 THEN RAISE EXCEPTION 'Wallet reservation mismatch'; END IF;
  IF w.reserved_kobo + p_reserved_delta > w.balance_kobo + p_balance_delta THEN
    RAISE EXCEPTION 'Insufficient FUTAMOVE wallet balance. Please fund your wallet before accepting this ride.'; END IF;
  UPDATE public.rider_wallets SET balance_kobo = balance_kobo + p_balance_delta, reserved_kobo = reserved_kobo + p_reserved_delta, updated_at = now()
  WHERE rider_id = p_rider RETURNING * INTO w;
  INSERT INTO public.wallet_transactions (rider_id, type, amount_kobo, balance_impact_kobo, balance_after_kobo, reserved_after_kobo, description, trip_id, funding_request_id, created_by, created_by_role)
  VALUES (p_rider, p_type, p_amount, p_balance_delta, w.balance_kobo, w.reserved_kobo, p_description, p_trip, p_funding, p_actor, p_actor_role);
  RETURN w.balance_kobo - w.reserved_kobo;
END; $$;
REVOKE EXECUTE ON FUNCTION public.wallet_post(uuid, text, bigint, bigint, bigint, text, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.service_charge_for(p_fare bigint) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_fare IS NULL THEN 0 ELSE round(p_fare::numeric * s.service_charge_bps / 10000)::bigint END FROM public.financial_settings s WHERE s.id;
$$;
REVOKE EXECUTE ON FUNCTION public.service_charge_for(bigint) FROM PUBLIC, anon, authenticated;

-- Single chokepoint for every acceptance path (offer, claim, assignment answer, passenger pick, admin reassignment).
CREATE OR REPLACE FUNCTION public.trips_service_charge() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.trip_service_charges; amt bigint; bps integer;
BEGIN
  SELECT * INTO c FROM public.trip_service_charges WHERE trip_id = NEW.id AND status = 'reserved' LIMIT 1;
  IF FOUND THEN
    IF NEW.status = 'completed' AND NEW.rider_id = c.rider_id THEN
      PERFORM public.wallet_post(c.rider_id, 'SERVICE_CHARGE_RELEASED', c.amount_kobo, 0, -c.amount_kobo, 'Reservation converted to ride service charge', NEW.id, NULL, NULL, 'system');
      PERFORM public.wallet_post(c.rider_id, 'SERVICE_CHARGE', c.amount_kobo, -c.amount_kobo, 0,
        'FUTAMOVE service charge (' || trim(to_char(c.service_charge_bps / 100.0, 'FM990.99')) || '% of ₦' || to_char(c.fare_kobo / 100.0, 'FM999,999,990.00') || ' fare)', NEW.id, NULL, NULL, 'system');
      UPDATE public.trip_service_charges SET status = 'charged', updated_at = now() WHERE trip_id = c.trip_id AND rider_id = c.rider_id AND created_at = c.created_at;
    ELSIF NEW.rider_id IS DISTINCT FROM c.rider_id OR NEW.status IN ('confirmed','assigned','cancelled_by_student','cancelled_by_rider','cancelled_by_admin','expired','no_show') THEN
      PERFORM public.wallet_post(c.rider_id, 'SERVICE_CHARGE_RELEASED', c.amount_kobo, 0, -c.amount_kobo, 'Ride did not go ahead with you — reserved charge released', NEW.id, NULL, NULL, 'system');
      UPDATE public.trip_service_charges SET status = 'released', updated_at = now() WHERE trip_id = c.trip_id AND rider_id = c.rider_id AND created_at = c.created_at;
    END IF;
  END IF;
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' AND NEW.rider_id IS NOT NULL AND coalesce(NEW.fare_kobo, 0) > 0
     AND NOT EXISTS (SELECT 1 FROM public.trip_service_charges WHERE trip_id = NEW.id AND rider_id = NEW.rider_id AND status IN ('reserved','charged')) THEN
    SELECT service_charge_bps INTO bps FROM public.financial_settings WHERE id;
    amt := public.service_charge_for(NEW.fare_kobo);
    IF amt > 0 THEN
      PERFORM public.wallet_post(NEW.rider_id, 'SERVICE_CHARGE_RESERVED', amt, 0, amt, 'Service charge reserved for accepted ride', NEW.id, NULL, NEW.rider_id, 'system');
      INSERT INTO public.trip_service_charges (trip_id, rider_id, fare_kobo, service_charge_bps, amount_kobo, status) VALUES (NEW.id, NEW.rider_id, NEW.fare_kobo, bps, amt, 'reserved');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trips_service_charge AFTER UPDATE OF status, rider_id ON public.trips FOR EACH ROW EXECUTE FUNCTION public.trips_service_charge();

-- ---------- rider functions ----------
CREATE OR REPLACE FUNCTION public.rider_wallet_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.rider_wallets; s public.financial_settings;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'rider') THEN RAISE EXCEPTION 'Riders only'; END IF;
  SELECT * INTO w FROM public.rider_wallets WHERE rider_id = uid;
  SELECT * INTO s FROM public.financial_settings WHERE id;
  RETURN jsonb_build_object(
    'balance_kobo', coalesce(w.balance_kobo, 0), 'reserved_kobo', coalesce(w.reserved_kobo, 0),
    'available_kobo', coalesce(w.balance_kobo, 0) - coalesce(w.reserved_kobo, 0),
    'pending_funding_kobo', (SELECT coalesce(sum(amount_kobo), 0) FROM public.wallet_funding_requests WHERE rider_id = uid AND status = 'pending'),
    'service_charge_bps', s.service_charge_bps, 'min_funding_kobo', s.min_funding_kobo, 'max_funding_kobo', s.max_funding_kobo,
    'funding_instructions', s.funding_instructions);
END; $$;
REVOKE EXECUTE ON FUNCTION public.rider_wallet_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_wallet_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.rider_submit_funding(p_amount_kobo bigint, p_receipt_path text, p_reference text, p_paid_at date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s public.financial_settings; rid uuid;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'rider') THEN RAISE EXCEPTION 'Riders only'; END IF;
  SELECT * INTO s FROM public.financial_settings WHERE id;
  IF p_amount_kobo IS NULL OR p_amount_kobo < s.min_funding_kobo OR p_amount_kobo > s.max_funding_kobo OR p_amount_kobo % 100 <> 0 THEN
    RAISE EXCEPTION 'Enter a whole-naira amount between ₦% and ₦%', to_char(s.min_funding_kobo / 100, 'FM999,999,990'), to_char(s.max_funding_kobo / 100, 'FM999,999,990'); END IF;
  IF p_receipt_path IS NULL OR split_part(p_receipt_path, '/', 1) <> uid::text OR p_receipt_path !~* '\.(jpe?g|png|webp|pdf)$' THEN RAISE EXCEPTION 'Upload your payment receipt first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'wallet-receipts' AND name = p_receipt_path) THEN RAISE EXCEPTION 'Upload your payment receipt first'; END IF;
  IF p_paid_at IS NOT NULL AND p_paid_at > current_date + 1 THEN RAISE EXCEPTION 'The payment date cannot be in the future'; END IF;
  IF (SELECT count(*) FROM public.wallet_funding_requests WHERE rider_id = uid AND status = 'pending') >= 5 THEN RAISE EXCEPTION 'You already have 5 funding requests waiting. Wait for FUTAMOVE to review them.'; END IF;
  INSERT INTO public.wallet_funding_requests (rider_id, amount_kobo, receipt_path, payer_reference, paid_at)
  VALUES (uid, p_amount_kobo, p_receipt_path, nullif(left(btrim(coalesce(p_reference, '')), 120), ''), p_paid_at) RETURNING id INTO rid;
  PERFORM public.wallet_post(uid, 'FUNDING_PENDING', p_amount_kobo, 0, 0, 'Wallet funding submitted — awaiting admin confirmation', NULL, rid, uid, 'rider');
  RETURN rid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rider_submit_funding(bigint, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_submit_funding(bigint, text, text, date) TO authenticated;

-- Fare + charge preview for rides the rider can currently see (offers, claimable, assigned to them)
CREATE OR REPLACE FUNCTION public.rider_charge_preview(p_trip_ids uuid[]) RETURNS TABLE (trip_id uuid, fare_kobo bigint, charge_kobo bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'rider') THEN RAISE EXCEPTION 'Riders only'; END IF;
  RETURN QUERY SELECT t.id, t.fare_kobo,
    coalesce((SELECT c.amount_kobo FROM public.trip_service_charges c WHERE c.trip_id = t.id AND c.rider_id = uid AND c.status IN ('reserved','charged') LIMIT 1), public.service_charge_for(t.fare_kobo))
  FROM public.trips t WHERE t.id = ANY(p_trip_ids)
    AND (t.rider_id = uid OR (t.status = 'confirmed' AND t.rider_id IS NULL) OR EXISTS (SELECT 1 FROM public.ride_offers o WHERE o.trip_id = t.id AND o.rider_id = uid));
END; $$;
REVOKE EXECUTE ON FUNCTION public.rider_charge_preview(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_charge_preview(uuid[]) TO authenticated;

-- ---------- admin functions ----------
CREATE OR REPLACE FUNCTION public.admin_save_fare_rule(p_id uuid, p_origin uuid, p_dest uuid, p_ride_type text, p_party integer, p_amount_kobo bigint, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrators only'; END IF;
  IF p_amount_kobo IS NULL OR p_amount_kobo < 0 OR p_amount_kobo % 100 <> 0 THEN RAISE EXCEPTION 'Enter a whole-naira fare of ₦0 or more'; END IF;
  PERFORM set_config('futamove.fare_reason', coalesce(btrim(p_reason), ''), true);
  IF p_id IS NOT NULL THEN
    UPDATE public.fare_rules SET amount_kobo = p_amount_kobo, updated_by = auth.uid() WHERE id = p_id RETURNING id INTO rid;
    IF rid IS NULL THEN RAISE EXCEPTION 'Fare not found'; END IF;
    RETURN rid;
  END IF;
  IF p_origin IS NULL OR p_dest IS NULL THEN RAISE EXCEPTION 'Choose a pickup and a destination'; END IF;
  IF p_origin = p_dest THEN RAISE EXCEPTION 'Pickup and destination must be different'; END IF;
  IF p_ride_type NOT IN ('shared','private') THEN RAISE EXCEPTION 'Choose Shared or Private Keke'; END IF;
  IF p_ride_type = 'private' AND p_party IS NOT NULL THEN RAISE EXCEPTION 'Private Keke has one price per ride'; END IF;
  IF p_party IS NOT NULL AND (p_party < 1 OR p_party > public.ride_capacity()) THEN RAISE EXCEPTION 'Party size must be between 1 and %', public.ride_capacity(); END IF;
  IF EXISTS (SELECT 1 FROM public.fare_rules WHERE active AND origin_location_id = p_origin AND destination_location_id = p_dest AND ride_type = p_ride_type AND coalesce(party_size, 0) = coalesce(p_party, 0)) THEN
    RAISE EXCEPTION 'An active fare already exists for this route, ride type and party size. Edit that one instead.'; END IF;
  INSERT INTO public.fare_rules (origin_location_id, destination_location_id, ride_type, party_size, amount_kobo, updated_by)
  VALUES (p_origin, p_dest, p_ride_type, p_party, p_amount_kobo, auth.uid()) RETURNING id INTO rid;
  RETURN rid;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_fare_rule_active(p_id uuid, p_active boolean, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.fare_rules;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrators only'; END IF;
  SELECT * INTO r FROM public.fare_rules WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fare not found'; END IF;
  IF p_active AND EXISTS (SELECT 1 FROM public.fare_rules WHERE active AND id <> r.id AND origin_location_id = r.origin_location_id AND destination_location_id = r.destination_location_id AND ride_type = r.ride_type AND coalesce(party_size, 0) = coalesce(r.party_size, 0)) THEN
    RAISE EXCEPTION 'Another active fare already covers this route. Disable it first.'; END IF;
  PERFORM set_config('futamove.fare_reason', coalesce(btrim(p_reason), ''), true);
  UPDATE public.fare_rules SET active = p_active, updated_by = auth.uid() WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_financial_settings(p_service_charge_bps integer, p_funding_instructions text, p_min_funding_kobo bigint, p_max_funding_kobo bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrators only'; END IF;
  IF p_service_charge_bps IS NULL OR p_service_charge_bps < 0 OR p_service_charge_bps > 5000 THEN RAISE EXCEPTION 'Service charge must be between 0 and 50 percent'; END IF;
  IF p_min_funding_kobo < 100 OR p_max_funding_kobo < p_min_funding_kobo THEN RAISE EXCEPTION 'Check the minimum and maximum funding amounts'; END IF;
  UPDATE public.financial_settings SET service_charge_bps = p_service_charge_bps, funding_instructions = left(coalesce(p_funding_instructions, ''), 2000),
    min_funding_kobo = p_min_funding_kobo, max_funding_kobo = p_max_funding_kobo, updated_at = now(), updated_by = auth.uid() WHERE id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_funding(p_id uuid, p_approve boolean, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.wallet_funding_requests; uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'Administrators only'; END IF;
  SELECT * INTO f FROM public.wallet_funding_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funding request not found'; END IF;
  IF f.status <> 'pending' THEN RAISE EXCEPTION 'This funding request has already been %', f.status; END IF;
  IF p_approve THEN
    UPDATE public.wallet_funding_requests SET status = 'approved', reviewed_by = uid, reviewed_at = now() WHERE id = f.id;
    PERFORM public.wallet_post(f.rider_id, 'FUNDING_APPROVED', f.amount_kobo, f.amount_kobo, 0, 'Wallet funding approved', NULL, f.id, uid, 'admin');
    PERFORM public.emit_notification(f.rider_id, 'wallet_funding_approved', 'Wallet funded', 'Your wallet funding of ₦' || to_char(f.amount_kobo / 100.0, 'FM999,999,990') || ' was approved.', NULL, 'wallet_funding_approved:' || f.id);
  ELSE
    IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'Give a reason for rejecting this funding request'; END IF;
    UPDATE public.wallet_funding_requests SET status = 'rejected', rejection_reason = btrim(p_reason), reviewed_by = uid, reviewed_at = now() WHERE id = f.id;
    PERFORM public.wallet_post(f.rider_id, 'FUNDING_REJECTED', f.amount_kobo, 0, 0, 'Wallet funding rejected: ' || btrim(p_reason), NULL, f.id, uid, 'admin');
    PERFORM public.emit_notification(f.rider_id, 'wallet_funding_rejected', 'Wallet funding rejected', btrim(p_reason), NULL, 'wallet_funding_rejected:' || f.id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_wallet_adjust(p_rider uuid, p_amount_kobo bigint, p_credit boolean, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrators only'; END IF;
  IF NOT public.has_role(p_rider, 'rider') AND NOT EXISTS (SELECT 1 FROM public.rider_wallets WHERE rider_id = p_rider) THEN RAISE EXCEPTION 'Rider not found'; END IF;
  IF p_amount_kobo IS NULL OR p_amount_kobo <= 0 OR p_amount_kobo % 100 <> 0 THEN RAISE EXCEPTION 'Enter a whole-naira amount above ₦0'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required for every wallet adjustment'; END IF;
  PERFORM public.wallet_post(p_rider, CASE WHEN p_credit THEN 'ADMIN_CREDIT' ELSE 'ADMIN_DEBIT' END, p_amount_kobo,
    CASE WHEN p_credit THEN p_amount_kobo ELSE -p_amount_kobo END, 0,
    CASE WHEN p_credit THEN 'Admin credit: ' ELSE 'Admin debit: ' END || btrim(p_reason), NULL, NULL, auth.uid(), 'admin');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reverse_service_charge(p_trip_id uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.trip_service_charges;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrators only'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO c FROM public.trip_service_charges WHERE trip_id = p_trip_id AND status = 'charged' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No posted service charge on this ride'; END IF;
  PERFORM public.wallet_post(c.rider_id, 'SERVICE_CHARGE_REVERSAL', c.amount_kobo, c.amount_kobo, 0, 'Service charge reversed: ' || btrim(p_reason), p_trip_id, NULL, auth.uid(), 'admin');
  UPDATE public.trip_service_charges SET status = 'reversed', updated_at = now() WHERE trip_id = c.trip_id AND rider_id = c.rider_id AND created_at = c.created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_rider_wallets() RETURNS TABLE (rider_id uuid, full_name text, balance_kobo bigint, reserved_kobo bigint, pending_kobo bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrators only'; END IF;
  RETURN QUERY SELECT a.user_id, a.full_name, coalesce(w.balance_kobo, 0::bigint), coalesce(w.reserved_kobo, 0::bigint),
    (SELECT coalesce(sum(f.amount_kobo), 0)::bigint FROM public.wallet_funding_requests f WHERE f.rider_id = a.user_id AND f.status = 'pending')
  FROM public.rider_applications a LEFT JOIN public.rider_wallets w ON w.rider_id = a.user_id
  WHERE a.status IN ('approved','suspended') ORDER BY a.full_name;
END; $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['admin_save_fare_rule(uuid,uuid,uuid,text,integer,bigint,text)','admin_set_fare_rule_active(uuid,boolean,text)',
    'admin_update_financial_settings(integer,text,bigint,bigint)','admin_review_funding(uuid,boolean,text)','admin_wallet_adjust(uuid,bigint,boolean,text)',
    'admin_reverse_service_charge(uuid,text)','admin_rider_wallets()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['fare_rules_audit()','trips_lock_fare()','trips_fare_immutable()','trips_service_charge()','wallet_tx_immutable()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- Private receipts bucket

CREATE POLICY "Riders upload own receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wallet-receipts' AND (storage.foldername(name))[1] = auth.uid()::text AND public.has_role(auth.uid(), 'rider'));
CREATE POLICY "Riders read own receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'wallet-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins read receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'wallet-receipts' AND public.has_role(auth.uid(), 'admin'));

-- Follow-up (applied same day): surrogate id on trip_service_charges so a rider can withdraw and re-take a ride.
ALTER TABLE public.trip_service_charges ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.trip_service_charges DROP CONSTRAINT trip_service_charges_pkey;
ALTER TABLE public.trip_service_charges ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX trip_charges_one_open ON public.trip_service_charges (trip_id) WHERE status = 'reserved';
-- trips_service_charge() and admin_reverse_service_charge() redefined to update rows by id (see live definitions).
