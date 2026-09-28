import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, Clock3, CreditCard, FileCheck2, HelpCircle, History, LocateFixed, MapPin, Navigation, Route, Settings, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/futamove/app-shell";
import { FutaMap } from "@/components/futamove/futa-map";
import { EmptyState, FeaturePlaceholder, RowLink, ScreenHeader, SectionHeading, StatusBadge, UserAvatar } from "@/components/futamove/primitives";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/futamove/bottom-sheet";
import { StudentPhoto, useStudentProfile, VerificationBadge, VerificationBanner } from "@/features/student-identity";
import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { StudentCurrentRide } from "@/features/student-current-ride";

function displayName(email?: string | null, metadata?: Record<string, unknown>) { const name = metadata?.["full_name"]; return typeof name === "string" && name.trim() ? name.trim() : email?.split("@")[0] || "Student"; }

export function StudentHomePage() {
  const navigate = useNavigate(); const { user, photoUrl, status } = useStudentProfile(); const name = displayName(user?.email, user?.user_metadata);
  const [originLocationId, setOriginLocationId] = useState<string | null>(null);
  const [destinationLocationId, setDestinationLocationId] = useState<string | null>(null);
  return <AppShell role="student"><ScreenHeader eyebrow="Welcome" title={`Hi, ${name.split(" ")[0]}`} action={<StudentPhoto url={photoUrl} initials={name.slice(0, 2).toUpperCase()} />} /><VerificationBanner status={status} /><section className="mt-10"><h2 className="display-title text-[2.125rem] sm:text-[2.5rem]">Where are you going?</h2><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Find verified FUTA passengers heading in the same direction.</p><button type="button" onClick={() => void navigate({ to: "/student/request" })} aria-label="Plan a ride: choose pickup, destination and time" className="surface-panel mt-7 block w-full p-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="relative"><div className="journey-line" /><LocationField icon={LocateFixed} label="Current location" value="Choose your pickup" /><div className="ml-14 h-px bg-border" /><LocationField icon={MapPin} label="Destination" value="Choose where you're going" /><div className="ml-14 h-px bg-border" /><LocationField icon={Clock3} label="Departure time" value="Pick a time on the next step" /></div></button><Button size="lg" className="mt-6 w-full" onClick={() => void navigate({ to: "/student/request" })}><Navigation /> Find my ride</Button></section><section className="mt-10"><SectionHeading title="FUTA map" /><FutaMap originLocationId={originLocationId} destinationLocationId={destinationLocationId} onOriginChange={setOriginLocationId} onDestinationChange={setDestinationLocationId} /></section><section className="mt-12 space-y-4"><SectionHeading title="Current ride" /><StudentCurrentRide /></section><section className="mt-10"><SectionHeading title="Your requests" /><div className="surface-panel mt-2 p-4"><p className="text-sm text-muted-foreground">Requests that are still searching, and your past rides, are listed in Rides.</p><Button variant="secondary" className="mt-3 w-full" onClick={() => void navigate({ to: "/student/rides" })}><CalendarClock /> Open Rides</Button></div></section></AppShell>;
}
function LocationField({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) { return <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[0.875rem] px-3 py-3"><span className="grid size-9 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border"><Icon className="size-4" strokeWidth={1.75} /></span><span className="min-w-0"><span className="block text-xs font-medium text-muted-foreground">{label}</span><span className="block truncate text-[0.9375rem] font-medium text-muted-foreground">{value}</span></span><ChevronRight className="size-4 text-muted-foreground" /></div>; }
function RideRow({ from, to, time, complete = false }: { from: string; to: string; time: string; complete?: boolean }) { return <div className="flex items-center justify-between gap-4 py-4"><div className="flex min-w-0 items-center gap-3.5"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><Route className="size-[18px]" strokeWidth={1.75} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{from} <span className="text-muted-foreground">→</span> {to}</p><p className="mt-1 text-xs text-muted-foreground">{time}</p></div></div><StatusBadge status={complete ? "Ready" : "Scheduled"} /></div>; }
const studentPlaceholders = { rides: { title: "Your rides", description: "Requested, matched, and completed rides will be organised here.", icon: Navigation }, activity: { title: "No recent activity", description: "Ride updates and verification activity will appear here.", icon: History } } as const;
export function StudentPlaceholderPage({ type }: { type: keyof typeof studentPlaceholders }) { const item = studentPlaceholders[type]; return <AppShell role="student"><ScreenHeader title={type === "rides" ? "Rides" : "Activity"} /><FeaturePlaceholder {...item} /></AppShell>; }
function ProfileIdentity({ initials, name, meta, status }: { initials: string; name: string; meta: string; status: "Verified" | "Pending" }) { return <div className="mt-8 flex items-center gap-4"><UserAvatar initials={initials} /><div className="min-w-0 flex-1"><p className="truncate text-lg font-bold tracking-tight">{name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p></div><StatusBadge status={status} /></div>; }
export function StudentProfilePage() {
  const navigate = useNavigate();
  const { user, profile, photoUrl, status } = useStudentProfile();
  const { theme, setTheme } = useTheme();
  const name = profile.data?.full_name || displayName(user?.email, user?.user_metadata);
  const verifyDesc = status === "verified" ? "FUTA identity verified" : status === "pending" ? "Under review by FUTAMOVE" : status === "rejected" ? "Resubmission required" : "Not submitted yet";

  return (
    <AppShell role="student">
      <ScreenHeader title="Profile" />
      <div className="mt-8 flex items-center gap-4">
        <StudentPhoto url={photoUrl} initials={name.slice(0, 2).toUpperCase()} className="size-16" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold tracking-tight">{name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[profile.data?.matric_number, profile.data?.faculty].filter(Boolean).join(" · ") || user?.email}
          </p>
          <div className="mt-2"><VerificationBadge status={status} /></div>
        </div>
      </div>
      <div className="mt-8 divider-list border-t border-border">
        <RowLink
          icon={ShieldCheck}
          title="Verification"
          description={verifyDesc}
          onClick={() => void navigate({ to: "/verification" })}
        />
        <RowLink
          icon={theme === "dark" ? Sun : Moon}
          title="Appearance"
          description={theme === "dark" ? "Dark mode" : "Light mode"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
        <RowLink icon={HelpCircle} title="Help and safety" />
      </div>
      <Button
        variant="secondary"
        className="mt-8 w-full"
        onClick={async () => {
          await supabase.auth.signOut();
          await navigate({ to: "/login" });
        }}
      >
        Sign out
      </Button>
    </AppShell>
  );
}
export { RiderHomePage, RiderProfilePage } from "@/features/rider-dashboard";
const riderPlaceholders = { requests: { title: "No ride requests", description: "Compatible student requests will appear here when you are online.", icon: FileCheck2 }, trips: { title: "No trips yet", description: "Accepted and completed trips will be organised here.", icon: Route }, wallet: { title: "Wallet and in-app payments are coming soon", description: "FUTAMOVE does not handle payments in the app yet. You can still go online, accept and complete rides as normal without a wallet.", icon: CreditCard } } as const;
export function RiderPlaceholderPage({ type }: { type: keyof typeof riderPlaceholders }) { const item = riderPlaceholders[type]; return <AppShell role="rider"><ScreenHeader title={type.charAt(0).toUpperCase() + type.slice(1)} /><FeaturePlaceholder {...item} /></AppShell>; }

