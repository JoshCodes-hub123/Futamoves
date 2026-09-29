import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Loader2, Plus, Upload, Wallet } from "lucide-react";
import { AppShell } from "@/components/futamove/app-shell";
import { EmptyState, LoadingState, ScreenHeader, SectionHeading } from "@/components/futamove/primitives";
import { AdminFrame } from "@/features/admin-console";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listAllLocations } from "@/services/locations";
import {
  TX_LABEL, adminFareHistory, adminGetFinancialSettings, adminListFares, adminListFunding, adminReviewFunding, adminRiderTx, adminRiderWallets,
  adminSaveFare, adminSetFareActive, adminUpdateFinancialSettings, adminWalletAdjust, chargePreview, getTripFare, getWalletSummary, listMyFunding,
  listMyWalletTx, naira, nairaToKobo, quoteFare, receiptUrl, submitFunding, RECEIPT_MAX_BYTES, type FareRule, type RideKind,
} from "@/services/finance";
import { fmtTime } from "@/services/trips";

const PAY_NOTE = "Payment is made directly to your rider. FUTAMOVE does not currently process passenger payments in-app.";
const box = "rounded-card border border-border bg-card p-4";

/* ---------------- students ---------------- */
export function FareQuote({ origin, dest, kind, party }: { origin?: string; dest?: string; kind: RideKind; party: number }) {
  const q = useQuery({ queryKey: ["quote", origin, dest, kind, party], queryFn: () => quoteFare(origin!, dest!, kind, party), enabled: !!origin && !!dest });
  return (
    <div className={`${box} mt-4`}>
      <p className="section-label">Fare</p>
      {q.isLoading ? <p className="mt-1 text-sm text-muted-foreground">Checking the fare…</p> : q.data?.available ? (
        <>
          <p className="mt-1 text-2xl font-bold">{naira(q.data.fare_kobo)}</p>
          {kind === "shared" && q.data.per_passenger_kobo != null && (
            <p className="text-xs text-muted-foreground">{naira(q.data.per_passenger_kobo)} per passenger · {party} {party === 1 ? "person" : "people"}. The final fare is locked when your group confirms.</p>
          )}
        </>
      ) : <p className="mt-1 text-sm text-muted-foreground">No set fare for this route yet. Agree the fare with your rider.</p>}
      <p className="mt-3 text-sm font-semibold">Payment: pay rider directly by cash or transfer</p>
      <p className="text-xs text-muted-foreground">{PAY_NOTE}</p>
    </div>
  );
}

export function StudentTripFare({ tripId }: { tripId: string }) {
  const q = useQuery({ queryKey: ["trip-fare", tripId], queryFn: () => getTripFare(tripId) });
  if (!q.data) return null;
  return (
    <div className={`${box} mt-4`}>
      {q.data.fare_kobo != null ? (
        <p className="text-base font-bold">Fare: {naira(q.data.fare_kobo)}
          {q.data.fare_ride_type === "shared" && q.data.fare_per_passenger_kobo != null && <span className="ml-2 text-xs font-normal text-muted-foreground">({naira(q.data.fare_per_passenger_kobo)} per passenger)</span>}
        </p>
      ) : <p className="text-sm font-semibold">No set fare for this ride — agree it with your rider.</p>}
      <p className="text-sm">Payment: pay rider directly</p>
      <p className="text-xs text-muted-foreground">{PAY_NOTE}</p>
    </div>
  );
}

/* ---------------- riders ---------------- */
export function RiderChargeLine({ tripId }: { tripId: string }) {
  const p = useQuery({ queryKey: ["charge-preview", tripId], queryFn: () => chargePreview([tripId]) });
  const w = useQuery({ queryKey: ["wallet-summary"], queryFn: getWalletSummary });
  const c = p.data?.[tripId];
  if (!c) return null;
  if (c.fare_kobo == null) return <p className="mt-2 text-xs text-muted-foreground">No set fare — no FUTAMOVE charge on this ride.</p>;
  const enough = (w.data?.available_kobo ?? 0) >= c.charge_kobo;
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-2 text-xs">
      <div><p className="text-muted-foreground">Ride fare</p><p className="font-semibold">{naira(c.fare_kobo)}</p></div>
      <div><p className="text-muted-foreground">Wallet charge</p><p className="font-semibold">{naira(c.charge_kobo)}</p></div>
      <div><p className="text-muted-foreground">Wallet</p><p className={`font-semibold ${enough ? "text-success" : "text-destructive"}`}>{w.data ? `${naira(w.data.available_kobo)} · ${enough ? "Sufficient" : "Too low"}` : "…"}</p></div>
    </div>
  );
}

