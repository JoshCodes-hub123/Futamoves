-- Rider approval/restore no longer require a verified student profile (owner decision).
CREATE OR REPLACE FUNCTION public.review_rider_application(p_application_id uuid, p_action text, p_reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE app public.rider_applications; reviewer uuid := auth.uid();
BEGIN
  IF reviewer IS NULL OR NOT public.has_role(reviewer, 'admin') THEN RAISE EXCEPTION 'Administrators only'; END IF;
  SELECT * INTO app FROM public.rider_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF p_action = 'approve' THEN
    IF app.status <> 'pending' THEN RAISE EXCEPTION 'Only pending applications can be approved'; END IF;
    UPDATE public.rider_applications SET status = 'approved', rejection_reason = NULL, reviewed_by = reviewer, reviewed_at = now() WHERE id = app.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (app.user_id, 'rider') ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF p_action = 'reject' THEN
    IF app.status <> 'pending' THEN RAISE EXCEPTION 'Only pending applications can be rejected'; END IF;
    IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
    UPDATE public.rider_applications SET status = 'rejected', rejection_reason = left(btrim(p_reason), 500), reviewed_by = reviewer, reviewed_at = now() WHERE id = app.id;
  ELSIF p_action = 'suspend' THEN
    IF app.status <> 'approved' THEN RAISE EXCEPTION 'Only approved riders can be suspended'; END IF;
    UPDATE public.rider_applications SET status = 'suspended', rejection_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), ''), reviewed_by = reviewer, reviewed_at = now() WHERE id = app.id;
    DELETE FROM public.user_roles WHERE user_id = app.user_id AND role = 'rider';
  ELSIF p_action = 'restore' THEN
    IF app.status <> 'suspended' THEN RAISE EXCEPTION 'Only suspended riders can be restored'; END IF;
    UPDATE public.rider_applications SET status = 'approved', rejection_reason = NULL, reviewed_by = reviewer, reviewed_at = now() WHERE id = app.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (app.user_id, 'rider') ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.review_rider_application(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_rider_application(uuid, text, text) TO authenticated, service_role;
