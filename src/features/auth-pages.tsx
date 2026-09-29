import { PublicShell } from "@/components/futamove/public-shell";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { Brand } from "@/components/futamove/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { claimStudentRole, getMyRole, homeForRole } from "@/services/roles";

function Shell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <PublicShell><h1 className="display-title text-[2.25rem]">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-8">{children}</div></PublicShell>;
}

function Msg({ ok, text }: { ok: boolean; text: string }) {
  return <p role="alert" className={`mt-4 rounded-card border p-3 text-sm ${ok ? "border-border" : "border-destructive/25 bg-destructive/5 text-destructive"}`}>{text}</p>;
}

export async function signOutEverywhere(queryClient: ReturnType<typeof useQueryClient>, navigate: ReturnType<typeof useNavigate>) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
  await navigate({ to: "/login", replace: true });
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMsg({ ok: false, text: "Enter a valid email address." });
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    // Same message either way so the form doesn't reveal which emails have accounts.
    setMsg(error && error.status === 429
      ? { ok: false, text: "Too many attempts. Wait a few minutes and try again." }
      : { ok: true, text: "If an account exists for that email, a password reset link is on its way." });
  }
  return (
    <Shell title="Reset your password" description="Enter the email you sign in with and we'll send you a reset link.">
      <form onSubmit={submit} className="grid gap-3">
        <Label htmlFor="fp-email">Email</Label>
        <Input id="fp-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {msg && <Msg {...msg} />}
        <Button type="submit" size="lg" className="mt-4" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold underline-offset-4 hover:underline">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true); });
    void supabase.auth.getSession().then(({ data: s }) => { if (s.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: "Use at least 8 characters." });
    if (pw !== confirm) return setMsg({ ok: false, text: "The passwords don't match." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    await navigate({ to: homeForRole(await getMyRole().catch(() => null)) });
  }
  return (
    <Shell title="Choose a new password" description={ready ? "Enter your new password below." : "Open this page from the reset link in your email."}>
      {ready && (
        <form onSubmit={submit} className="grid gap-3">
          <Label htmlFor="rp-pw">New password</Label>
          <Input id="rp-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Label htmlFor="rp-confirm">Confirm new password</Label>
          <Input id="rp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {msg && <Msg {...msg} />}
          <Button type="submit" size="lg" className="mt-4" disabled={busy}>Save new password</Button>
        </form>
      )}
    </Shell>
  );
}

export function AccountSetupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function setUpStudent() {
    setBusy(true); setError(null);
    try {
      const role = await claimStudentRole();
      await navigate({ to: homeForRole(role), replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : "Setup failed. Try again."); setBusy(false); }
  }
  return (
    <Shell title="Account setup required" description="Your account doesn't have a FUTAMOVE role yet.">
      <div className="surface-panel flex gap-3 p-4 text-sm leading-6">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <p>If you're a FUTA student, finish setting up your student account below. If you're a keke rider, apply below — the FUTAMOVE team will review your application.</p>
      </div>
      {error && <Msg ok={false} text={error} />}
      <Button size="lg" className="mt-6 w-full" disabled={busy} onClick={() => void setUpStudent()}>Set up my student account</Button>
      <Button variant="secondary" size="lg" className="mt-3 w-full" asChild><Link to="/rider-application">Apply as a keke rider</Link></Button>
      <Button variant="ghost" size="lg" className="mt-3 w-full" onClick={() => void signOutEverywhere(qc, navigate)}>Sign out</Button>
    </Shell>
  );
}
