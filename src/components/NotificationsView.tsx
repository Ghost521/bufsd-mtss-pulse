import React, { useMemo, useState } from "react";
import { Archive, Bell, Check, Trash2, X } from "lucide-react";
import type { NotificationListItem } from "../types";
import { Button } from "./ui/Button";

type NotificationsBucket = "active" | "archived" | "trash";
type ActiveFilter = "all" | "unread" | "critical";

type NotificationsViewProps = {
  activeNotifications: NotificationListItem[];
  archivedNotifications: NotificationListItem[];
  trashNotifications: NotificationListItem[];
  unreadCount: number;
  loading?: boolean;
  errorMessage?: string | null;
  onOpenNotification: (id: string) => void;
  onDismissNotification: (id: string) => void;
  onArchiveNotification: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onRestoreNotification: (id: string) => void;
  onMarkAllRead: () => void;
  onArchiveRead: () => void;
};

const severityClasses: Record<NotificationListItem["severity"], string> = {
  info: "bg-sky-50 text-sky-700 border-sky-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
};

const formatTime = (value: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "Now";
  return new Date(parsed).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const isUnauthorizedError = (value: string | null | undefined): boolean =>
  Boolean(value && /(unauthorized|401|session expired|forbidden)/i.test(value));

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  activeNotifications,
  archivedNotifications,
  trashNotifications,
  unreadCount,
  loading = false,
  errorMessage,
  onOpenNotification,
  onDismissNotification,
  onArchiveNotification,
  onDeleteNotification,
  onRestoreNotification,
  onMarkAllRead,
  onArchiveRead,
}) => {
  const [bucket, setBucket] = useState<NotificationsBucket>("active");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const normalizedErrorMessage = typeof errorMessage === "string" ? errorMessage.trim() : "";
  const hasError = normalizedErrorMessage.length > 0;
  const showReauthAction = isUnauthorizedError(normalizedErrorMessage);

  const bucketNotifications = useMemo(() => {
    if (bucket === "archived") return archivedNotifications;
    if (bucket === "trash") return trashNotifications;
    return activeNotifications;
  }, [activeNotifications, archivedNotifications, bucket, trashNotifications]);

  const filteredNotifications = useMemo(() => {
    if (bucket !== "active") return bucketNotifications;
    if (activeFilter === "unread") return bucketNotifications.filter((row) => !row.readAt);
    if (activeFilter === "critical") return bucketNotifications.filter((row) => row.severity === "critical");
    return bucketNotifications;
  }, [activeFilter, bucket, bucketNotifications]);

  const activeReadCount = useMemo(
    () => activeNotifications.filter((row) => Boolean(row.readAt)).length,
    [activeNotifications],
  );

  return (
    <section className="space-y-4">
      <header className="app-card rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">Communication</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Notifications Inbox</h1>
            <p className="mt-1 text-sm text-slate-600">
              Review alerts, open full details, and triage active, archived, or deleted notifications.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unread</p>
            <p className="text-xl font-bold text-slate-900">{unreadCount}</p>
          </div>
        </div>
      </header>

      <div className="app-card rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setBucket("active")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                bucket === "active" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Active ({activeNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setBucket("archived")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                bucket === "archived" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Archived ({archivedNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setBucket("trash")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                bucket === "trash" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Trash ({trashNotifications.length})
            </button>
          </div>

          {bucket === "active" ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveFilter("all")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    activeFilter === "all" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("unread")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    activeFilter === "unread" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Unread
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("critical")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    activeFilter === "critical" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Critical
                </button>
              </div>
              <Button size="sm" variant="secondary" disabled={unreadCount === 0} onClick={onMarkAllRead}>
                Mark all read
              </Button>
              <Button size="sm" variant="secondary" disabled={activeReadCount === 0} onClick={onArchiveRead}>
                Archive read
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="app-card min-h-[320px] rounded-xl p-3 sm:p-4">
        {loading ? <p className="px-2 py-12 text-center text-sm text-slate-500">Loading notifications...</p> : null}

        {!loading && hasError ? (
          <div className="mx-1 my-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">Notifications are unavailable right now.</p>
            <p className="mt-1 text-xs text-amber-700">{normalizedErrorMessage}</p>
            {showReauthAction ? (
              <a
                href="/api/auth/login?returnTo=/app/notifications"
                className="mt-3 inline-flex rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
              >
                Sign in again
              </a>
            ) : null}
          </div>
        ) : null}

        {!loading && !hasError && filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
              <Bell size={18} />
            </div>
            <p className="text-sm font-semibold text-slate-700">No notifications in this view.</p>
            <p className="text-xs text-slate-500">
              {bucket === "active"
                ? "New alerts will appear here as activity is detected."
                : bucket === "archived"
                  ? "Archived notifications stay here until restored."
                  : "Deleted notifications can be restored from trash."}
            </p>
          </div>
        ) : null}

        {!loading && !hasError && filteredNotifications.length > 0 ? (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => {
              const isUnread = bucket === "active" && !notification.readAt;
              return (
                <article
                  key={notification.id}
                  className={`rounded-xl border p-3 transition-colors sm:p-4 ${
                    isUnread
                      ? "border-brand-200 bg-brand-50/70 shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenNotification(notification.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityClasses[notification.severity]}`}
                        >
                          {notification.category}
                        </span>
                        {isUnread ? (
                          <>
                            <span className="inline-block h-2 w-2 rounded-full bg-brand-600" aria-hidden="true" />
                            <span className="sr-only">Unread notification</span>
                          </>
                        ) : null}
                        <span className="text-[11px] text-slate-400">{formatTime(notification.createdAt)}</span>
                      </div>
                      <p className={`mt-1 text-sm font-semibold ${isUnread ? "text-slate-900" : "text-slate-800"}`}>
                        {notification.title}
                      </p>
                      <p className={`mt-0.5 text-xs ${isUnread ? "text-slate-600" : "text-slate-500"}`}>
                        {notification.summary}
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      {bucket === "active" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onDismissNotification(notification.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            aria-label={`Dismiss notification: ${notification.title}`}
                            title="Dismiss"
                          >
                            <X size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchiveNotification(notification.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            aria-label={`Archive notification: ${notification.title}`}
                            title="Archive"
                          >
                            <Archive size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRestoreNotification(notification.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Restore notification: ${notification.title}`}
                          title="Restore"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {bucket !== "trash" ? (
                        <button
                          type="button"
                          onClick={() => onDeleteNotification(notification.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                          aria-label={`Delete notification: ${notification.title}`}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
};

