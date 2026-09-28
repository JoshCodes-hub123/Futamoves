import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/futamove/app-shell";
import { EmptyState, LoadingState, ScreenHeader, SectionHeading } from "@/components/futamove/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDepartureTime } from "@/services/ride-requests";
import { riderConfirmedStart } from "@/services/ratings";
import { getMyAvailability, listMyOffers, respondOffer, setMyAvailability, shareMyLocation, type Availability, type RideOffer } from "@/services/dispatch";
import {
  ACTIVE_TRIP_STATUSES, advanceTrip, cancelReasonText, isPrivateTrip, claimTrip, isCancelled, listAvailableTrips, listMyRiderTrips, respondAssignment, riderReportPassengerNoShow, withdrawTrip,
  type Trip, type TripStatus,
} from "@/services/trips";

const RIDER_LABEL: Record<TripStatus, string> = {
  confirmed: "Available", assigned: "Assigned to you", accepted: "Accepted", arriving: "Heading to pickup",
  picked_up: "Arrived · passengers on board", in_progress: "Trip started", completed: "Completed",
  cancelled_by_student: "Cancelled by passenger", cancelled_by_rider: "Cancelled by rider", cancelled_by_admin: "Cancelled by admin", expired: "Expired", no_show: "No-show",
};

function Route({ from, to, when, pax, note }: { from: string; to: string; when: string; pax: number; note?: string | null }) {
  return (
    <div className="space-y-1.5 text-sm">
      <p className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-brand" /> {from}</p>
      {note && <p className="pl-6 text-xs text-muted-foreground">{note}</p>}
      <p className="pl-6 font-semibold text-muted-foreground">↓ {to}</p>
      <p className="flex items-center gap-4 pl-6 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" /> {formatDepartureTime(when)}</span>
        <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {pax} {pax === 1 ? "passenger" : "passengers"}</span>
      </p>
    </div>
  );
}

