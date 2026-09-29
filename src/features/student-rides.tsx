import { StudentTripFare } from "@/features/finance";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, Navigation, Plus, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { AppShell } from "@/components/futamove/app-shell";
import { ConfirmationDialog } from "@/components/futamove/confirmation-dialog";
import { EmptyState, ErrorState, LoadingState, ScreenHeader, SectionHeading, TrustNote } from "@/components/futamove/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RouteSummary } from "@/features/ride-request";
import { CATEGORY_LABELS, CATEGORY_ORDER, listActiveLocations } from "@/services/locations";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import {
  cancelRideRequest,
  formatDepartureTime,
  getRideRequest,
  startPrivateRide,
  listRideRequests,
  type RideRequest,
} from "@/services/ride-requests";
import { cancelReasonText, confirmRide, isCancelled, isTerminal, listMyGroupTrips, studentTripLabel, tripMemberCount, type TripStatus } from "@/services/trips";
import { GroupChat } from "@/features/group-chat";
import { TripRiderCard } from "@/features/trip-rider-card";
import { AvailableRiders } from "@/features/available-riders";
import { pingDispatch } from "@/services/dispatch";
import { getRideCapacity, addGroupMember, confirmMeetingPoint, getRideGroup, leaveRideGroup, matchRideRequest, setMeetingPoint, type RideGroup } from "@/services/ride-groups";

const rideRequestsKey = ["ride-requests"] as const;

/**
 * Displayed status is derived from the authoritative record: the trip when one exists,
 * otherwise the ride request. A completed trip therefore never shows "Searching".
 */
