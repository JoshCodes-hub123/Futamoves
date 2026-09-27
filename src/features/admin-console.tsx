import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { signOutEverywhere } from "@/features/auth-pages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, MapPin, Pencil, Plus, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/futamove/brand";
import { NotificationBell } from "@/components/futamove/notification-bell";
import { EmptyState, LoadingState } from "@/components/futamove/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin } from "@/services/student-profile";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  LOCATION_TYPES,
  listAllLocations,
  locationImageSrc,
  saveLocation,
  setLocationActive,
  uploadLocationImage,
  type FutaLocation,
  type LocationCategory,
} from "@/services/locations";

export function AdminNav() {
  const link = "rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground";
  const active = { className: `${link} bg-muted text-foreground font-medium` };
  return (
    <nav className="mt-6 flex flex-wrap gap-1" aria-label="Admin sections">
      <Link to="/admin" className={link} activeProps={active} activeOptions={{ exact: true }}>Overview</Link>
      <Link to="/admin/verification" className={link} activeProps={active}>Verification</Link>
      <Link to="/admin/locations" className={link} activeProps={active}>Locations</Link>
      <Link to="/admin/location-suggestions" className={link} activeProps={active}>Location Suggestions</Link>
      <Link to="/admin/rides" className={link} activeProps={active}>Rides</Link>
      <Link to="/admin/dispatch" className={link} activeProps={active}>Dispatch</Link>
      <Link to="/admin/riders" className={link} activeProps={active}>Riders</Link>
      <Link to="/admin/settings" className={link} activeProps={active}>Settings</Link>
    </nav>
  );
}

export function AdminFrame({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const admin = useQuery({ queryKey: ["am-admin"], queryFn: amIAdmin });
  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Brand compact />
          <div className="flex items-center gap-2">
            {admin.data === true && <NotificationBell role="admin" />}
            <SignOutButton />
          </div>
        </header>
        <AdminNav />
        <h1 className="display-title mt-8 text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
        <div className="mt-8">
          {admin.isLoading ? <LoadingState /> : admin.data !== true
            ? <EmptyState title="Administrators only" description="Your account doesn't have access to this section." icon={ShieldCheck} />
            : children}
        </div>
      </div>
    </main>
  );
}

/* ---------------- Locations ---------------- */

type FormState = {
  name: string; official_name: string; category: LocationCategory; location_type: string; description: string;
  latitude: string; longitude: string; google_place_id: string; image_url: string; active: boolean; display_order: string;
};
const emptyForm: FormState = { name: "", official_name: "", category: "GATE", location_type: "gate", description: "", latitude: "", longitude: "", google_place_id: "", image_url: "", active: true, display_order: "0" };
const toForm = (l: FutaLocation): FormState => ({
  name: l.name, official_name: l.official_name ?? "", category: l.category, location_type: l.location_type, description: l.description ?? "",
  latitude: l.latitude?.toString() ?? "", longitude: l.longitude?.toString() ?? "", google_place_id: l.google_place_id ?? "",
  image_url: l.image_url ?? "", active: l.active, display_order: String(l.display_order),
});

function LocationImage({ src }: { src: string | null }) {
  const q = useQuery({ queryKey: ["loc-img", src], queryFn: () => locationImageSrc(src), enabled: Boolean(src), staleTime: 300_000 });
  if (!src) return <div className="grid size-14 place-items-center rounded-lg bg-muted"><MapPin className="size-5 text-muted-foreground" /></div>;
  return q.data ? <img src={q.data} alt="" className="size-14 rounded-lg object-cover" /> : <div className="size-14 animate-pulse rounded-lg bg-muted" />;
}