function CurrentTrip({ trip, onDone }: { trip: Trip; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const s = trip.status as TripStatus;
  const act = useMutation({
    mutationFn: async (a: "accept" | "reject" | "arriving" | "picked_up" | "in_progress" | "completed" | "withdraw") => {
      if (a === "accept") return respondAssignment(trip.id, true);
      if (a === "reject") return respondAssignment(trip.id, false, reason);
      if (a === "withdraw") return withdrawTrip(trip.id, reason);
      return advanceTrip(trip.id, a);
    },
    onSuccess: async () => { setReason(""); setWithdrawing(false); await onDone(); },
    onError: onDone,
  });
  const next: Partial<Record<TripStatus, { to: "arriving" | "picked_up" | "in_progress" | "completed"; label: string }>> = {
    accepted: { to: "arriving", label: "Head to meeting point" },
    arriving: { to: "picked_up", label: "I've arrived" },
    picked_up: { to: "in_progress", label: "Start ride" },
    in_progress: { to: "completed", label: "Arrived at destination" },
  };
  const confirmed = useQuery({ queryKey: ["rider-start-confirmed", trip.id, s], queryFn: () => riderConfirmedStart(trip.id), enabled: s === "picked_up", refetchInterval: 8000 });
  const arrived = useQuery({ queryKey: ["rider-dest-arrived", trip.id, s], queryFn: () => riderConfirmedStart(trip.id, "destination_arrival"), enabled: s === "in_progress", refetchInterval: 8000 });
  const step = (s === "picked_up" && confirmed.data) || (s === "in_progress" && arrived.data) ? undefined : next[s];
  return (
    <section className="mt-8 surface-panel p-5">
      <div className="flex items-center justify-between">
        <p className="section-label">My current ride</p>
        <Badge variant="warning" className="rounded-full">{RIDER_LABEL[s]}</Badge>
      </div>
      <div className="mt-4"><Route from={trip.meeting_point_text} to={trip.destination_text} when={trip.departure_time} pax={trip.passenger_count} note={trip.meeting_point_note} /></div>
      <p className="mt-3 text-xs text-muted-foreground">{trip.member_count} {trip.member_count === 1 ? "booking" : "bookings"} in this group · pickup at the agreed meeting point</p>
      {act.error && <p className="mt-4 text-sm text-destructive">{act.error.message}</p>}
      <div className="mt-5 grid gap-3">
        {s === "assigned" && (
          <>
            <Button size="lg" onClick={() => act.mutate("accept")} disabled={act.isPending}>{act.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Accept ride</Button>
            <Input placeholder="Reason for rejecting (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="secondary" onClick={() => act.mutate("reject")} disabled={act.isPending}>Reject</Button>
          </>
        )}
        {step && <Button size="lg" onClick={() => act.mutate(step.to)} disabled={act.isPending}>{act.isPending && <Loader2 className="animate-spin" />}{step.label}</Button>}
        {s === "picked_up" && confirmed.data && <p className="text-sm text-muted-foreground">You confirmed pickup. The ride starts as soon as one passenger confirms in the app.</p>}
        {s === "in_progress" && arrived.data && <p className="text-sm text-muted-foreground">Arrived — waiting for a passenger to confirm the ride is completed. You'll be free for new rides once one confirms.</p>}
        {(s === "accepted" || s === "arriving") && (withdrawing ? (
          <>
            <Input placeholder="Why can't you take this ride?" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="secondary" onClick={() => act.mutate("withdraw")} disabled={act.isPending || !reason.trim()}>Confirm withdrawal</Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setWithdrawing(true)}>I can't make this ride</Button>
        ))}
        {s === "picked_up" && <PassengerNoShow trip={trip} onDone={onDone} />}
      </div>
    </section>
  );
}

/** Rider reports passengers didn't show. Only possible after 5 min at the meeting point with no passenger confirmation (database-enforced). */
function PassengerNoShow({ trip, onDone }: { trip: Trip; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const m = useMutation({ mutationFn: () => riderReportPassengerNoShow(trip.id, reason), onSuccess: onDone, onError: onDone });
  const waitedMin = trip.arrived_at ? Math.floor((Date.now() - new Date(trip.arrived_at).getTime()) / 60000) : 0;
  if (!open) return <Button variant="ghost" onClick={() => setOpen(true)}>Passengers didn't show up</Button>;
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">{waitedMin < 5 ? `Please wait at least 5 minutes at the meeting point (${waitedMin} min so far).` : "This ends the ride as a passenger no-show. It can't be undone."}</p>
      <Input placeholder="What happened? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button variant="secondary" disabled={m.isPending || waitedMin < 5} onClick={() => m.mutate()}>{m.isPending && <Loader2 className="animate-spin" />} Report no-show</Button>
      {m.error && <p className="text-sm text-destructive">{m.error.message}</p>}
    </div>
  );
}

function useCountdown(to: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  return Math.max(0, Math.round((new Date(to).getTime() - now) / 1000));
}

function OfferCard({ offer, onDone }: { offer: RideOffer; onDone: () => Promise<void> }) {
  const left = useCountdown(offer.expires_at);
  const [msg, setMsg] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (accept: boolean) => respondOffer(offer.offer_id, accept),
    onSuccess: async (r) => { if (!r.ok) setMsg("This offer expired before you answered."); await onDone(); },
    onError: onDone,
  });
  return (
    <section className="mt-8 surface-panel border-brand/60 p-5">
      <div className="flex items-center justify-between">
        <p className="section-label">New ride offer</p>
        <Badge variant="warning" className="rounded-full tabular-nums">{left > 0 ? `${left}s left` : "Expiring…"}</Badge>
      </div>
      <div className="mt-4"><Route from={offer.meeting_point_text} to={offer.destination_text} when={offer.departure_time} pax={offer.passenger_count} note={offer.meeting_point_note} /></div>
      <p className="mt-3 text-xs text-muted-foreground">{offer.member_count} {offer.member_count === 1 ? "booking" : "bookings"} · pickup at the agreed meeting point</p>
      {(act.error || msg) && <p className="mt-3 text-sm text-destructive">{msg ?? act.error?.message}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" disabled={act.isPending || left === 0} onClick={() => act.mutate(false)}>Decline</Button>
        <Button disabled={act.isPending || left === 0} onClick={() => act.mutate(true)}>{act.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Accept</Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Declining is fine — it won't count against you. If you don't answer in time, the ride goes to the next rider.</p>
    </section>
  );
}

const AVAILABILITY: { key: Availability; label: string; hint: string }[] = [
  { key: "online", label: "Online", hint: "You'll receive ride offers." },
  { key: "busy", label: "Busy", hint: "Taking a short break. No offers for now." },
  { key: "offline", label: "Offline", hint: "No ride offers." },
];

/** Rider home: availability, offers, current ride and rides waiting without an offer. */
export function RiderOperations() {
  const qc = useQueryClient();
  const availability = useQuery({ queryKey: ["rider-availability"], queryFn: getMyAvailability });
  const online = availability.data === "online";
  const mine = useQuery({ queryKey: ["rider-trips"], queryFn: listMyRiderTrips, refetchInterval: 10000 });
  const offers = useQuery({ queryKey: ["rider-offers"], queryFn: listMyOffers, refetchInterval: online ? 6000 : false, enabled: online });
  const available = useQuery({ queryKey: ["rider-available"], queryFn: listAvailableTrips, refetchInterval: online ? 15000 : false, enabled: online });
  const refresh = async () => {
    await Promise.all(["rider-trips", "rider-available", "rider-offers", "rider-availability"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  };
  const setAvail = useMutation({ mutationFn: setMyAvailability, onSuccess: refresh });
  const claim = useMutation({ mutationFn: claimTrip, onSuccess: refresh, onError: refresh });
  // While online, share the real device position every minute so closer riders can be preferred.
  useEffect(() => {
    if (!online) return;
    void shareMyLocation().catch(() => undefined);
    const t = setInterval(() => void shareMyLocation().catch(() => undefined), 60000);
    return () => clearInterval(t);
  }, [online]);
  const current = mine.data?.find((t) => ACTIVE_TRIP_STATUSES.includes(t.status as TripStatus));
  const offer = online && !current ? offers.data?.[0] : undefined;
  const hasOffer = !!offers.data?.length;

  return (
    <>
      <section className="mt-8 surface-panel p-5 text-sm">
        <p className="section-label">Availability</p>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Availability">
          {AVAILABILITY.map((a) => (
            <button key={a.key} type="button" role="radio" aria-checked={availability.data === a.key} disabled={setAvail.isPending}
              onClick={() => setAvail.mutate(a.key)}
              className={`rounded-md border px-3 py-2.5 font-semibold transition-colors ${availability.data === a.key ? "border-brand bg-brand/15 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
              {a.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {current ? "You're on a ride. New offers pause until you finish." : AVAILABILITY.find((a) => a.key === availability.data)?.hint}
        </p>
        {setAvail.error && <p className="mt-2 text-destructive">{setAvail.error.message}</p>}
      </section>

      {offer && <OfferCard key={offer.offer_id} offer={offer} onDone={refresh} />}

      {mine.isLoading ? <LoadingState /> : current ? <CurrentTrip trip={current} onDone={refresh} /> : !offer && online && (
        <section className="mt-8 surface-panel p-5 text-sm"><p className="section-label">Status</p><p className="mt-2">You're online. FUTAMOVE will offer you a suitable ride — riders take turns fairly.</p></section>
      )}

      {online && (
        <section className="mt-10 space-y-3">
          <SectionHeading title="Rides waiting for a rider" detail={String(available.data?.length ?? 0)} />
          <p className="text-xs text-muted-foreground">Rides here aren't currently offered to anyone. You can take one if you're free.</p>
          {claim.error && <p className="text-sm text-destructive">{claim.error.message}</p>}
          {available.isLoading ? <LoadingState /> : available.data?.length ? (
            <div className="divider-list">
              {available.data.map((t) => (
                <div key={t.id} className="py-4">
                  <Route from={t.meeting_point_text} to={t.destination_text} when={t.departure_time} pax={t.passenger_count} note={t.meeting_point_note} />
                  <Button className="mt-3 w-full" size="sm" variant="secondary" disabled={!!current || hasOffer || claim.isPending} onClick={() => claim.mutate(t.id)}>
                    {current ? "Finish your current ride first" : hasOffer ? "Answer your offer first" : "Take this ride"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="surface-panel"><EmptyState compact title="No rides waiting" description="New rides are offered to riders automatically." icon={CalendarClock} /></div>
          )}
        </section>
      )}
    </>
  );
}

export function RiderTripsPage() {
  const mine = useQuery({ queryKey: ["rider-trips"], queryFn: listMyRiderTrips, refetchOnWindowFocus: true });
  // Only final states; active rides stay on the home screen. Server RLS returns only rides assigned to this rider.
  const past = (mine.data ?? []).filter((t) => t.status === "completed" || isCancelled(t.status));
  return (
    <AppShell role="rider">
      <ScreenHeader eyebrow="Rider" title="Ride history" />
      <section className="mt-8">
        {mine.isLoading ? <LoadingState /> : mine.error ? <p className="text-sm text-destructive">{mine.error.message}</p> : past.length ? (
          <div className="divider-list">
            {past.map((t) => {
              const reason = t.status === "completed" ? null : cancelReasonText(t);
              return (
                <div key={t.id} className="py-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={t.status === "completed" ? "success" : "outline"} className="rounded-full">{RIDER_LABEL[t.status as TripStatus]}</Badge>
                      <span className="text-xs font-semibold text-muted-foreground">{isPrivateTrip(t) ? "Private Keke" : "Shared ride"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Ride #{t.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <Route from={t.meeting_point_text} to={t.destination_text} when={t.departure_time} pax={t.passenger_count} />
                  <p className="mt-2 pl-6 text-xs text-muted-foreground">
                    {t.completed_at ? `Completed ${new Date(t.completed_at).toLocaleString()}` : t.cancelled_at ? `Ended ${new Date(t.cancelled_at).toLocaleString()}` : ""}
                    {reason ? ` · ${reason}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        ) : <div className="surface-panel"><EmptyState compact title="No rides yet" description="Completed, cancelled, expired and no-show rides you handled will show here." icon={CalendarClock} /></div>}
      </section>
    </AppShell>
  );
}

/** Rider Requests: one place for offers, assignments needing an answer, claimable rides and recently missed offers. All data and actions reuse the existing dispatch/trip services. */
export function RiderRequestsPage() {
  const qc = useQueryClient();
  const availability = useQuery({ queryKey: ["rider-availability"], queryFn: getMyAvailability });
  const online = availability.data === "online";
  const mine = useQuery({ queryKey: ["rider-trips"], queryFn: listMyRiderTrips, refetchInterval: 10000 });
  const offers = useQuery({ queryKey: ["rider-offers"], queryFn: listMyOffers, refetchInterval: online ? 6000 : false, enabled: online });
  const available = useQuery({ queryKey: ["rider-available"], queryFn: listAvailableTrips, refetchInterval: online ? 15000 : false, enabled: online });
  const refresh = async () => {
    await Promise.all(["rider-trips", "rider-available", "rider-offers", "rider-availability"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  };
  const claim = useMutation({ mutationFn: claimTrip, onSuccess: refresh, onError: refresh });
  const setAvail = useMutation({ mutationFn: setMyAvailability, onSuccess: refresh });

  // Offers seen this session that later disappeared from the live list (expired, taken or cancelled).
  const [missed, setMissed] = useState<RideOffer[]>([]);
  const [seen, setSeen] = useState<Record<string, RideOffer>>({});
  useEffect(() => {
    if (!offers.data) return;
    const live = new Set(offers.data.map((o) => o.offer_id));
    const gone = Object.values(seen).filter((o) => !live.has(o.offer_id));
    if (gone.length) setMissed((m) => [...gone, ...m].slice(0, 10));
    setSeen(Object.fromEntries(offers.data.map((o) => [o.offer_id, o])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers.data]);

  const trips = mine.data ?? [];
  const current = trips.find((t) => ACTIVE_TRIP_STATUSES.includes(t.status as TripStatus));
  const needsAnswer = current?.status === "assigned" ? current : undefined;
  const accepted = current && current.status !== "assigned" ? current : undefined;
  const acceptedIds = new Set(trips.map((t) => t.id));
  const missedShown = missed.filter((o) => !acceptedIds.has(o.trip_id));
  const hasOffer = !!offers.data?.length;
  const loading = availability.isLoading || mine.isLoading;
  const error = availability.error ?? mine.error ?? offers.error ?? available.error;
  const refreshing = mine.isFetching || offers.isFetching || available.isFetching;

  return (
    <AppShell role="rider">
      <ScreenHeader eyebrow="Rider" title="Requests" action={
        <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing}>{refreshing && <Loader2 className="animate-spin" />} Refresh</Button>
      } />
      {error && <div className="mt-6 flex items-center justify-between gap-3 rounded-card border border-destructive/25 bg-destructive/5 p-4 text-sm"><span>{error.message}</span><Button size="sm" variant="secondary" onClick={() => void refresh()}>Try again</Button></div>}
      {loading ? <div className="mt-8"><LoadingState /></div> : <>
        {!online && (
          <section className="mt-8 surface-panel p-5 text-sm">
            <p className="section-label">You're {availability.data ?? "offline"}</p>
            <p className="mt-2 text-muted-foreground">Go online to receive ride offers and see rides waiting for a rider.</p>
            <Button className="mt-4 w-full" disabled={setAvail.isPending} onClick={() => setAvail.mutate("online")}>{setAvail.isPending && <Loader2 className="animate-spin" />} Go online</Button>
            {setAvail.error && <p className="mt-2 text-destructive">{setAvail.error.message}</p>}
          </section>
        )}

        <section className="mt-10 space-y-3">
          <SectionHeading title="Needs your action" detail={String((needsAnswer ? 1 : 0) + (offers.data?.length ?? 0))} />
          {needsAnswer && <CurrentTrip trip={needsAnswer} onDone={refresh} />}
          {online && !current && offers.data?.map((o) => <OfferCard key={o.offer_id} offer={o} onDone={refresh} />)}
          {!needsAnswer && !(online && !current && hasOffer) && (
            <div className="surface-panel"><EmptyState compact title="Nothing to answer" description={online ? "New ride offers appear here automatically. Riders take turns fairly." : "Offers only arrive while you're online."} icon={CheckCircle2} /></div>
          )}
        </section>

        {accepted && (
          <section className="mt-10 space-y-3">
            <SectionHeading title="Accepted by you" />
            <CurrentTrip trip={accepted} onDone={refresh} />
          </section>
        )}

        {online && (
          <section className="mt-10 space-y-3">
            <SectionHeading title="Available to take" detail={String(available.data?.length ?? 0)} />
            <p className="text-xs text-muted-foreground">Rides not currently offered to anyone. First rider to take one gets it.</p>
            {claim.error && <p className="text-sm text-destructive">{claim.error.message}</p>}
            {available.isLoading ? <LoadingState /> : available.data?.length ? (
              <div className="divider-list">
                {available.data.map((t) => (
                  <div key={t.id} className="py-4">
                    <div className="mb-2 flex items-center gap-2"><Badge variant="success" className="rounded-full">New</Badge><span className="text-xs font-semibold text-muted-foreground">{isPrivateTrip(t) ? "Private Keke" : "Shared ride"}</span></div>
                    <Route from={t.meeting_point_text} to={t.destination_text} when={t.departure_time} pax={t.passenger_count} note={t.meeting_point_note} />
                    <Button className="mt-3 w-full" size="sm" variant="secondary" disabled={!!current || hasOffer || claim.isPending} onClick={() => claim.mutate(t.id)}>
                      {current ? "Finish your current ride first" : hasOffer ? "Answer your offer first" : "Take this ride"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : <div className="surface-panel"><EmptyState compact title="No rides waiting" description="New rides are offered to riders automatically." icon={CalendarClock} /></div>}
          </section>
        )}

        {missedShown.length > 0 && (
          <section className="mt-10 space-y-3">
            <SectionHeading title="Expired or unavailable" detail={String(missedShown.length)} />
            <div className="divider-list opacity-70">
              {missedShown.map((o) => (
                <div key={o.offer_id} className="py-4">
                  <Badge variant="outline" className="mb-2 rounded-full">No longer available</Badge>
                  <Route from={o.meeting_point_text} to={o.destination_text} when={o.departure_time} pax={o.passenger_count} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Offers that expired, were answered or went to another rider during this visit.</p>
          </section>
        )}
      </>}
    </AppShell>
  );
}
