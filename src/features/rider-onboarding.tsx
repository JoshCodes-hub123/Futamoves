import { PublicShell } from "@/components/futamove/public-shell";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bike, Camera, CircleAlert, Clock3, IdCard, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Brand } from "@/components/futamove/brand";
import { LoadingState, TrustNote } from "@/components/futamove/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ImagePicker } from "@/features/verification";
import { signOutEverywhere } from "@/features/auth-pages";
import { useAuth } from "@/hooks/use-auth";
import { getMyRiderApplication, RIDER_STATUS_LABEL, submitRiderApplication, validateRiderImage } from "@/services/riders";

function Shell({ children, back }: { children: React.ReactNode; back?: string }) {
  return <PublicShell back={back} step="Rider registration">{children}</PublicShell>;
}

function Err({ text }: { text: string | null }) {
  return text ? <p role="alert" className="mt-5 rounded-card border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{text}</p> : null;
}

function IconField({ id, label, icon: Icon, ...props }: { id: string; label: string; icon: typeof Mail } & React.ComponentProps<"input">) {
  return <div><Label htmlFor={id} className="text-[0.8125rem] font-medium">{label}</Label><div className="relative mt-2"><Icon className="field-icon" strokeWidth={1.75} /><Input id={id} className="pl-11" {...props} /></div></div>;
}

/** Step 1: create the sign-in account. No role is granted here. */
export function RiderSignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 8) return setError("Enter your name, a valid email, and a password of at least 8 characters.");
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
      if (authError) return setError(authError.message);
      if (!data.session) return setError("Your account was created. Please sign in to continue your rider application.");
      await navigate({ to: "/rider-application" });
    } catch (err) { setError(err instanceof Error ? err.message : "We couldn't create your account."); }
    finally { setLoading(false); }
  }
  return (
    <Shell back="/">
      <h1 className="display-title text-[2rem]">Register as a rider</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">For keke riders working around FUTA. You don't need to be a student. First create your sign-in, then tell us about you and your keke.</p>
      <form onSubmit={submit} className="mt-9 space-y-5">
        <IconField id="r-name" label="Full name" icon={UserRound} placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
        <IconField id="r-email" label="Email" icon={Mail} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <IconField id="r-pw" label="Password" icon={LockKeyhole} type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Err text={error} />
        <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? "Creating account…" : "Continue"}</Button>
      </form>
      <div className="mt-6"><TrustNote>FUTAMOVE reviews every rider before they can operate.</TrustNote></div>
      <p className="mt-7 text-center text-sm text-muted-foreground">Already registered? <Link to="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">Sign in</Link></p>
    </Shell>
  );
}

type Errors = Partial<Record<"fullName" | "phone" | "avatar" | "idDoc" | "vehicle" | "vehiclePhoto", string>>;

function ApplicationForm({ defaultName, onDone }: { defaultName: string; onDone: () => void }) {
  const [fullName, setFullName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setFullName((v) => v || defaultName); }, [defaultName]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setFormError(null);
    const next: Errors = {};
    if (fullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (!/^\+?[0-9 ()-]{7,20}$/.test(phone.trim())) next.phone = "Enter a valid phone number.";
    const a = validateRiderImage(avatar, "profile photo", true); if (a) next.avatar = a;
    const i = validateRiderImage(idDoc, "ID document photo", false); if (i) next.idDoc = i;
    const v = validateRiderImage(vehiclePhoto, "keke photo", false); if (v) next.vehiclePhoto = v;
    if (vehicle.trim().length < 2) next.vehicle = "Describe your keke (for example colour and make).";
    setErrors(next);
    if (Object.keys(next).length || !avatar) return;
    setBusy(true);
    try {
      await submitRiderApplication({ fullName: fullName.trim(), phone: phone.trim(), avatar, idType, idNumber, idDocument: idDoc, vehicleDescription: vehicle.trim(), plateNumber: plate, vehiclePhoto });
      onDone();
    } catch (err) { setFormError(err instanceof Error ? err.message : "We couldn't submit your application."); }
    finally { setBusy(false); }
  }

  const fe = (k: keyof Errors) => errors[k] ? <p className="mt-1.5 text-xs text-destructive">{errors[k]}</p> : null;
  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-4">
        <p className="section-label">About you</p>
        <div><Label htmlFor="ra-name">Full name</Label><Input id="ra-name" className="mt-2" value={fullName} onChange={(e) => setFullName(e.target.value)} />{fe("fullName")}</div>
        <div><Label htmlFor="ra-phone">Phone number</Label><Input id="ra-phone" type="tel" autoComplete="tel" className="mt-2" placeholder="080..." value={phone} onChange={(e) => setPhone(e.target.value)} />{fe("phone")}</div>
        <ImagePicker id="ra-photo" label="Profile photo" hint="A clear photo of your face" icon={Camera} file={avatar} onChange={setAvatar} error={errors.avatar} round />
      </section>
      <section className="space-y-4">
        <p className="section-label">Identification (optional)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="ra-idtype">ID type</Label><Input id="ra-idtype" className="mt-2" placeholder="e.g. NIN, driver's licence" value={idType} onChange={(e) => setIdType(e.target.value)} /></div>
          <div><Label htmlFor="ra-idnum">ID number</Label><Input id="ra-idnum" className="mt-2" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} /></div>
        </div>
        <ImagePicker id="ra-iddoc" label="Photo of ID" hint="Optional" icon={IdCard} file={idDoc} onChange={setIdDoc} error={errors.idDoc} />
      </section>
      <section className="space-y-4">
        <p className="section-label">Your keke</p>
        <div><Label htmlFor="ra-vehicle">Keke description</Label><Input id="ra-vehicle" className="mt-2" placeholder="e.g. Yellow Bajaj RE" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />{fe("vehicle")}</div>
        <div><Label htmlFor="ra-plate">Plate / registration number (optional)</Label><Input id="ra-plate" className="mt-2" value={plate} onChange={(e) => setPlate(e.target.value)} /></div>
        <ImagePicker id="ra-kekephoto" label="Photo of your keke" hint="Optional" icon={Bike} file={vehiclePhoto} onChange={setVehiclePhoto} error={errors.vehiclePhoto} />
      </section>
      <Err text={formError} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Submitting…" : "Submit rider application"}</Button>
    </form>
  );
}

