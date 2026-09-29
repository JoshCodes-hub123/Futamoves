import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "finding", label: "Finding a rider" },
  { key: "assigned", label: "Rider assigned" },
  { key: "arriving", label: "Rider on the way" },
  { key: "picked_up", label: "Pickup confirmed" },
  { key: "in_progress", label: "Ride in progress" },
  { key: "completed", label: "Completed" },
] as const;

/** Display-only: maps an existing trip status to a step index. No lifecycle logic. */
function stepIndex(status: string, riderId?: string | null) {
  switch (status) {
    case "confirmed": return riderId ? 1 : 0;
    case "assigned": case "accepted": return 1;
    case "arriving": return 2;
    case "picked_up": return 3;
    case "in_progress": return 4;
    case "completed": return 5;
    default: return 0;
  }
}

export function JourneyTracker({ status, riderId, className }: { status: string; riderId?: string | null; className?: string }) {
  const current = stepIndex(status, riderId);
  return (
    <ol className={cn("grid gap-0", className)} aria-label="Ride progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-3 pb-3 last:pb-0">
            {i < STEPS.length - 1 && (
              <span aria-hidden className={cn("absolute left-[0.8125rem] top-7 h-[calc(100%-1.5rem)] w-0.5 rounded-full", done ? "bg-brand" : "bg-border")} />
            )}
            <span className={cn(
              "relative z-10 grid size-7 place-items-center rounded-full border-2 text-[0.6875rem] font-bold transition-colors",
              done && "border-brand bg-brand text-primary-foreground",
              active && "border-brand bg-background text-brand-strong ring-4 ring-brand/20",
              !done && !active && "border-border bg-background text-muted-foreground",
            )}>
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("pt-1 text-sm", active ? "font-bold text-foreground" : done ? "font-medium text-foreground" : "text-muted-foreground")}>
              {s.label}
              {active && status !== "completed" && <span className="ml-2 inline-block size-1.5 animate-pulse rounded-full bg-brand align-middle" />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
