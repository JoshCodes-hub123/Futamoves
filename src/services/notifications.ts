import { supabase } from "@/integrations/supabase/client";

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  trip_id: string | null;
  is_read: boolean;
  created_at: string;
}

type QueryResult<T> = PromiseLike<{
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}>;

interface NotificationFilterQuery {
  eq(column: "is_read", value: false): QueryResult<never[]>;
  order(
    column: "created_at",
    options: { ascending: boolean },
  ): {
    limit(count: number): QueryResult<NotificationRow[]>;
  };
}

interface NotificationClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
  from(table: "notifications"): {
    select(
      columns: string,
      options?: { count?: "exact"; head?: boolean },
    ): {
      eq(column: "recipient_id", value: string): NotificationFilterQuery;
    };
  };
  rpc(
    functionName: "mark_notification_read",
    args: { p_notification_id: string },
  ): QueryResult<boolean>;
}

const notificationClient = supabase as unknown as NotificationClient;

export async function listNotifications(): Promise<{
  notifications: NotificationRow[];
  unreadCount: number;
}> {
  const { data: authData, error: authError } = await notificationClient.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Notifications are temporarily unavailable.");
  }
  const recipientId = authData.user.id;

  const [notificationsResult, unreadResult] = await Promise.all([
    notificationClient
      .from("notifications")
      .select("id,title,body,trip_id,is_read,created_at")
      .eq("recipient_id", recipientId)
      .order("created_at", { ascending: false })
      .limit(20),
    notificationClient
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", recipientId)
      .eq("is_read", false),
  ]);

  if (notificationsResult.error || unreadResult.error) {
    throw new Error("Notifications are temporarily unavailable.");
  }

  return {
    notifications: notificationsResult.data ?? [],
    unreadCount: unreadResult.count ?? 0,
  };
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await notificationClient.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw new Error("Couldn't update this notification.");
}
