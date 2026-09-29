import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MapPin, Navigation } from "lucide-react";
import { EmptyState } from "@/components/futamove/primitives";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_TRIP_STATUSES, studentTripLabel, type Trip, type TripStatus } from "@/services/trips";
import { TripRiderCard } from "@/features/trip-rider-card";
import { JourneyTracker } from "@/components/futamove/journey-tracker";
import { Button } from "@/components/ui/button";

/** Loads the student's real active trip (RLS: group members only). */
async function getMyActiveTrip(): Promise<{ trip: Trip; requestId: string | null } | null> {
  const { data, error } = await supabase.from("trips").select("*").in("status", ACTIVE_TRIP_STATUSES).order("departure_time").limit(1);
  if (error) throw error;
  const trip = data?.[0];
  if (!trip) return null;
  const { data: auth } = await supabase.auth.getUser();
  const { data: req } = await supabase.from("ride_requests").select("id").eq("group_id", trip.group_id).eq("student_id", auth.user?.id ?? "").limit(1).maybeSingle();
  return { trip, requestId: req?.id ?? null };
}

export function StudentCurrentRide() {
  const q = useQuery({ queryKey: ["my-active-trip"], queryFn: getMyActiveTrip, refetchInterval: 10000 });
  const cur = q.data;
  if (!cur) {
    return <div className="surface-panel"><EmptyState compact title="No ride in progress" description="When a ride starts, its live status will appear here." icon={Navigation} /></div>;
  }
  const { trip, requestId } = cur;
  return (
    <div className="surface-panel overflow-hidden">
      <div className="border-b border-border bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="section-label">Current ride</span>
          <Badge variant="warning" className="shrink-0 rounded-full">{studentTripLabel(trip.status as TripStatus, trip.dispatch_state, trip.confirmed_at)}</Badge>
        </div>
        <div className="mt-3 grid gap-1.5">
          <p className="flex min-w-0 items-center gap-2 text-sm"><span className="w-10 shrink-0 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">From</span><span className="truncate font-semibold">{trip.meeting_point_text}</span></p>
          <p className="flex min-w-0 items-center gap-2 text-sm"><span className="w-10 shrink-0 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">To</span><MapPin className="size-3.5 shrink-0 text-brand" /><span className="truncate font-semibold">{trip.destination_text}</span></p>
        </div>
      </div>
      <div className="p-4">
        <JourneyTracker status={trip.status} riderId={trip.rider_id} />
        {trip.rider_id && <TripRiderCard tripId={trip.id} status={trip.status} departure={trip.departure_time} />}
        {requestId && <Button asChild variant="secondary" className="mt-4 w-full"><Link to="/student/rides/$id" params={{ id: requestId }}>Open ride details</Link></Button>}
      </div>
    </div>
  );
}