/** Step 2 and status: form when there is no live application, otherwise the current status. */
export function RiderApplicationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const app = useQuery({ queryKey: ["my-rider-application", user?.id], queryFn: getMyRiderApplication, enabled: !!user });
  const [reapply, setReapply] = useState(false);
  const meta = user?.user_metadata?.["full_name"];
  const status = app.data?.status;

  let body: React.ReactNode;
  if (app.isLoading || !user) body = <LoadingState />;
  else if (!app.data || (status === "rejected" && reapply)) {
    body = <>
      <h1 className="display-title text-[2rem]">Rider application</h1>
      <p className="mt-3 mb-8 text-sm leading-6 text-muted-foreground">FUTAMOVE will review these details before you can take ride requests.</p>
      <ApplicationForm defaultName={app.data?.full_name ?? (typeof meta === "string" ? meta : "")} onDone={() => { setReapply(false); void qc.invalidateQueries({ queryKey: ["my-rider-application"] }); }} />
    </>;
  } else {
    const Icon = status === "pending" ? Clock3 : status === "approved" ? ShieldCheck : CircleAlert;
    const text = status === "pending" ? "Thanks — your application is with the FUTAMOVE team. You can sign in any time to check this page. You can't take rides until you're approved."
      : status === "approved" ? "You're an approved FUTAMOVE rider."
      : status === "suspended" ? "Your rider account is currently suspended. Please contact FUTAMOVE support."
      : "Your rider application wasn't approved.";
    body = <>
      <h1 className="display-title text-[2rem]">{RIDER_STATUS_LABEL[status!]}</h1>
      <div className={`mt-6 flex gap-3 rounded-card border p-4 text-sm leading-6 ${status === "suspended" || status === "rejected" ? "border-destructive/25 bg-destructive/5" : "border-border"}`}>
        <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} /><p>{text}</p>
      </div>
      {app.data.rejection_reason && (status === "rejected" || status === "suspended") && <p className="mt-4 text-sm"><span className="font-semibold">Reason:</span> {app.data.rejection_reason}</p>}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Name</dt><dd>{app.data.full_name}</dd>
        <dt className="text-muted-foreground">Keke</dt><dd>{app.data.vehicle_description}{app.data.plate_number ? ` · ${app.data.plate_number}` : ""}</dd>
        <dt className="text-muted-foreground">Submitted</dt><dd>{new Date(app.data.created_at).toLocaleDateString()}</dd>
      </dl>
      {status === "approved" && <Button asChild size="lg" className="mt-8 w-full"><Link to="/rider/home">Go to rider dashboard</Link></Button>}
      {status === "rejected" && <Button size="lg" className="mt-8 w-full" onClick={() => setReapply(true)}>Apply again</Button>}
    </>;
  }
  return (
    <Shell>
      {body}
      <Button variant="secondary" size="lg" className="mt-3 w-full" onClick={() => void signOutEverywhere(qc, navigate)}>Sign out</Button>
    </Shell>
  );
}
