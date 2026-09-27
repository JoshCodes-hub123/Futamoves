-- Match nearby FUTA locations by coordinates before falling back to exact IDs/text.
CREATE OR REPLACE FUNCTION public.places_compatible(
  a_id text, a_text text, a_lat double precision, a_lng double precision,
  b_id text, b_text text, b_lat double precision, b_lng double precision,
  radius_m double precision
)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE
    WHEN a_lat IS NOT NULL AND a_lng IS NOT NULL
      AND b_lat IS NOT NULL AND b_lng IS NOT NULL
      THEN public.geo_distance_m(a_lat, a_lng, b_lat, b_lng) <= radius_m
    WHEN a_id IS NOT NULL AND b_id IS NOT NULL
      THEN a_id = b_id
    ELSE length(public.normalize_place(a_text)) > 0
      AND public.normalize_place(a_text) = public.normalize_place(b_text)
      AND public.normalize_place(a_text) <> 'my current location'
  END
$function$;
