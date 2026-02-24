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
    <section className="space-y-6">
      <header className="relative z-10 flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200/60 bg-white/80 p-6 sm:p-8 shadow-sm backdrop-blur-md overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-700">Communication</p>
          <h1 className="mt-1.5 text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Notifications Inbox</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Review alerts, open full details, and triage active, archived, or deleted notifications.
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/70 px-5 py-4 text-left md:text-right shadow-sm backdrop-blur-sm min-w-[120px] relative z-10">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Unread</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-800">{unreadCount}</p>
        </div>
      </header>

      <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-2xl border border-slate-200/50 bg-slate-100/80 p-1.5 shadow-inner overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setBucket("active")}
              className={`rounded-xl px-5 py-2.5 text-sm font-extrabold transition-all duration-300 whitespace-nowrap flex-1 sm:flex-none text-center ${
                bucket === "active" ? "bg-white text-indigo-700 shadow-sm border border-slate-200/50 scale-100" : "text-slate-500 hover:text-slate-700 hover:bg-white/50 scale-95 hover:scale-100 border border-transparent"
              }`}
            >
              Active ({activeNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setBucket("archived")}
              className={`rounded-xl px-5 py-2.5 text-sm font-extrabold transition-all duration-300 whitespace-nowrap flex-1 sm:flex-none text-center ${
                bucket === "archived" ? "bg-white text-indigo-700 shadow-sm border border-slate-200/50 scale-100" : "text-slate-500 hover:text-slate-700 hover:bg-white/50 scale-95 hover:scale-100 border border-transparent"
              }`}
            >
              Archived ({archivedNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setBucket("trash")}
              className={`rounded-xl px-5 py-2.5 text-sm font-extrabold transition-all duration-300 whitespace-nowrap flex-1 sm:flex-none text-center ${
                bucket === "trash" ? "bg-white text-indigo-700 shadow-sm border border-slate-200/50 scale-100" : "text-slate-500 hover:text-slate-700 hover:bg-white/50 scale-95 hover:scale-100 border border-transparent"
              }`}
            >
              Trash ({trashNotifications.length})
            </button>
          </div>

          {bucket === "active" ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveFilter("all")}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest transition-all ${
                    activeFilter === "all" ? "bg-slate-100 text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("unread")}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest transition-all ${
                    activeFilter === "unread" ? "bg-slate-100 text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Unread
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("critical")}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest transition-all ${
                    activeFilter === "critical" ? "bg-slate-100 text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Critical
                </button>
              </div>
              <Button size="sm" variant="secondary" disabled={unreadCount === 0} onClick={onMarkAllRead} className="rounded-xl shadow-sm font-extrabold">
                Mark all read
              </Button>
              <Button size="sm" variant="secondary" disabled={activeReadCount === 0} onClick={onArchiveRead} className="rounded-xl shadow-sm font-extrabold">
                Archive read
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-5 sm:p-6 shadow-sm backdrop-blur-md min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
            <p className="text-sm font-extrabold tracking-tight text-slate-500 uppercase">Loading notifications...</p>
          </div>
        ) : null}

        {!loading && hasError ? (
          <div className="mx-auto my-6 max-w-lg rounded-2xl border border-amber-200/80 bg-amber-50/80 p-6 shadow-sm backdrop-blur-sm text-center">
            <p className="text-base font-extrabold tracking-tight text-amber-800">Notifications are unavailable right now.</p>
            <p className="mt-2 text-sm font-medium text-amber-700/90">{normalizedErrorMessage}</p>
            {showReauthAction ? (
              <a
                href="/api/auth/login?returnTo=/app/notifications"
                className="mt-5 inline-flex items-center justify-center rounded-xl border border-amber-300/80 bg-white px-5 py-2.5 text-sm font-extrabold text-amber-800 shadow-sm transition-all hover:bg-amber-100 hover:shadow active:scale-95"
              >
                Sign in again
              </a>
            ) : null}
          </div>
        ) : null}

        {!loading && !hasError && filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center animate-in zoom-in-95 duration-500">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl border-2 border-slate-200/80 bg-slate-50/80 text-slate-400 shadow-sm">
              <Bell size={28} strokeWidth={2.5} />
            </div>
            <p className="mt-2 text-lg font-extrabold tracking-tight text-slate-800">No notifications in this view.</p>
            <p className="text-sm font-medium text-slate-500 max-w-xs leading-relaxed">
              {bucket === "active"
                ? "New alerts will appear here as activity is detected."
                : bucket === "archived"
                  ? "Archived notifications stay here until restored."
                  : "Deleted notifications can be restored from trash."}
            </p>
          </div>
        ) : null}

        {!loading && !hasError && filteredNotifications.length > 0 ? (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const isUnread = bucket === "active" && !notification.readAt;
              return (
                <article
                  key={notification.id}
                  className={`rounded-2xl border p-4 sm:p-5 transition-all duration-300 group ${
                    isUnread
                      ? "border-indigo-200/80 bg-indigo-50/50 shadow-sm hover:shadow hover:border-indigo-300/80"
                      : "border-slate-200/60 bg-white/60 backdrop-blur-sm hover:bg-white hover:shadow-sm hover:border-slate-300/80"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
                    <button
                      type="button"
                      onClick={() => onOpenNotification(notification.id)}
                      className="min-w-0 flex-1 text-left flex flex-col items-start focus:outline-none"
                    >
                      <div className="flex flex-wrap items-center gap-2.5 w-full">
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest shadow-sm ${severityClasses[notification.severity]}`}
                        >
                          {notification.category}
                        </span>
                        {isUnread ? (
                          <>
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)] animate-pulse" aria-hidden="true" />
                            <span className="sr-only">Unread notification</span>
                          </>
                        ) : null}
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 ml-auto sm:ml-0">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className={`mt-3 text-lg tracking-tight ${isUnread ? "font-extrabold text-slate-900 group-hover:text-indigo-700 transition-colors" : "font-bold text-slate-800"}`}>
                        {notification.title}
                      </p>
                      <p className={`mt-1.5 text-sm font-medium leading-relaxed ${isUnread ? "text-slate-700/90" : "text-slate-500"}`}>
                        {notification.summary}
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                      {bucket === "active" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onDismissNotification(notification.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 border border-transparent transition-all hover:bg-slate-100 hover:text-slate-700 hover:border-slate-200/80 shadow-sm hover:shadow"
                            aria-label={`Dismiss notification: ${notification.title}`}
                            title="Dismiss"
                          >
                            <X size={18} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchiveNotification(notification.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 border border-transparent transition-all hover:bg-slate-100 hover:text-slate-700 hover:border-slate-200/80 shadow-sm hover:shadow"
                            aria-label={`Archive notification: ${notification.title}`}
                            title="Archive"
                          >
                            <Archive size={16} strokeWidth={2.5} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRestoreNotification(notification.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 border border-transparent transition-all hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200/80 shadow-sm hover:shadow"
                          aria-label={`Restore notification: ${notification.title}`}
                          title="Restore"
                        >
                          <Check size={18} strokeWidth={3} />
                        </button>
                      )}
                      {bucket !== "trash" ? (
                        <button
                          type="button"
                          onClick={() => onDeleteNotification(notification.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 border border-transparent transition-all hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200/80 shadow-sm hover:shadow"
                          aria-label={`Delete notification: ${notification.title}`}
                          title="Delete"
                        >
                          <Trash2 size={16} strokeWidth={2.5} />
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