function LocationForm({ initial, id, onDone }: { initial: FormState; id: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setF(initial), [initial]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    setError(null);
    if (!f.name.trim()) return setError("Name is required.");
    const lat = f.latitude.trim() ? Number(f.latitude) : null;
    const lng = f.longitude.trim() ? Number(f.longitude) : null;
    if ((lat === null) !== (lng === null)) return setError("Enter both latitude and longitude, or neither.");
    if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) return setError("Latitude must be between -90 and 90.");
    if (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180)) return setError("Longitude must be between -180 and 180.");
    const order = Number.parseInt(f.display_order, 10);
    setBusy(true);
    try {
      await saveLocation(id, {
        name: f.name.trim(), official_name: f.official_name.trim() || null, category: f.category, location_type: f.location_type,
        description: f.description.trim() || null, latitude: lat, longitude: lng, google_place_id: f.google_place_id.trim() || null,
        image_url: f.image_url.trim() || null, active: f.active, display_order: Number.isNaN(order) ? 0 : order,
      });
      await qc.invalidateQueries({ queryKey: ["locations"] });
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setError(msg.includes("locations_name_unique") ? "A location with this name already exists." : msg);
    } finally { setBusy(false); }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    try { set("image_url", await uploadLocationImage(file)); } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
  }

  const field = (k: keyof FormState, label: string, props: Record<string, string> = {}) => (
    <div><Label htmlFor={`loc-${k}`} className="text-xs">{label}</Label>
      <Input id={`loc-${k}`} className="mt-1" value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} {...props} /></div>
  );
  const selectCls = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="surface-panel grid gap-4 p-5 sm:grid-cols-2">
      {field("name", "Student-facing name *")}
      {field("official_name", "Official name (only if confirmed)")}
      <div><Label htmlFor="loc-category" className="text-xs">Category</Label>
        <select id="loc-category" className={selectCls} value={f.category} onChange={(e) => set("category", e.target.value as LocationCategory)}>
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select></div>
      <div><Label htmlFor="loc-type" className="text-xs">Location type</Label>
        <select id="loc-type" className={selectCls} value={f.location_type} onChange={(e) => set("location_type", e.target.value)}>
          {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select></div>
      {field("latitude", "Latitude", { inputMode: "decimal", placeholder: "Leave empty until verified" })}
      {field("longitude", "Longitude", { inputMode: "decimal", placeholder: "Leave empty until verified" })}
      {field("google_place_id", "Google Maps Place ID")}
      {field("display_order", "Display order", { inputMode: "numeric" })}
      <div className="sm:col-span-2"><Label htmlFor="loc-description" className="text-xs">Description</Label>
        <Textarea id="loc-description" className="mt-1" value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <LocationImage src={f.image_url || null} />
        <div className="grid gap-1">
          <Label htmlFor="loc-image" className="text-xs">Location image (optional)</Label>
          <input id="loc-image" type="file" accept="image/*" className="text-xs" onChange={(e) => void upload(e.target.files?.[0])} />
          {f.image_url && <button type="button" className="text-left text-xs text-destructive" onClick={() => set("image_url", "")}>Remove image</button>}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active (visible to students)
      </label>
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button disabled={busy} onClick={() => void submit()}>{id ? "Save changes" : "Add location"}</Button>
        <Button variant="secondary" disabled={busy} onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

function LocationsManager() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["locations", "all"], queryFn: listAllLocations });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(l: FutaLocation) {
    setError(null);
    try { await setLocationActive(l.id, !l.active); await qc.invalidateQueries({ queryKey: ["locations"] }); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  }

  if (q.isLoading) return <LoadingState />;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const all = q.data ?? [];
  return (
    <div className="grid gap-8">
      {editing === "new" ? <LocationForm initial={emptyForm} id={null} onDone={() => setEditing(null)} />
        : <Button className="w-fit" onClick={() => setEditing("new")}><Plus /> Add location</Button>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {CATEGORY_ORDER.map((cat) => {
        const items = all.filter((l) => l.category === cat);
        return (
          <section key={cat}>
            <h2 className="section-label">{CATEGORY_LABELS[cat]} · {items.length}</h2>
            <div className="mt-2 divide-y divide-border border-t border-border">
              {items.map((l) => editing === l.id
                ? <div key={l.id} className="py-4"><LocationForm initial={toForm(l)} id={l.id} onDone={() => setEditing(null)} /></div>
                : (
                  <div key={l.id} className="flex items-center gap-4 py-3">
                    <LocationImage src={l.image_url} />
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${l.active ? "" : "text-muted-foreground line-through"}`}>{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.location_type.replace("_", " ")} · order {l.display_order}
                        {l.official_name ? ` · ${l.official_name}` : ""}
                        {l.latitude !== null ? ` · ${l.latitude}, ${l.longitude}` : " · no coordinates yet"}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(l.id)}><Pencil /> Edit</Button>
                    <Button size="sm" variant={l.active ? "secondary" : "default"} onClick={() => void toggle(l)}>{l.active ? "Deactivate" : "Activate"}</Button>
                  </div>
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function AdminLocationsPage() {
  return (
    <AdminFrame title="Location management" intro="The approved FUTAMOVE locations. Every active location can be used as both current location and destination. Deactivated locations disappear from new requests but past rides keep their details.">
      <LocationsManager />
    </AdminFrame>
  );
}

/* ---------------- Settings: change password ---------------- */

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    if (next.length < 8) return setMsg({ ok: false, text: "Use at least 8 characters." });
    if (next !== confirm) return setMsg({ ok: false, text: "The new passwords don't match." });
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email;
      if (!email) throw new Error("You need to be signed in.");
      // Re-confirm identity with the current password before changing it.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current });
      if (signInError) throw new Error("Your current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw new Error(error.message);
      setCurrent(""); setNext(""); setConfirm("");
      setMsg({ ok: true, text: "Your password has been changed." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Password change failed." });
    } finally { setBusy(false); }
  }

  return (
    <section className="surface-panel max-w-md p-5">
      <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="size-4" /> Change password</h2>
      <div className="mt-4 grid gap-3">
        <div><Label htmlFor="pw-current" className="text-xs">Current password</Label><Input id="pw-current" type="password" autoComplete="current-password" className="mt-1" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
        <div><Label htmlFor="pw-new" className="text-xs">New password</Label><Input id="pw-new" type="password" autoComplete="new-password" className="mt-1" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <div><Label htmlFor="pw-confirm" className="text-xs">Confirm new password</Label><Input id="pw-confirm" type="password" autoComplete="new-password" className="mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        {msg && <p role="alert" className={`text-sm ${msg.ok ? "text-foreground" : "text-destructive"}`}>{msg.text}</p>}
        <Button disabled={busy || !current || !next} onClick={() => void submit()}>Change password</Button>
      </div>
    </section>
  );
}

export function AdminSettingsPage() {
  return (
    <AdminFrame title="Settings" intro="Manage your administrator account.">
      <ChangePassword />
    </AdminFrame>
  );
}

export function SignOutButton() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return <button type="button" onClick={() => void signOutEverywhere(qc, navigate)} className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>;
}
