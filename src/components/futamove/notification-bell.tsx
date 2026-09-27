import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, LoadingState } from "@/components/futamove/primitives";
import {
  listNotifications,
  markNotificationRead,
  type NotificationRow,
} from "@/services/notifications";

type NotificationRole = "student" | "rider" | "admin";

export function NotificationBell({ role }: { role: NotificationRole }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);
  const queryKey = ["notifications", user?.id];
  const notifications = useQuery({
    queryKey,
    queryFn: listNotifications,
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  const openNotification = async (notification: NotificationRow) => {
    if (workingId) return;
    setWorkingId(notification.id);
    setActionError(false);
    try {
      if (!notification.is_read) await markNotificationRead(notification.id);
      await queryClient.invalidateQueries({ queryKey });
      setOpen(false);
      if (notification.trip_id) {
        if (role === "student") await navigate({ to: "/student/rides" });
        else if (role === "rider") await navigate({ to: "/rider/trips" });
        else await navigate({ to: "/admin/rides" });
      }
    } catch {
      setActionError(true);
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen && user) void notifications.refetch();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-10"
          aria-label={
            notifications.data?.unreadCount
              ? `Notifications, ${notifications.data.unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell className="size-[18px]" strokeWidth={1.8} />
          {!!notifications.data?.unreadCount && (
            <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {notifications.data.unreadCount > 99 ? "99+" : notifications.data.unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))] max-h-[min(28rem,calc(100dvh-6rem))] overflow-y-auto p-0"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <span>Notifications</span>
          {!!notifications.data?.unreadCount && (
            <span className="text-xs font-medium text-muted-foreground">
              {notifications.data.unreadCount} unread
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        {actionError && (
          <div className="p-3">
            <ErrorState message="Couldn't update this notification. Please try again." />
          </div>
        )}
        {notifications.isPending ? (
          <div className="p-3">
            <LoadingState />
          </div>
        ) : notifications.isError ? (
          <div className="p-3">
            <ErrorState message="Notifications are temporarily unavailable. Please try again." />
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={() => void notifications.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : !notifications.data.notifications.length ? (
          <EmptyState
            title="No notifications yet"
            description="Ride and account updates will appear here."
            icon={Bell}
            compact
          />
        ) : (
          <div className="divide-y divide-border">
            {notifications.data.notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={(event) => {
                  event.preventDefault();
                  void openNotification(notification);
                }}
                disabled={!!workingId}
                className="items-start whitespace-normal px-4 py-3 focus:bg-muted/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    {!notification.is_read && (
                      <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                      {notification.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {notification.is_read ? "Read" : "Unread"}
                    </span>
                  </span>
                  <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
                    {notification.body}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