function StatusPill({ status, trip }: { status: RideRequest["status"]; trip?: TripStatus | undefined }) {
  const kind: "live" | "done" | "off" =
    trip === "completed" ? "done" : (trip && isTerminal(trip)) || status !== "searching" ? "off" : "live";
  const label = trip === "completed" ? "Completed" : trip && isCancelled(trip) ? "Cancelled" : trip ? "Active" : status === "searching" ? "Searching" : status === "cancelled" ? "Cancelled" : "Draft";
  return (
    <Badge variant={kind === "live" ? "warning" : kind === "done" ? "success" : "outline"} className="gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">
      <span className={kind === "live" ? "size-1.5 animate-pulse rounded-full bg-warning" : kind === "done" ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-muted-foreground"} />
      {label}
    </Badge>
  );
}

/** Once the rider is on the way, or the ride has ended, cancelling is no longer allowed (matches the database rule). */
function tripBlocksCancel(t?: TripStatus) {
  return !!t && (t === "arriving" || t === "picked_up" || t === "in_progress" || isTerminal(t));
}

function RequestRow({ request, trip, dispatchState }: { request: RideRequest; trip?: TripStatus | undefined; dispatchState?: string | undefined }) {
  return (
    <Link
      to="/student/rides/$id"
      params={{ id: request.id }}
      className="group flex items-center gap-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="min-w-0 flex-1">
        <p className="section-label mb-2">
          {trip && request.group_id ? studentTripLabel(trip, dispatchState) : request.status === "searching" && request.group_id ? "In a temporary group" : request.status === "searching" && request.ride_type === "private" ? "Private keke" : request.status === "searching" ? "Searching for passengers" : request.status === "cancelled" ? "Cancelled request" : "Draft request"}
        </p>
        <p className="truncate text-sm font-semibold">{request.origin_text}</p>
        <p className="truncate text-sm font-semibold text-muted-foreground">↓ {request.destination_text}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{formatDepartureTime(request.departure_time)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusPill status={request.status} trip={request.group_id ? trip : undefined} />
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export function StudentRidesPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: rideRequestsKey, queryFn: listRideRequests });
  const trips = useQuery({ queryKey: ["my-group-trips"], queryFn: listMyGroupTrips, refetchInterval: 10000 });
  const tripOf = (r: RideRequest) => (r.group_id ? (trips.data?.find((t) => t.group_id === r.group_id)?.status as TripStatus | undefined) : undefined);
  const dispatchOf = (r: RideRequest) => (r.group_id ? (trips.data?.find((t) => t.group_id === r.group_id)?.dispatch_state ?? undefined) : undefined);
  const finished = (r: RideRequest) => { const t = tripOf(r); return !!t && (t === "completed" || isCancelled(t)); };
  const active = (data ?? []).filter((r) => r.status === "searching" && !finished(r));
  const past = (data ?? []).filter((r) => r.status !== "searching" || finished(r));

  return (
    <AppShell role="student">
      <ScreenHeader
        title="Rides"
        action={
          <Button asChild size="sm">
            <Link to="/student/request">
              <Plus /> New
            </Link>
          </Button>
        }
      />

      {isLoading && (
        <div className="mt-8">
          <LoadingState />
        </div>
      )}
      {isError && (
        <div className="mt-8">
          <ErrorState message="We couldn't load your ride requests. Check your connection and try again." />
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <section className="mt-9">
            {active.length ? (
              <SectionHeading title="Active request" />
            ) : (
              <SectionHeading title="Active request" detail="None" />
            )}
            {active.length ? (
              <div className="mt-2 divider-list">
                {active.map((request) => (
                  <RequestRow key={request.id} request={request} trip={tripOf(request)} dispatchState={dispatchOf(request)} />
                ))}
              </div>
            ) : (
              <div className="surface-panel mt-3">
                <EmptyState
                  compact
                  icon={Navigation}
                  title="No active ride request"
                  description="Start a request and we'll look for passengers heading your way."
                  action={
                    <Button asChild>
                      <Link to="/student/request">Request a ride</Link>
                    </Button>
                  }
                />
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="mt-10">
              <SectionHeading title="Ride history" />
              <div className="mt-2 divider-list">
                {past.map((request) => (
                  <RequestRow key={request.id} request={request} trip={tripOf(request)} dispatchState={dispatchOf(request)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}

export function RideRequestDetailPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: [...rideRequestsKey, id],
    queryFn: () => getRideRequest(id),
  });

  const trips = useQuery({ queryKey: ["my-group-trips"], queryFn: listMyGroupTrips, refetchInterval: 10000 });
  const tripStatus = data?.group_id ? (trips.data?.find((t) => t.group_id === data.group_id)?.status as TripStatus | undefined) : undefined;
  const cancel = useMutation({
    mutationFn: () => cancelRideRequest(id),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: rideRequestsKey });
      await queryClient.invalidateQueries({ queryKey: ["my-group-trips"] });
      await queryClient.invalidateQueries({ queryKey: ["ride-group"] });
    },
  });

  const isSearching = data?.status === "searching";
  const isShared = data?.ride_type === "shared";
  const canCancel = isSearching && !tripBlocksCancel(tripStatus);
  const chatOpen = isSearching && !!data?.group_id && !(tripStatus && isTerminal(tripStatus));

  return (
    <AppShell role="student">
      <div className="mx-auto w-full max-w-md lg:max-w-lg">
        <div className="flex h-11 items-center">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => void navigate({ to: "/student/rides" })}
            className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>

        {isLoading && (
          <div className="mt-8">
            <LoadingState />
          </div>
        )}
        {isError && (
          <div className="mt-8">
            <ErrorState message="We couldn't load this ride request." />
          </div>
        )}
        {!isLoading && !isError && !data && (
          <div className="mt-8">
            <EmptyState title="Request not found" description="This ride request is no longer available." />
          </div>
        )}

        {data && (
          <section className="mt-8">
            {data.group_id ? (
              <GroupPanel groupId={data.group_id} requestId={id} />
            ) : isSearching && isShared ? (
              <MatchingPanel requestId={id} partySize={data.party_size} />
            ) : isSearching ? (
              <PrivateStartPanel requestId={id} />
            ) : (
              <>
                <h1 className="display-title text-[2rem]">Request cancelled</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  This ride request is no longer searching for passengers.
                </p>
              </>
            )}

            {!data.group_id && (
              <>
                <div className="mt-8 flex justify-center">
                  <StatusPill status={data.status} />
                </div>
                <div className="mt-6">
                  <RouteSummary
                    origin={data.origin_text}
                    destination={data.destination_text}
                    departure={data.departure_time}
                  />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {isShared ? "Shared ride" : "Private keke"} · {data.party_size} {data.party_size === 1 ? "person" : "people"}
                  </p>
                </div>
              </>
            )}

            {chatOpen && isShared && data.group_id && <GroupChat groupId={data.group_id} />}

            {cancel.isError && (
              <p className="mt-5 rounded-card border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                {cancel.error.message.includes("RIDE_CANNOT_BE_CANCELLED")
                  ? cancel.error.message.replace(/^.*RIDE_CANNOT_BE_CANCELLED:\s*/, "")
                  : "We couldn't cancel this request. Check your connection and try again."}
              </p>
            )}

            {canCancel && (
              <div className="mt-7">
                <ConfirmationDialog
                  trigger={
                    <Button variant="secondary" size="lg" className="w-full" disabled={cancel.isPending}>
                      {cancel.isPending ? <Loader2 className="animate-spin" /> : <XCircle />}
                      {cancel.isPending ? "Cancelling…" : "Cancel request"}
                    </Button>
                  }
                  title="Cancel this ride request?"
                  description={
                    data.group_id
                      ? "You'll leave your group and we'll stop looking for passengers. The rest of the group stays together if at least two remain."
                      : "We'll stop looking for passengers heading your way. You can always create a new request."
                  }
                  confirmLabel="Cancel request"
                  onConfirm={() => cancel.mutate()}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

const PRIVATE_BLOCKED: Record<string, string> = {
  not_verified: "Your FUTA verification must be approved before FUTAMOVE can look for a rider.",
  departure_passed: "The departure time for this request has passed. Cancel it and create a new one.",
  pickup_unavailable: "Your pickup location is no longer available. Cancel this request and choose another.",
  already_in_ride: "You're already in another active ride. Finish or cancel it first.",
};

/** Private Keke: hands the request to the normal rider search (one booking, never matched with others). */
function PrivateStartPanel({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const start = useQuery({
    queryKey: ["private-start", requestId],
    queryFn: () => startPrivateRide(requestId),
    refetchInterval: (query) => (query.state.data?.started ? false : 15000),
  });
  useEffect(() => {
    if (start.data?.started) {
      void queryClient.invalidateQueries({ queryKey: rideRequestsKey });
      void queryClient.invalidateQueries({ queryKey: ["my-group-trips"] });
    }
  }, [start.data?.started, queryClient]);
  const reason = start.data && !start.data.started ? PRIVATE_BLOCKED[start.data.reason ?? ""] : null;
  return (
    <>
      <h1 className="display-title text-[2rem]">Private keke</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {start.isError
          ? start.error.message
          : reason ?? "This ride is just for your party. FUTAMOVE is starting the rider search…"}
      </p>
    </>
  );
}

function MatchingPanel({ requestId, partySize }: { requestId: string; partySize: number }) {
  const queryClient = useQueryClient();
  const capacity = useQuery({ queryKey: ["ride-capacity"], queryFn: getRideCapacity, staleTime: Infinity });
  const match = useQuery({
    queryKey: ["ride-match", requestId],
    queryFn: () => matchRideRequest(requestId),
    refetchInterval: (query) => (query.state.data?.group_id || query.state.data?.eligible === false ? false : 6000),
  });

  const groupId = match.data?.group_id;
  useEffect(() => {
    if (groupId) void queryClient.invalidateQueries({ queryKey: rideRequestsKey });
  }, [groupId, queryClient]);

  if (match.data && !match.data.eligible) {
    return (
      <>
        <div className="flex justify-center py-4">
          <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
            <ShieldCheck className="size-6" strokeWidth={1.75} />
          </span>
        </div>
        <h1 className="display-title mt-4 text-center text-[2rem]">Verification needed</h1>
        <p className="mx-auto mt-3 max-w-xs text-center text-sm leading-6 text-muted-foreground">
          Only verified FUTA users can be matched into shared rides. Your request is saved and will start matching once you're verified.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="secondary">
            <Link to="/verification">Submit verification</Link>
          </Button>
        </div>
      </>
    );
  }

  const found = match.data?.compatible_count ?? 0;
  return (
    <>
      <div className="flex justify-center py-4">
        <span className="relative grid size-16 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/25" />
          <span className="absolute inset-2 rounded-full bg-brand/15" />
          <Loader2 className="relative size-6 animate-spin text-brand-strong" strokeWidth={2} />
        </span>
      </div>
      <h1 className="display-title mt-4 text-center text-[2rem]">Finding your people</h1>
      <p className="mx-auto mt-3 max-w-xs text-center text-sm leading-6 text-muted-foreground">
        We're looking for verified FUTA passengers with the same pickup, destination and time.
      </p>
      <div className="mx-auto mt-6 max-w-xs">
        {capacity.data != null && <SeatMeter filled={partySize} capacity={capacity.data} />}
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {match.isError
            ? "We couldn't check for matches just now. Retrying…"
            : found > 0
              ? `${found} compatible ${found === 1 ? "passenger" : "passengers"} found — checking seats…`
              : capacity.data != null ? `Your party: ${partySize} of ${capacity.data} seats · still searching` : "Still searching"}
        </p>
      </div>
    </>
  );
}

function SeatMeter({ filled, capacity }: { filled: number; capacity: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`${filled} of ${capacity} seats filled`}>
      {Array.from({ length: capacity }).map((_, i) => (
        <span key={i} className={i < filled ? "h-1.5 flex-1 rounded-full bg-brand transition-colors" : "h-1.5 flex-1 rounded-full bg-muted transition-colors"} />
      ))}
    </div>
  );
}

function GroupPanel({ groupId, requestId }: { groupId: string; requestId: string }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const group = useQuery({
    queryKey: ["ride-group", groupId],
    queryFn: () => getRideGroup(groupId),
    refetchInterval: 6000,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["ride-group", groupId] });
    await queryClient.invalidateQueries({ queryKey: rideRequestsKey });
  };

  const rideConfirm = useMutation({ mutationFn: () => confirmRide(groupId), onSuccess: refresh, onError: refresh });
  const agree = useMutation({ mutationFn: (version: number) => confirmMeetingPoint(groupId, version), onSuccess: refresh, onError: refresh });
  const addMember = useMutation({
    mutationFn: () => addGroupMember(groupId),
    onSuccess: async (result) => {
      setNote(
        result.added
          ? "A compatible student joined your group."
          : result.reason === "full"
            ? "Your keke is full."
            : "No compatible student with enough seats is available right now. Try again shortly.",
      );
      await refresh();
    },
  });
  const leave = useMutation({
    mutationFn: () => leaveRideGroup(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ride-match", requestId] });
      await refresh();
    },
  });

  if (group.isLoading) return <LoadingState />;
  if (group.isError || !group.data) return <ErrorState message="We couldn't load your group." />;

  const g = group.data;
  if (g.trip) return <StudentTripPanel g={g} />;
  const me = g.members.find((m) => m.is_me);
  const ready = g.status === "ready";
  const seatsLeft = g.capacity - g.passenger_count;
  const waitingOn = g.members.filter((m) => !m.meeting_point_agreed).length;
  const needsNewPoint = !g.meeting_point_active;
  const error = rideConfirm.error ?? agree.error ?? addMember.error ?? leave.error;

  return (
    <>
      <p className="section-label">Temporary group</p>
      <h1 className="display-title mt-2 text-[2rem]">{ready ? "Ride ready" : "Your group is forming"}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {ready
          ? `Meeting point agreed. Every member must now confirm the ride — ${g.members.filter((m) => !m.ride_confirmed).length} still to confirm. A rider is requested once everyone confirms.`
          : needsNewPoint
            ? "The meeting point is no longer available. Your group needs a new meeting point before it can continue."
            : g.members.length < 2
              ? "Waiting for more members."
              : `Waiting for ${waitingOn} ${waitingOn === 1 ? "member" : "members"} to confirm the meeting point.`}
      </p>

      <div className="mt-6 flex items-center justify-between">
        <Badge variant={ready ? "success" : "warning"} className="gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">
          <span className={ready ? "size-1.5 rounded-full bg-success" : "size-1.5 animate-pulse rounded-full bg-warning"} />
          {ready ? "Awaiting ride confirmation" : "Waiting for confirmations"}
        </Badge>
        <span className="text-sm font-semibold">
          {g.passenger_count} of {g.capacity} seats
        </span>
      </div>
      <div className="mt-3">
        <SeatMeter filled={g.passenger_count} capacity={g.capacity} />
      </div>

      <div className="mt-6">
        <RouteSummary origin={g.my_origin_text ?? g.meeting_point_text} destination={g.destination_text} departure={g.departure_time} />
      </div>

      <MeetingPointSection g={g} onChanged={refresh} />

      <section className="mt-8">
        <SectionHeading title="Members" detail={`${g.members.length} ${g.members.length === 1 ? "request" : "requests"}`} />
        <div className="mt-2 divider-list">
          {g.members.map((m, index) => (
            <div key={`${m.joined_at}-${index}`} className="flex items-center gap-3 py-3.5">
              <span className="grid size-10 place-items-center rounded-full bg-dark-surface text-sm font-bold text-dark-foreground">
                {m.first_name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {m.is_me ? "You" : m.first_name}
                  {m.party_size > 1 && <span className="font-normal text-muted-foreground"> +{m.party_size - 1}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.is_organizer ? "Group organiser" : "Verified FUTA passenger"}
                </p>
              </div>
              {ready ? (
                m.ride_confirmed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="size-4" strokeWidth={2} /> Ride confirmed</span>
                ) : (
                  <span className="text-xs text-muted-foreground">○ Confirming ride</span>
                )
              ) : m.meeting_point_agreed ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                  <CheckCircle2 className="size-4" strokeWidth={2} /> Confirmed
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">○ Waiting for confirmation</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {error && (
        <p className="mt-5 rounded-card border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Something went wrong. Try again."}
        </p>
      )}
      {note && <p className="mt-5 text-sm text-muted-foreground">{note}</p>}

      <div className="mt-7 grid gap-3">
        {me && !me.meeting_point_agreed && !needsNewPoint && (
          <Button size="lg" className="w-full" onClick={() => agree.mutate(g.meeting_point_version)} disabled={agree.isPending}>
            {agree.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {agree.isPending ? "Saving…" : "Confirm meeting point"}
          </Button>
        )}
        {ready && me && !me.ride_confirmed && (
          <Button size="lg" className="w-full" onClick={() => rideConfirm.mutate()} disabled={rideConfirm.isPending}>
            {rideConfirm.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {rideConfirm.isPending ? "Confirming…" : "Confirm ride"}
          </Button>
        )}
        {ready && me?.ride_confirmed && (
          <p className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="size-4" /> You confirmed this ride</p>
        )}
        {!ready && me?.meeting_point_agreed && (
          <p className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="size-4" /> Meeting point confirmed</p>
        )}
        {seatsLeft > 0 ? (
          <Button variant="secondary" size="lg" className="w-full" onClick={() => addMember.mutate()} disabled={addMember.isPending}>
            {addMember.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {addMember.isPending ? "Looking…" : `Find another student (${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left)`}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">This keke is full — 4 passengers is the limit.</p>
        )}
        <ConfirmationDialog
          trigger={
            <Button variant="ghost" className="w-full" disabled={leave.isPending}>
              {leave.isPending ? "Leaving…" : "Leave group"}
            </Button>
          }
          title="Leave this group?"
          description="Your request goes back to searching. The group stays together if at least two requests remain."
          confirmLabel="Leave group"
          onConfirm={() => leave.mutate()}
        />
      </div>
    </>
  );
}

function MeetingPointSection({ g, onChanged }: { g: RideGroup; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [locationId, setLocationId] = useState(g.meeting_point_location_id ?? "");
  const [note, setNote] = useState(g.meeting_point_note ?? "");
  const locations = useQuery({ queryKey: ["locations", "active"], queryFn: listActiveLocations, enabled: editing });
  const save = useMutation({
    mutationFn: () => setMeetingPoint(g.id, locationId, note),
    onSuccess: async () => { setEditing(false); await onChanged(); },
  });
  const differs = g.my_origin_text && g.my_origin_text !== g.meeting_point_text;
  return (
    <section className="surface-panel mt-6 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground"><MapPin className="size-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Meeting point</p>
          <p className="text-lg font-bold">{g.meeting_point_text}</p>
          {g.meeting_point_note && <p className="mt-1 text-sm text-muted-foreground">{g.meeting_point_note}</p>}
          {differs && <p className="mt-1 text-xs text-muted-foreground">Your current location: {g.my_origin_text}</p>}
          {!g.meeting_point_active && <p className="mt-2 text-sm text-destructive">This location is no longer available. {g.can_manage_meeting_point ? "Choose a new meeting point." : "Waiting for the organiser to choose a new one."}</p>}
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Everyone in your group must confirm this meeting point before the ride can proceed.</p>
        </div>
      </div>
      {g.can_manage_meeting_point && !editing && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditing(true)}>Change meeting point</Button>
      )}
      {editing && (
        <div className="mt-4 grid gap-3">
          <select aria-label="New meeting point" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">{locations.isLoading ? "Loading locations…" : "Choose a location"}</option>
            {CATEGORY_ORDER.map((cat) => (
              <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                {(locations.data ?? []).filter((l) => l.category === cat).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </optgroup>
            ))}
          </select>
          <Input aria-label="Optional note" maxLength={140} placeholder="Optional note, e.g. beside the security post" value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="text-xs text-muted-foreground">Changing the meeting point asks everyone to confirm again.</p>
          {save.error && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={!locationId || save.isPending} onClick={() => save.mutate()}>Save meeting point</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}

const STUDENT_STEPS: { key: TripStatus; label: string; at: keyof NonNullable<RideGroup["trip"]> | null }[] = [
  { key: "confirmed", label: "Ride confirmed", at: null },
  { key: "assigned", label: "Rider assigned", at: "assigned_at" },
  { key: "accepted", label: "Rider accepted", at: "accepted_at" },
  { key: "arriving", label: "Rider on the way", at: "arriving_at" },
  { key: "picked_up", label: "Picked up", at: "picked_up_at" },
  { key: "in_progress", label: "Ride in progress", at: "started_at" },
  { key: "completed", label: "Ride completed", at: "completed_at" },
];
const STEP_ORDER: TripStatus[] = ["confirmed", "assigned", "accepted", "arriving", "picked_up", "in_progress", "completed"];

function StudentTripPanel({ g }: { g: RideGroup }) {
  const t = g.trip!;
  const cancelled = isCancelled(t.status);
  const idx = STEP_ORDER.indexOf(t.status);
  const done = t.status === "completed";
  const label = studentTripLabel(t.status, t.dispatch_state, t.confirmed_at);
  const waiting = t.status === "confirmed" || t.status === "assigned";
  const size = useQuery({ queryKey: ["trip-size", t.id], queryFn: () => tripMemberCount(t.id), enabled: cancelled });
  useEffect(() => {
    if (t.status !== "confirmed") return;
    void pingDispatch(g.id);
    const id = window.setInterval(() => void pingDispatch(g.id), 20000);
    return () => window.clearInterval(id);
  }, [g.id, t.status]);
  return (
    <>
      <p className="section-label">Your ride</p>
      <h1 className="display-title mt-2 text-[2rem]">{label}</h1>
      <StudentTripFare tripId={t.id} />
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {cancelled
          ? cancelReasonText({ status: t.status, member_count: size.data ?? 2, cancel_reason: t.cancel_reason }) ?? "This ride was cancelled."
          : waiting
            ? t.dispatch_state === "escalated"
              ? "We haven't found a rider yet, so the FUTAMOVE team is arranging one for your group. Stay close to the meeting point."
              : t.status === "assigned"
                ? "A rider has been assigned and is confirming the ride."
                : g.members.length === 1
                  ? "Private keke. FUTAMOVE is finding a keke rider for your party."
                  : "Everyone confirmed. FUTAMOVE is finding a keke rider for your group."
            : t.status === "accepted"
              ? "A rider has accepted your ride. Be at the meeting point on time."
              : t.status === "arriving"
                ? "Your rider is heading to the meeting point now."
                : t.status === "picked_up"
                  ? "Your rider has arrived. Confirm once you're in the keke."
                  : t.status === "in_progress"
                    ? "Enjoy the ride."
                    : "You've arrived. Thanks for riding with FUTAMOVE."}
      </p>
      <div className="mt-6 flex items-center justify-between">
        <Badge variant={cancelled ? "outline" : done ? "success" : "warning"} className="gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">
          {!cancelled && !done && <span className="size-1.5 animate-pulse rounded-full bg-warning" />}
          {label}
        </Badge>
        <span className="text-sm font-semibold">{g.passenger_count} {g.passenger_count === 1 ? "passenger" : "passengers"}</span>
      </div>
      <div className="mt-6">
        <RouteSummary origin={t.meeting_point_text} destination={g.destination_text} departure={g.departure_time} />
      </div>
      {g.meeting_point_note && <p className="mt-3 text-xs text-muted-foreground">Meeting point note: {g.meeting_point_note}</p>}
      {t.rider && !cancelled && <TripRiderCard tripId={t.id} status={t.status} departure={g.departure_time} />}
      {t.status === "confirmed" && !t.rider && <AvailableRiders tripId={t.id} />}
      {!cancelled && (
        <ol className="mt-8 space-y-3">
          {STUDENT_STEPS.map((s) => {
            const reached = STEP_ORDER.indexOf(s.key) <= idx;
            const when = s.at ? (t[s.at] as string | null) : null;
            return (
              <li key={s.key} className="flex items-center gap-3 text-sm">
                {reached ? <CheckCircle2 className="size-4 text-success" /> : <span className="size-4 rounded-full border border-border" />}
                <span className={reached ? "font-semibold" : "text-muted-foreground"}>{s.label}</span>
                {when && <span className="ml-auto text-xs text-muted-foreground">{new Date(when).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>}
              </li>
            );
          })}
        </ol>
      )}
      <section className="mt-8">
        <SectionHeading title="Passengers" detail={`${g.members.length} ${g.members.length === 1 ? "request" : "requests"}`} />
        <div className="mt-2 divider-list">
          {g.members.map((m, i) => (
            <p key={`${m.joined_at}-${i}`} className="py-3 text-sm font-semibold">
              {m.is_me ? "You" : m.first_name}
              {m.party_size > 1 && <span className="font-normal text-muted-foreground"> +{m.party_size - 1}</span>}
            </p>
          ))}
        </div>
      </section>
      {(t.status === "confirmed" || t.status === "assigned" || t.status === "accepted") && (
        <p className="mt-6 text-xs text-muted-foreground">Need to drop out? Use “Cancel request” below. Once the rider is on the way, contact FUTAMOVE support instead.</p>
      )}
    </>
  );
}