export function RiderWalletPage() {
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ["wallet-summary"], queryFn: getWalletSummary });
  const tx = useQuery({ queryKey: ["wallet-tx"], queryFn: listMyWalletTx });
  const fr = useQuery({ queryKey: ["wallet-funding"], queryFn: listMyFunding });
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const submit = useMutation({
    mutationFn: async () => {
      const k = nairaToKobo(amount);
      if (!k) throw new Error("Enter a whole-naira amount.");
      if (!file) throw new Error("Upload your payment receipt.");
      await submitFunding(k, file, ref, paidAt);
    },
    onSuccess: () => { setOpen(false); setAmount(""); setRef(""); setFile(null); void qc.invalidateQueries({ queryKey: ["wallet-summary"] }); void qc.invalidateQueries({ queryKey: ["wallet-tx"] }); void qc.invalidateQueries({ queryKey: ["wallet-funding"] }); },
  });
  const d = s.data;
  return (
    <AppShell role="rider">
      <ScreenHeader eyebrow="FUTAMOVE credit" title="Wallet" />
      <p className="mt-3 text-sm text-muted-foreground">Prepaid credit for FUTAMOVE service charges. It isn't passenger money — passengers pay you directly.</p>
      {s.isLoading ? <LoadingState /> : s.error ? <p className="mt-6 text-sm text-destructive">{s.error.message}</p> : d && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className={box}><p className="section-label">Available balance</p><p className="mt-1 text-3xl font-bold">{naira(d.available_kobo)}</p>{d.reserved_kobo > 0 && <p className="text-xs text-muted-foreground">{naira(d.reserved_kobo)} held for your current ride</p>}</div>
            <div className={box}><p className="section-label">Pending funding</p><p className="mt-1 text-3xl font-bold">{naira(d.pending_funding_kobo)}</p><p className="text-xs text-muted-foreground">Awaiting admin confirmation</p></div>
            <div className={box}><p className="section-label">Service charge</p><p className="mt-1 text-3xl font-bold">{d.service_charge_bps / 100}%</p><p className="text-xs text-muted-foreground">of each ride's fare</p></div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Fund your wallet early. Wallet funding requires admin confirmation before the balance becomes available for ride acceptance. You may fund more than the minimum required amount to reduce delays when accepting rides.</p>
          {!open ? <Button size="lg" className="mt-4 w-full sm:w-auto" onClick={() => setOpen(true)}><Plus /> Fund wallet</Button> : (
            <div className={`${box} mt-4 space-y-4`}>
              <SectionHeading title="Fund wallet" />
              <div className="flex flex-wrap gap-2">{[1000, 2000, 5000].map((n) => <Button key={n} type="button" size="sm" variant={amount === String(n) ? "default" : "secondary"} onClick={() => setAmount(String(n))}>{naira(n * 100)}</Button>)}</div>
              <div><Label htmlFor="amt">Amount (₦)</Label><Input id="amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Custom amount" /><p className="mt-1 text-xs text-muted-foreground">Between {naira(d.min_funding_kobo)} and {naira(d.max_funding_kobo)}.</p></div>
              <div className="rounded-md border border-brand/40 bg-brand/5 p-3">
                <p className="text-sm font-semibold">How to pay FUTAMOVE</p>
                {d.funding_instructions.trim() ? <p className="mt-1 whitespace-pre-wrap text-sm">{d.funding_instructions}</p> : <p className="mt-1 text-sm text-muted-foreground">FUTAMOVE hasn't added payment details yet. Please check back later.</p>}
                <p className="mt-2 text-xs text-muted-foreground">Transfer the amount, then upload your receipt below.</p>
              </div>
              <div><Label htmlFor="ref">Transfer reference (optional)</Label><Input id="ref" value={ref} maxLength={120} onChange={(e) => setRef(e.target.value)} /></div>
              <div><Label htmlFor="paid">Payment date</Label><Input id="paid" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
              <div><Label htmlFor="rcpt">Receipt (JPG, PNG, WEBP or PDF, up to {RECEIPT_MAX_BYTES / 1024 / 1024} MB)</Label><Input id="rcpt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              {submit.error && <p className="text-sm text-destructive">{submit.error.message}</p>}
              <div className="flex gap-2">
                <Button onClick={() => submit.mutate()} disabled={submit.isPending || !d.funding_instructions.trim()}>{submit.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Submit funding request</Button>
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </>
      )}
      <div className="mt-8"><SectionHeading title="Funding requests" /></div>
      {fr.isLoading ? <LoadingState /> : fr.data?.length ? (
        <div className="divider-list">{fr.data.map((f) => (
          <div key={f.id} className="flex items-start justify-between gap-3 py-3 text-sm">
            <div><p className="font-semibold">{naira(f.amount_kobo)}</p><p className="text-xs text-muted-foreground">{fmtTime(f.created_at)}{f.rejection_reason ? ` · ${f.rejection_reason}` : ""}</p></div>
            <StatusBadge status={f.status} />
          </div>))}</div>
      ) : <EmptyState icon={Banknote} title="No funding requests" description="Your wallet funding requests will appear here." />}
      <div className="mt-8"><SectionHeading title="Recent transactions" /></div>
      {tx.isLoading ? <LoadingState /> : tx.data?.length ? <TxList rows={tx.data} /> : <EmptyState icon={Wallet} title="No transactions yet" description="Approved funding and ride charges will appear here." />}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "pending" ? "Pending admin confirmation" : status === "approved" ? "Approved" : "Rejected";
  return <Badge variant={status === "approved" ? "success" : status === "rejected" ? "destructive" : "secondary"} className="shrink-0 rounded-full">{label}</Badge>;
}
function TxList({ rows }: { rows: { id: string; type: string; description: string; amount_kobo: number; balance_impact_kobo: number; balance_after_kobo: number; created_at: string }[] }) {
  return (
    <div className="divider-list">{rows.map((t) => (
      <div key={t.id} className="flex items-start justify-between gap-3 py-3 text-sm">
        <div className="min-w-0"><p className="font-semibold">{TX_LABEL[t.type] ?? t.type}</p><p className="break-words text-xs text-muted-foreground">{t.description} · {fmtTime(t.created_at)}</p></div>
        <div className="shrink-0 text-right">
          <p className={`font-semibold ${t.balance_impact_kobo > 0 ? "text-success" : t.balance_impact_kobo < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {t.balance_impact_kobo > 0 ? "+" : t.balance_impact_kobo < 0 ? "−" : ""}{naira(t.balance_impact_kobo === 0 ? t.amount_kobo : Math.abs(t.balance_impact_kobo))}
          </p>
          <p className="text-xs text-muted-foreground">{t.balance_impact_kobo === 0 ? "No balance change" : `Balance ${naira(t.balance_after_kobo)}`}</p>
        </div>
      </div>))}</div>
  );
}

/* ---------------- admin: pricing ---------------- */
export function AdminPricingPage() {
  const qc = useQueryClient();
  const locs = useQuery({ queryKey: ["locations", "all"], queryFn: listAllLocations });
  const fares = useQuery({ queryKey: ["fares"], queryFn: adminListFares });
  const hist = useQuery({ queryKey: ["fare-history"], queryFn: adminFareHistory });
  const name = (id: string) => locs.data?.find((l) => l.id === id)?.name ?? "—";
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["fares"] }); void qc.invalidateQueries({ queryKey: ["fare-history"] }); };
  const [form, setForm] = useState<{ id?: string; origin: string; dest: string; kind: RideKind; party: string; amount: string; reason: string } | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const k = nairaToKobo(form!.amount);
      if (k == null) throw new Error("Enter a whole-naira fare of ₦0 or more.");
      await adminSaveFare(form!.id ? { id: form!.id, amountKobo: k, reason: form!.reason } : { origin: form!.origin, dest: form!.dest, kind: form!.kind, party: form!.kind === "shared" && form!.party ? Number(form!.party) : null, amountKobo: k, reason: form!.reason });
    },
    onSuccess: () => { setForm(null); refresh(); },
  });
  const toggle = useMutation({ mutationFn: (f: FareRule) => adminSetFareActive(f.id, !f.active, f.active ? "Disabled from pricing page" : "Enabled from pricing page"), onSuccess: refresh });
  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const ruleLabel = (r: { ride_type: string; party_size: number | null }) => r.ride_type === "private" ? "Private Keke · per ride" : r.party_size ? `Shared · ${r.party_size} passenger${r.party_size > 1 ? "s" : ""} (total)` : "Shared · per passenger";
  return (
    <AdminFrame title="Pricing" intro="Set passenger fares by route and ride type. Changes apply only to rides confirmed afterwards — confirmed rides keep their locked fare.">
      <FinancialSettingsCard />
      <div className="mt-8 flex items-center justify-between gap-3"><SectionHeading title="Fares" /><Button onClick={() => setForm({ origin: "", dest: "", kind: "shared", party: "", amount: "", reason: "" })}><Plus /> Create new fare</Button></div>
      {form && (
        <div className={`${box} mt-3 grid gap-3 sm:grid-cols-2`}>
          {!form.id && <>
            <div><Label>Pickup</Label><select className={sel} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}><option value="">Choose…</option>{locs.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
            <div><Label>Destination</Label><select className={sel} value={form.dest} onChange={(e) => setForm({ ...form, dest: e.target.value })}><option value="">Choose…</option>{locs.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
            <div><Label>Ride type</Label><select className={sel} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as RideKind, party: "" })}><option value="shared">Shared Keke</option><option value="private">Private Keke</option></select></div>
            {form.kind === "shared" && <div><Label>Pricing</Label><select className={sel} value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })}><option value="">Per passenger (× party size)</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>Fixed total for {n} passenger{n > 1 ? "s" : ""}</option>)}</select></div>}
          </>}
          {form.id && <p className="text-sm sm:col-span-2">Editing {name(form.origin)} → {name(form.dest)}</p>}
          <div><Label>Fare (₦)</Label><Input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><Label>Reason (optional)</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          {save.error && <p className="text-sm text-destructive sm:col-span-2">{save.error.message}</p>}
          <div className="flex gap-2 sm:col-span-2"><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Save fare</Button><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button></div>
        </div>
      )}
      {toggle.error && <p className="mt-2 text-sm text-destructive">{toggle.error.message}</p>}
      {fares.isLoading ? <LoadingState /> : fares.data?.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Origin</th><th>Destination</th><th>Ride type / party</th><th className="text-right">Fare</th><th>Status</th><th>Last updated</th><th /></tr></thead>
            <tbody>{fares.data.map((f) => (
              <tr key={f.id} className="border-t border-border">
                <td className="py-2">{name(f.origin_location_id)}</td><td>{name(f.destination_location_id)}</td><td>{ruleLabel(f)}</td>
                <td className="text-right font-semibold">{naira(f.amount_kobo)}</td>
                <td><Badge variant={f.active ? "success" : "secondary"} className="rounded-full">{f.active ? "Active" : "Disabled"}</Badge></td>
                <td className="text-xs text-muted-foreground">{fmtTime(f.updated_at)}</td>
                <td className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => setForm({ id: f.id, origin: f.origin_location_id, dest: f.destination_location_id, kind: f.ride_type as RideKind, party: String(f.party_size ?? ""), amount: String(f.amount_kobo / 100), reason: "" })}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(f)} disabled={toggle.isPending}>{f.active ? "Disable" : "Enable"}</Button>
                </td>
              </tr>))}</tbody>
          </table>
        </div>
      ) : <EmptyState icon={Banknote} title="No fares yet" description="Create the first fare. Routes without a fare show 'agree the fare with your rider' and carry no FUTAMOVE charge." />}
      <div className="mt-10"><SectionHeading title="Price change history" /></div>
      {hist.data?.length ? (
        <div className="divider-list">{hist.data.map((h) => (
          <div key={h.id} className="py-3 text-sm">
            <p className="font-semibold">{name(h.origin_location_id)} → {name(h.destination_location_id)} · {ruleLabel(h)}</p>
            <p className="text-xs text-muted-foreground">{h.action.replace("_", " ")}: {h.previous_amount_kobo != null ? `${naira(h.previous_amount_kobo)} → ` : ""}{naira(h.new_amount_kobo)} · {fmtTime(h.created_at)}{h.reason ? ` · ${h.reason}` : ""}</p>
          </div>))}</div>
      ) : <p className="text-sm text-muted-foreground">No changes yet.</p>}
    </AdminFrame>
  );
}

function FinancialSettingsCard() {
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ["financial-settings"], queryFn: adminGetFinancialSettings });
  const [v, setV] = useState<{ pct: string; instr: string; min: string; max: string } | null>(null);
  const cur = v ?? (s.data ? { pct: String(s.data.service_charge_bps / 100), instr: s.data.funding_instructions, min: String(s.data.min_funding_kobo / 100), max: String(s.data.max_funding_kobo / 100) } : null);
  const save = useMutation({
    mutationFn: async () => {
      const bps = Math.round(Number(cur!.pct) * 100);
      const min = nairaToKobo(cur!.min), max = nairaToKobo(cur!.max);
      if (!Number.isFinite(bps) || min == null || max == null) throw new Error("Check the numbers.");
      await adminUpdateFinancialSettings(bps, cur!.instr, min, max);
    },
    onSuccess: () => { setV(null); void qc.invalidateQueries({ queryKey: ["financial-settings"] }); },
  });
  if (!cur) return <LoadingState />;
  return (
    <div className={`${box} grid gap-3 sm:grid-cols-3`}>
      <div><Label>Rider service charge (%)</Label><Input inputMode="decimal" value={cur.pct} onChange={(e) => setV({ ...cur, pct: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Applies to rides accepted after saving.</p></div>
      <div><Label>Minimum funding (₦)</Label><Input inputMode="numeric" value={cur.min} onChange={(e) => setV({ ...cur, min: e.target.value })} /></div>
      <div><Label>Maximum funding (₦)</Label><Input inputMode="numeric" value={cur.max} onChange={(e) => setV({ ...cur, max: e.target.value })} /></div>
      <div className="sm:col-span-3"><Label>Wallet funding instructions (bank name, account name, account number)</Label><Textarea rows={3} value={cur.instr} onChange={(e) => setV({ ...cur, instr: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Only shown to signed-in riders inside the Fund wallet form.</p></div>
      {save.error && <p className="text-sm text-destructive sm:col-span-3">{save.error.message}</p>}
      <div className="sm:col-span-3"><Button onClick={() => save.mutate()} disabled={save.isPending || !v}>Save settings</Button></div>
    </div>
  );
}

/* ---------------- admin: wallet funding ---------------- */
export function AdminWalletFundingPage() {
  const qc = useQueryClient();
  const reqs = useQuery({ queryKey: ["admin-funding"], queryFn: adminListFunding });
  const wallets = useQuery({ queryKey: ["admin-wallets"], queryFn: adminRiderWallets });
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
  const [viewRider, setViewRider] = useState<string | null>(null);
  const [adj, setAdj] = useState({ amount: "", reason: "" });
  const nameOf = (id: string | null) => wallets.data?.find((w) => w.rider_id === id)?.full_name ?? "Rider";
  const refresh = () => ["admin-funding", "admin-wallets", "admin-rider-tx"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
  const review = useMutation({ mutationFn: (a: { id: string; approve: boolean; reason: string }) => adminReviewFunding(a.id, a.approve, a.reason), onSuccess: () => { setRejecting(null); refresh(); } });
  const tx = useQuery({ queryKey: ["admin-rider-tx", viewRider], queryFn: () => adminRiderTx(viewRider!), enabled: !!viewRider });
  const adjust = useMutation({
    mutationFn: async (credit: boolean) => { const k = nairaToKobo(adj.amount); if (!k) throw new Error("Enter a whole-naira amount."); await adminWalletAdjust(viewRider!, k, credit, adj.reason); },
    onSuccess: () => { setAdj({ amount: "", reason: "" }); refresh(); },
  });
  const open = async (path: string) => { const u = await receiptUrl(path); if (u) window.open(u, "_blank", "noopener"); };
  const rows = (reqs.data ?? []).filter((r) => r.status === filter);
  return (
    <AdminFrame title="Wallet funding" intro="Approve rider wallet funding only after confirming the money arrived. Approval credits the wallet exactly once.">
      <div className="flex flex-wrap gap-2">{(["pending", "approved", "rejected"] as const).map((s) => (
        <Button key={s} size="sm" variant={filter === s ? "default" : "secondary"} onClick={() => setFilter(s)}>{s[0].toUpperCase() + s.slice(1)} ({(reqs.data ?? []).filter((r) => r.status === s).length})</Button>))}</div>
      {review.error && <p className="mt-3 text-sm text-destructive">{review.error.message}</p>}
      {reqs.isLoading ? <LoadingState /> : rows.length ? (
        <div className="divider-list mt-3">{rows.map((r) => (
          <div key={r.id} className="py-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{nameOf(r.rider_id)} · {naira(r.amount_kobo)}</p>
                <p className="text-xs text-muted-foreground">Submitted {fmtTime(r.created_at)}{r.paid_at ? ` · paid ${r.paid_at}` : ""}{r.payer_reference ? ` · ref ${r.payer_reference}` : ""}</p>
                {r.reviewed_at && <p className="text-xs text-muted-foreground">Reviewed {fmtTime(r.reviewed_at)}{r.rejection_reason ? ` · ${r.rejection_reason}` : ""}</p>}
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void open(r.receipt_path)}>View receipt</Button>
              <Button size="sm" variant="ghost" onClick={() => setViewRider(r.rider_id)}>View wallet</Button>
              {r.status === "pending" && <>
                <Button size="sm" onClick={() => review.mutate({ id: r.id, approve: true, reason: "" })} disabled={review.isPending}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejecting({ id: r.id, reason: "" })}>Reject</Button>
              </>}
            </div>
            {rejecting?.id === r.id && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input placeholder="Reason, e.g. Receipt could not be verified." value={rejecting.reason} onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })} />
                <Button size="sm" variant="destructive" disabled={!rejecting.reason.trim() || review.isPending} onClick={() => review.mutate({ id: r.id, approve: false, reason: rejecting.reason })}>Confirm reject</Button>
              </div>
            )}
          </div>))}</div>
      ) : <EmptyState icon={Banknote} title={`No ${filter} requests`} description="Rider funding requests will appear here." />}

      <div className="mt-10"><SectionHeading title="Rider wallets" /></div>
      {wallets.data?.length ? (
        <div className="divider-list">{wallets.data.map((w) => (
          <button key={w.rider_id} type="button" onClick={() => setViewRider(w.rider_id)} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:bg-muted/40">
            <span className="font-semibold">{w.full_name}</span>
            <span className="text-xs text-muted-foreground">Balance {naira(w.balance_kobo)} · held {naira(w.reserved_kobo)} · pending {naira(w.pending_kobo)}</span>
          </button>))}</div>
      ) : <p className="text-sm text-muted-foreground">No approved riders.</p>}
      {viewRider && (
        <div className={`${box} mt-4`}>
          <div className="flex items-center justify-between"><SectionHeading title={`${nameOf(viewRider)} — transactions`} /><Button size="sm" variant="ghost" onClick={() => setViewRider(null)}>Close</Button></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto]">
            <Input placeholder="Amount (₦)" inputMode="numeric" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} />
            <Input placeholder="Reason (required)" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
            <Button size="sm" variant="secondary" disabled={!adj.reason.trim() || adjust.isPending} onClick={() => adjust.mutate(true)}>Credit</Button>
            <Button size="sm" variant="secondary" disabled={!adj.reason.trim() || adjust.isPending} onClick={() => adjust.mutate(false)}>Debit</Button>
          </div>
          {adjust.error && <p className="mt-2 text-sm text-destructive">{adjust.error.message}</p>}
          {tx.isLoading ? <LoadingState /> : tx.data?.length ? <TxList rows={tx.data} /> : <p className="mt-3 text-sm text-muted-foreground">No transactions yet.</p>}
        </div>
      )}
    </AdminFrame>
  );
}
