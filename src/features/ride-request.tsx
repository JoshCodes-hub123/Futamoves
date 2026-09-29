import { FareQuote } from "@/features/finance";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Clock3,
  Loader2,
  LocateFixed,
  MapPin,
  Pencil,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/futamove/app-shell";
import { FutaMap } from "@/components/futamove/futa-map";
import { FieldError, ScreenHeader, TrustNote } from "@/components/futamove/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { listActiveLocations } from "@/services/locations";
import {
  createRideRequest,
  formatDepartureTime,
  roundedSuggestions,
  toLocalInputValue,
} from "@/services/ride-requests";

type Step = "route" | "time" | "review";

interface FieldErrors {
  origin?: string | undefined;
  destination?: string | undefined;
  time?: string | undefined;
  meetingPoint?: string | undefined;
}

export function RideRequestPage({
  initialOrigin = "",
  initialDestination = "",
}: {
  initialOrigin?: string;
  initialDestination?: string;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("route");
  const [routeEstimate, setRouteEstimate] = useState<string | null>(null);

  const locationsQuery = useQuery({ queryKey: ["locations", "active"], queryFn: listActiveLocations });
  const locations = locationsQuery.data ?? [];
  const byName = (n: string) => locations.find((l) => l.name.toLowerCase() === n.trim().toLowerCase())?.id ?? "";
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const originLoc = locations.find((l) => l.id === (originId || byName(initialOrigin)));
  const destinationLoc = locations.find((l) => l.id === (destinationId || byName(initialDestination)));
  const origin = originLoc?.name ?? "";
  const destination = destinationLoc?.name ?? "";
  const [rideType, setRideType] = useState<"shared" | "private">("shared");
  const [partySize, setPartySize] = useState(1);
  const [departure, setDeparture] = useState<string>(new Date().toISOString());
  const [useNow, setUseNow] = useState(true);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestions = roundedSuggestions();

  function continueFromRoute() {
    const next: FieldErrors = {};
    if (!originLoc) next.origin = "Choose your current location.";
    if (!destinationLoc) next.destination = "Choose where you're going.";
    else if (originLoc && originLoc.id === destinationLoc.id)
      next.destination = "Your current location and destination are the same. Choose a different destination.";
    setErrors(next);
    if (Object.keys(next).length === 0) setStep("time");
  }

  function continueFromTime() {
    const value = useNow ? new Date().toISOString() : departure;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      setErrors((e) => ({ ...e, time: "Choose a valid departure time." }));
      return;
    }
    if (date.getTime() < Date.now() - 60_000) {
      setErrors((e) => ({ ...e, time: "Choose a time in the future." }));
      return;
    }
    setDeparture(date.toISOString());
    setErrors((e) => ({ ...e, time: undefined }));
    setStep("review");
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createRideRequest({
        originLocationId: originLoc!.id,
        destinationLocationId: destinationLoc!.id,
        departureTime: useNow ? new Date().toISOString() : departure,
        partySize,
        rideType,
      });
      await navigate({ to: "/student/rides/$id", params: { id: created.id } });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating your request. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  const stepIndex = step === "route" ? 1 : step === "time" ? 2 : 3;

  return (
    <AppShell role="student">
      <div className="mx-auto w-full max-w-md lg:max-w-lg">
        <div className="flex h-11 items-center justify-between">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => {
              if (step === "route") void navigate({ to: "/student/home" });
              else setStep(step === "review" ? "time" : "route");
            }}
            className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-[18px]" strokeWidth={1.75} />
          </button>
          <span className="section-label">Step {stepIndex} of 3</span>
        </div>

        {step === "route" && (
          <section className="mt-8">
            <ScreenHeader eyebrow="Ride request" title="Where are you going?" />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Choose your current location and destination from approved FUTAMOVE locations.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ride type">
              {(["shared", "private"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={rideType === type}
                  onClick={() => setRideType(type)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    rideType === type ? "border-brand bg-brand/10" : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="block text-sm font-semibold">{type === "shared" ? "Shared ride" : "Private keke"}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {type === "shared" ? "Split with verified FUTA users" : "Just your party, no matching"}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <p className="text-[0.8125rem] font-medium">How many people?</p>
              <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Party size">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={partySize === n}
                    onClick={() => setPartySize(n)}
                    className={cn(
                      "h-11 rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      partySize === n ? "border-brand bg-brand/10" : "border-border hover:bg-muted/50",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">A keke carries up to 4 passengers.</p>
            </div>

            {errors.origin && <FieldError>{errors.origin}</FieldError>}
            {errors.destination && <FieldError>{errors.destination}</FieldError>}

            <FutaMap
              originLocationId={originId}
              destinationLocationId={destinationId}
              onOriginChange={setOriginId}
              onDestinationChange={setDestinationId}
              onRouteEstimateChange={setRouteEstimate}
              locations={locations}
              locationsLoading={locationsQuery.isLoading}
            />
            {locationsQuery.error && <FieldError>We couldn't load FUTAMOVE locations. Check your connection and try again.</FieldError>}

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              If you're matched, your current location becomes the group's suggested meeting point. Everyone confirms it before moving on.
            </p>

            <Button size="lg" className="mt-7 w-full" onClick={continueFromRoute}>
              Continue
            </Button>
          </section>
        )}

        {step === "time" && (
          <section className="mt-8">
            <ScreenHeader eyebrow="Ride request" title="When are you leaving?" />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Pick a time that suits your trip.</p>

            <div className="mt-7 grid gap-3">
              <TimeOption
                label="Now"
                detail="Leave as soon as passengers are found"
                active={useNow}
                onSelect={() => {
                  setUseNow(true);
                  setErrors((e) => ({ ...e, time: undefined }));
                }}
              />
              {suggestions.map((option) => {
                const active = !useNow && departure === option.iso;
                return (
                  <TimeOption
                    key={option.iso}
                    label={option.label}
                    detail={formatDepartureTime(option.iso)}
                    active={active}
                    onSelect={() => {
                      setUseNow(false);
                      setDeparture(option.iso);
                      setErrors((e) => ({ ...e, time: undefined }));
                    }}
                  />
                );
              })}
            </div>

            <div className="mt-7">
              <Label htmlFor="custom-time" className="text-[0.8125rem] font-medium">
                Or choose a custom time
              </Label>
              <Input
                id="custom-time"
                type="datetime-local"
                className="mt-2"
                value={useNow ? "" : toLocalInputValue(new Date(departure))}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  const date = new Date(value);
                  setUseNow(false);
                  setErrors((e) => ({ ...e, time: undefined }));
                  if (!Number.isNaN(date.getTime())) setDeparture(date.toISOString());
                }}
              />
              {errors.time && <FieldError>{errors.time}</FieldError>}
            </div>

            <Button size="lg" className="mt-7 w-full" onClick={continueFromTime}>
              Continue
            </Button>
          </section>
        )}

        {step === "review" && (
          <section className="mt-8">
            <ScreenHeader eyebrow="Ride request" title="Review your ride" />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Check the details before we look for passengers heading your way.
            </p>

            <div className="mt-7">
              <RouteSummary
                origin={origin}
                destination={destination}
                departure={useNow ? new Date().toISOString() : departure}
                routeEstimate={routeEstimate}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                {rideType === "shared" ? "Shared ride" : "Private keke"} · {partySize} {partySize === 1 ? "person" : "people"}
              </p>
              <FareQuote origin={originLoc?.id} dest={destinationLoc?.id} kind={rideType} party={partySize} />
            </div>

            {submitError && (
              <p className="mt-5 rounded-card border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <Button size="lg" className="mt-7 w-full" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <Users />}
              {submitting ? "Creating your request…" : rideType === "shared" ? "Find passengers" : "Save request"}
            </Button>
            <Button variant="secondary" size="lg" className="mt-3 w-full" onClick={() => setStep("route")} disabled={submitting}>
              <Pencil /> Edit
            </Button>

            <div className="mt-7">
              <TrustNote>Only verified FUTA users can be matched with your ride.</TrustNote>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function TimeOption({
  label,
  detail,
  active,
  onSelect,
}: {
  label: string;
  detail: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "selection-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active ? "selection-card-active" : "hover:bg-muted/50",
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-muted">
        <Clock3 className="size-5" strokeWidth={1.75} />
      </span>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <span
        className={cn(
          "grid size-5 place-items-center rounded-full border transition-colors",
          active ? "border-brand bg-brand text-primary-foreground" : "border-border",
        )}
      >
        {active && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

export function RouteSummary({
  origin,
  destination,
  departure,
  meetingPoint,
  routeEstimate,
}: {
  origin: string;
  destination: string;
  departure: string;
  meetingPoint?: string | null;
  routeEstimate?: string | null;
}) {
  return (
    <div className="surface-panel p-5">
      <div className="relative">
        <div className="journey-line" />
        <SummaryRow icon={LocateFixed} label="Current location" value={origin} />
        <div className="ml-14 h-px bg-border" />
        <SummaryRow icon={MapPin} label="Destination" value={destination} />
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
          <Clock3 className="size-[18px]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">Departure time</span>
          <span className="block text-sm font-semibold">{formatDepartureTime(departure)}</span>
        </span>
      </div>
      {routeEstimate && (
        <p className="mt-4 border-t border-border pt-4 text-sm font-semibold text-muted-foreground">
          {routeEstimate}
        </p>
      )}
      {meetingPoint ? (
        <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
          <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-[18px]" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Meeting point</span>
            <span className="block truncate text-sm font-semibold">{meetingPoint}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-3">
      <span className="grid size-9 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block truncate text-[0.9375rem] font-semibold">{value}</span>
      </span>
    </div>
  );
}
