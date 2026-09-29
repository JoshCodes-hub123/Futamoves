import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { TripError, friendlyTripError } from "./trips";

/**
 * Pricing + rider wallet. Money is always integer kobo; every write goes through
 * database functions that check roles and lock rows. The browser only asks and displays.
 * A future payment gateway should credit wallets through the same server-side ledger path
 * that admin approval uses (wallet_post), never from the browser.
 */
export type FareRule = Tables<"fare_rules">;
export type FareHistory = Tables<"fare_rule_history">;
export type WalletTx = Tables<"wallet_transactions">;
export type FundingRequest = Tables<"wallet_funding_requests">;
export type RideKind = "shared" | "private";

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new TripError(friendlyTripError(error.message));
}

export function naira(kobo: number | null | undefined) {
  if (kobo == null) return "—";
  return `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: kobo % 100 ? 2 : 0 })}`;
}
export function nairaToKobo(input: string): number | null {
  const n = Number(input.replace(/[₦,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n * 100;
}

/* ---------- students ---------- */
export async function quoteFare(origin: string, dest: string, kind: RideKind, party: number) {
  const { data, error } = await supabase.rpc("quote_fare", { p_origin: origin, p_dest: dest, p_ride_type: kind, p_party: party });
  fail(error);
  return data as unknown as { available: boolean; fare_kobo?: number; per_passenger_kobo?: number | null };
}
export async function getTripFare(tripId: string) {
  const { data, error } = await supabase.from("trips").select("fare_kobo,fare_per_passenger_kobo,fare_ride_type,passenger_count").eq("id", tripId).maybeSingle();
  fail(error);
  return data;
}

/* ---------- riders ---------- */
export interface WalletSummary {
  balance_kobo: number; reserved_kobo: number; available_kobo: number; pending_funding_kobo: number;
  service_charge_bps: number; min_funding_kobo: number; max_funding_kobo: number; funding_instructions: string;
}
export async function getWalletSummary(): Promise<WalletSummary> {
  const { data, error } = await supabase.rpc("rider_wallet_summary");
  fail(error);
  return data as unknown as WalletSummary;
}
export async function listMyWalletTx(): Promise<WalletTx[]> {
  const { data, error } = await supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(100);
  fail(error);
  return data ?? [];
}
export async function listMyFunding(): Promise<FundingRequest[]> {
  const { data, error } = await supabase.from("wallet_funding_requests").select("*").order("created_at", { ascending: false }).limit(50);
  fail(error);
  return data ?? [];
}
const RECEIPT_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export async function submitFunding(amountKobo: number, file: File, reference: string, paidAt: string) {
  const ext = RECEIPT_TYPES[file.type];
  if (!ext) throw new TripError("Upload a JPG, PNG, WEBP or PDF receipt.");
  if (file.size > RECEIPT_MAX_BYTES) throw new TripError("The receipt must be 5 MB or smaller.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new TripError("Sign in again to continue.");
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("wallet-receipts").upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw new TripError("We couldn't upload your receipt. Try again.");
  const { error } = await supabase.rpc("rider_submit_funding", { p_amount_kobo: amountKobo, p_receipt_path: path, p_reference: reference, p_paid_at: paidAt || undefined as unknown as string });
  fail(error);
}
export async function receiptUrl(path: string) {
  const { data } = await supabase.storage.from("wallet-receipts").createSignedUrl(path, 120);
  return data?.signedUrl ?? null;
}
export async function chargePreview(tripIds: string[]): Promise<Record<string, { fare_kobo: number | null; charge_kobo: number }>> {
  if (!tripIds.length) return {};
  const { data, error } = await supabase.rpc("rider_charge_preview", { p_trip_ids: tripIds });
  fail(error);
  return Object.fromEntries((data ?? []).map((r) => [r.trip_id, { fare_kobo: r.fare_kobo, charge_kobo: r.charge_kobo }]));
}

/* ---------- admins ---------- */
export async function adminListFares(): Promise<FareRule[]> {
  const { data, error } = await supabase.from("fare_rules").select("*").order("updated_at", { ascending: false });
  fail(error);
  return data ?? [];
}
export async function adminFareHistory(): Promise<FareHistory[]> {
  const { data, error } = await supabase.from("fare_rule_history").select("*").order("created_at", { ascending: false }).limit(200);
  fail(error);
  return data ?? [];
}
export async function adminSaveFare(f: { id?: string; origin?: string; dest?: string; kind?: RideKind; party?: number | null; amountKobo: number; reason: string }) {
  const { error } = await supabase.rpc("admin_save_fare_rule", {
    p_id: f.id ?? (null as unknown as string), p_origin: f.origin ?? (null as unknown as string), p_dest: f.dest ?? (null as unknown as string),
    p_ride_type: f.kind ?? (null as unknown as string), p_party: f.party ?? (null as unknown as number), p_amount_kobo: f.amountKobo, p_reason: f.reason,
  });
  fail(error);
}
export async function adminSetFareActive(id: string, active: boolean, reason: string) {
  const { error } = await supabase.rpc("admin_set_fare_rule_active", { p_id: id, p_active: active, p_reason: reason });
  fail(error);
}
export async function adminGetFinancialSettings() {
  const { data, error } = await supabase.from("financial_settings").select("*").maybeSingle();
  fail(error);
  return data;
}
export async function adminUpdateFinancialSettings(bps: number, instructions: string, minKobo: number, maxKobo: number) {
  const { error } = await supabase.rpc("admin_update_financial_settings", { p_service_charge_bps: bps, p_funding_instructions: instructions, p_min_funding_kobo: minKobo, p_max_funding_kobo: maxKobo });
  fail(error);
}
export async function adminListFunding(): Promise<FundingRequest[]> {
  const { data, error } = await supabase.from("wallet_funding_requests").select("*").order("created_at", { ascending: false }).limit(300);
  fail(error);
  return data ?? [];
}
export async function adminReviewFunding(id: string, approve: boolean, reason: string) {
  const { error } = await supabase.rpc("admin_review_funding", { p_id: id, p_approve: approve, p_reason: reason });
  fail(error);
}
export async function adminRiderWallets() {
  const { data, error } = await supabase.rpc("admin_rider_wallets");
  fail(error);
  return data ?? [];
}
export async function adminRiderTx(riderId: string): Promise<WalletTx[]> {
  const { data, error } = await supabase.from("wallet_transactions").select("*").eq("rider_id", riderId).order("created_at", { ascending: false }).limit(100);
  fail(error);
  return data ?? [];
}
export async function adminWalletAdjust(riderId: string, amountKobo: number, credit: boolean, reason: string) {
  const { error } = await supabase.rpc("admin_wallet_adjust", { p_rider: riderId, p_amount_kobo: amountKobo, p_credit: credit, p_reason: reason });
  fail(error);
}

export const TX_LABEL: Record<string, string> = {
  FUNDING_PENDING: "Funding submitted", FUNDING_APPROVED: "Wallet funding approved", FUNDING_REJECTED: "Funding rejected",
  SERVICE_CHARGE_RESERVED: "Charge reserved for ride", SERVICE_CHARGE_RELEASED: "Reserved charge released", SERVICE_CHARGE: "Ride service charge",
  SERVICE_CHARGE_REVERSAL: "Service charge reversed", ADMIN_CREDIT: "Admin credit", ADMIN_DEBIT: "Admin debit",
};
