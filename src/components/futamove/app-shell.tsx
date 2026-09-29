import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, CarFront, CircleUserRound, History, Home, MapPinPlus, Wallet } from "lucide-react";
import { Brand } from "./brand";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";

type Role = "student" | "rider";
const nav = {
  student: [
    { label: "Home", to: "/student/home", icon: Home },
    { label: "Rides", to: "/student/rides", icon: CarFront },
    { label: "Activity", to: "/student/activity", icon: Activity },
    { label: "Suggest", to: "/student/suggest-location", icon: MapPinPlus },
    { label: "Profile", to: "/student/profile", icon: CircleUserRound },
  ],
  rider: [
    { label: "Home", to: "/rider/home", icon: Home },
    { label: "History", to: "/rider/trips", icon: History },
    { label: "Wallet", to: "/rider/wallet", icon: Wallet },
    { label: "Suggest", to: "/rider/suggest-location", icon: MapPinPlus },
    { label: "Profile", to: "/rider/profile", icon: CircleUserRound },
  ],
} as const;

export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-background px-5 py-6 lg:flex lg:flex-col">
        <Brand compact />
        <nav className="mt-10 space-y-1">
          {nav[role].map(({ label, to, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                <span>{label}</span>
                {active && <span className="ml-auto h-4 w-1 rounded-full bg-brand" />}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto text-xs leading-5 text-muted-foreground">Built for verified FUTA users.</p>
      </aside>

      <main className="min-h-screen w-full px-4 pb-28 pt-5 sm:px-8 sm:pt-8 lg:ml-64 lg:w-[calc(100%-16rem)] lg:px-10 lg:pb-16 lg:pt-10 xl:px-14">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-2 flex min-h-10 justify-end">
            <NotificationBell role={role} />
          </div>
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-safe shadow-[0_-8px_30px_-24px_var(--foreground)] backdrop-blur-xl lg:hidden">
        <div className={cn("mx-auto grid h-[4.5rem] max-w-app items-center px-1 sm:px-6", nav[role].length === 5 ? "grid-cols-5" : "grid-cols-4")}>
          {nav[role].map(({ label, to, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-medium transition-colors duration-150 min-[390px]:text-[11px]",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active && <span className="absolute top-0 h-[3px] w-9 rounded-b-full bg-brand" />}
                <Icon className="size-[20px]" strokeWidth={active ? 2.25 : 1.75} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
