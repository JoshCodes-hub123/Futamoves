import type { LucideIcon } from "lucide-react";
import { AlertCircle, ChevronRight, Inbox, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ScreenHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="section-label mb-1.5">{eyebrow}</p>}
        <h1 className="text-balance break-words font-display text-[1.75rem] font-bold uppercase leading-[0.95] text-foreground min-[380px]:text-[2rem] sm:text-[2.25rem]">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function UserAvatar({ initials = "FA" }: { initials?: string }) {
  return (
    <Avatar className="size-11 ring-1 ring-border">
      <AvatarFallback className="bg-dark-surface text-sm font-bold text-dark-foreground">{initials}</AvatarFallback>
    </Avatar>
  );
}

export function StatusBadge({ status }: { status: "Verified" | "Pending" | "Ready" | "Scheduled" | "Offline" | "Online" }) {
  const style = status === "Verified" || status === "Ready" || status === "Online" ? "success" : status === "Pending" ? "warning" : "outline";
  return (
    <Badge variant={style} className="gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold">
      <span className={cn("size-1.5 rounded-full", style === "success" ? "bg-success" : style === "warning" ? "bg-warning" : "bg-muted-foreground")} />
      {status}
    </Badge>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false }: { icon?: LucideIcon; title: string; description: string; action?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-10" : "py-16")}>
      <div className="mb-4 grid size-11 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </div>
      <h2 className="text-[0.9375rem] font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-[17rem] text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "Check your connection and try again." }: { message?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-destructive/25 bg-destructive/5 p-4">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" strokeWidth={1.75} />
      <div>
        <p className="text-sm font-semibold">Couldn’t load this yet</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive"><AlertCircle className="size-3.5" />{children}</p>;
}

export function LoadingState() {
  return (
    <div className="space-y-3" aria-label="Loading">
      <Skeleton className="h-28 w-full rounded-card" />
      <Skeleton className="h-20 w-full rounded-card" />
      <Skeleton className="h-20 w-full rounded-card" />
    </div>
  );
}

export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
      <h2 className="section-label truncate">{title}</h2>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

export function TrustNote({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-px size-4 shrink-0 text-brand-strong" />{children}</div>;
}

export function RowLink({ icon: Icon, title, description, onClick }: { icon: LucideIcon; title: string; description?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-lg px-1 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-foreground"><Icon className="size-[18px]" strokeWidth={1.75} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        {description && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export function FeaturePlaceholder({ title, description, icon }: { title: string; description: string; icon?: LucideIcon }) {
  return (
    <div className="surface-panel mt-8">
      <EmptyState title={title} description={description} {...(icon ? { icon } : {})} />
    </div>
  );
}
