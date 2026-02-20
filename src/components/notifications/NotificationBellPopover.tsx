import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Bell, Check, Trash2, X } from "lucide-react";
import type { NotificationListItem } from "../../types";

type NotificationPresentation = "auto" | "popover" | "sheet";

type NotificationBellPopoverProps = {
  activeNotifications: NotificationListItem[];
  archivedNotifications: NotificationListItem[];
  unseenCount: number;
  loading?: boolean;
  errorMessage?: string | null;
  isCompact?: boolean;
  presentation?: NotificationPresentation;
  onNotificationOpen: (id: string) => void;
  onNotificationDismiss: (id: string) => void;
  onNotificationArchive: (id: string) => void;
  onNotificationDelete: (id: string) => void;
  onNotificationRestore: (id: string) => void;
  onNotificationMarkSeen: (ids: string[]) => void;
  onNotificationMarkAllRead?: () => void;
  onNotificationArchiveRead?: () => void;
  onBeforeOpenSheet?: () => void;
};

const MOBILE_BREAKPOINT_QUERY = "(max-width: 1023px)";

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

const severityClasses: Record<NotificationListItem["severity"], string> = {
  info: "bg-sky-50 text-sky-700 border-sky-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
};

const isUnauthorizedError = (value: string | null): boolean =>
  Boolean(value && /(unauthorized|401|session expired|forbidden)/i.test(value));

export const NotificationBellPopover: React.FC<NotificationBellPopoverProps> = ({
  activeNotifications,
  archivedNotifications,
  unseenCount,
  loading = false,
  errorMessage: rawErrorMessage,
  isCompact = false,
  presentation = "auto",
  onNotificationOpen,
  onNotificationDismiss,
  onNotificationArchive,
  onNotificationDelete,
  onNotificationRestore,
  onNotificationMarkSeen,
  onNotificationMarkAllRead,
  onNotificationArchiveRead,
  onBeforeOpenSheet,
}) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "critical">("all");
  const [position, setPosition] = useState({ top: 56, left: 16 });
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const lastSeenSignatureRef = useRef<string>("");
  const wasOpenRef = useRef(false);
  const markSeenTimerRef = useRef<number | null>(null);

  const visibleActive = useMemo(() => activeNotifications.slice(0, 8), [activeNotifications]);
  const visibleArchived = useMemo(() => archivedNotifications.slice(0, 8), [archivedNotifications]);
  const normalizedErrorMessage = typeof rawErrorMessage === "string" ? rawErrorMessage.trim() : "";
  const hasError = normalizedErrorMessage.length > 0;
  const showReauthAction = isUnauthorizedError(hasError ? normalizedErrorMessage : null);
  const resolvedPresentation: Exclude<NotificationPresentation, "auto"> =
    presentation === "popover" || presentation === "sheet" ? presentation : isMobileViewport ? "sheet" : "popover";

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setIsMobileViewport(false);
      return;
    }
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const update = () => setIsMobileViewport(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
    } else {
      mediaQuery.addListener(update);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", update);
      } else {
        mediaQuery.removeListener(update);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      lastSeenSignatureRef.current = "";
      if (markSeenTimerRef.current != null) {
        window.clearTimeout(markSeenTimerRef.current);
        markSeenTimerRef.current = null;
      }
      return;
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current) {
      triggerRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (tab === "archived" && activeFilter !== "all") {
      setActiveFilter("all");
    }
  }, [activeFilter, tab]);

  useEffect(() => {
    if (!open || loading || hasError) return;
    const unseenVisibleIds = visibleActive.filter((item) => !item.seenAt).map((item) => item.id);
    const signature = unseenVisibleIds.join("|");
    if (unseenVisibleIds.length > 0 && signature !== lastSeenSignatureRef.current) {
      lastSeenSignatureRef.current = signature;
      if (markSeenTimerRef.current != null) {
        window.clearTimeout(markSeenTimerRef.current);
      }
      markSeenTimerRef.current = window.setTimeout(() => {
        onNotificationMarkSeen(unseenVisibleIds);
        markSeenTimerRef.current = null;
      }, 200);
    }
    return () => {
      if (markSeenTimerRef.current != null) {
        window.clearTimeout(markSeenTimerRef.current);
        markSeenTimerRef.current = null;
      }
    };
  }, [hasError, loading, onNotificationMarkSeen, open, visibleActive]);

  useEffect(() => {
    if (!open || resolvedPresentation !== "popover") return;

    const updatePosition = () => {
      const anchor = triggerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = 360;
      const height = 460;
      const nextLeft = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width));
      const preferredTop = rect.bottom + 8;
      const nextTop = preferredTop + height > window.innerHeight ? Math.max(12, rect.top - height - 8) : preferredTop;
      setPosition({ top: nextTop, left: nextLeft });
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, resolvedPresentation]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const filteredActive = useMemo(() => {
    if (activeFilter === "unread") return visibleActive.filter((row) => !row.readAt);
    if (activeFilter === "critical") return visibleActive.filter((row) => row.severity === "critical");
    return visibleActive;
  }, [activeFilter, visibleActive]);

  const canMarkAllRead = useMemo(() => visibleActive.some((row) => !row.readAt), [visibleActive]);
  const canArchiveRead = useMemo(() => visibleActive.some((row) => Boolean(row.readAt)), [visibleActive]);
  const activeRows = tab === "active" ? filteredActive : visibleArchived;

  const content = (
    <>
      <div className="border-b border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">Notifications</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600" aria-live="polite">
              {unseenCount} unread
            </span>
            {resolvedPresentation === "sheet" ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close notifications"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-2 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === "active" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab("archived")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === "archived" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Archived
          </button>
        </div>
        {tab === "active" && !loading && !hasError ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
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
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => onNotificationMarkAllRead?.()}
                disabled={!canMarkAllRead}
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 transition-colors enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={() => onNotificationArchiveRead?.()}
                disabled={!canArchiveRead}
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 transition-colors enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Archive read
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className={`${resolvedPresentation === "sheet" ? "max-h-[58vh]" : "max-h-[380px]"} overflow-y-auto p-2`}>
        {loading ? <p className="px-2 py-8 text-center text-sm text-slate-500">Loading notifications...</p> : null}

        {!loading && hasError ? (
          <div className="mx-1 my-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-800">Notifications are unavailable right now.</p>
            <p className="mt-1 text-xs text-amber-700">{normalizedErrorMessage}</p>
            {showReauthAction ? (
              <a
                href="/api/auth/login?returnTo=/app"
                className="mt-3 inline-flex rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
              >
                Sign in again
              </a>
            ) : null}
          </div>
        ) : null}

        {!loading && !hasError && tab === "active" && activeRows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-slate-500">No active notifications.</p>
        ) : null}

        {!loading && !hasError && tab === "archived" && activeRows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-slate-500">No archived notifications.</p>
        ) : null}

        {!loading && !hasError
          ? activeRows.map((notification) => {
              const isUnread = tab === "active" && !notification.readAt;
              return (
                <article
                  key={notification.id}
                  data-notification-id={notification.id}
                  data-unread={isUnread ? "true" : "false"}
                  className={`group mb-2 rounded-xl border p-3 transition-colors ${
                    isUnread
                      ? "border-brand-200 bg-brand-50/70 shadow-sm hover:bg-brand-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onNotificationOpen(notification.id);
                      setOpen(false);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityClasses[notification.severity]}`}
                      >
                        {notification.category}
                      </span>
                      {isUnread ? (
                        <>
                          <span
                            aria-hidden="true"
                            data-unread-dot="true"
                            className="inline-block h-2 w-2 rounded-full bg-brand-600"
                          />
                          <span className="sr-only">Unread notification</span>
                        </>
                      ) : null}
                      <span className="text-[11px] text-slate-400">{formatTime(notification.createdAt)}</span>
                    </div>
                    <p className={`mt-1 line-clamp-1 text-sm font-semibold ${isUnread ? "text-slate-900" : "text-slate-800"}`}>
                      {notification.title}
                    </p>
                    <p className={`line-clamp-2 text-xs ${isUnread ? "text-slate-600" : "text-slate-500"}`}>{notification.summary}</p>
                  </button>

                  <div className="ml-1 flex shrink-0 items-center gap-1">
                    {tab === "active" ? (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onNotificationDismiss(notification.id);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Dismiss notification: ${notification.title}`}
                          title="Dismiss"
                        >
                          <X size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onNotificationArchive(notification.id);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Archive notification: ${notification.title}`}
                          title="Archive"
                        >
                          <Archive size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onNotificationRestore(notification.id);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Restore notification: ${notification.title}`}
                        title="Restore"
                      >
                        <Check size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onNotificationDelete(notification.id);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                      aria-label={`Delete notification: ${notification.title}`}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                </article>
              );
            })
          : null}
      </div>

      {!showReauthAction ? (
        <div className="border-t border-slate-200 p-2">
          <a
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Manage notifications
          </a>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() =>
          setOpen((previous) => {
            const next = !previous;
            if (next && resolvedPresentation === "sheet") {
              onBeforeOpenSheet?.();
            }
            return next;
          })
        }
        className={`relative inline-flex items-center justify-center border border-slate-700 bg-slate-800/80 text-slate-100 transition-colors hover:border-slate-500 hover:text-white ${
          isCompact ? "h-8 w-8 rounded-md" : "h-9 w-9 rounded-lg"
        }`}
        aria-label={unseenCount > 0 ? `Notifications (${unseenCount} unread)` : "Notifications"}
        title={unseenCount > 0 ? `${unseenCount} unread notifications` : "Notifications"}
      >
        <Bell size={16} />
        {unseenCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {unseenCount > 99 ? "99+" : unseenCount}
          </span>
        ) : null}
      </button>

      {open ? (
        resolvedPresentation === "sheet" ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[69] bg-slate-900/45 lg:hidden"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            />
            <section
              ref={panelRef}
              aria-label="Notifications"
              className="fixed inset-x-0 bottom-0 z-[70] max-h-[82vh] rounded-t-2xl border border-slate-200 bg-white shadow-2xl lg:hidden"
            >
              <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300" />
              {content}
            </section>
          </>
        ) : (
          createPortal(
            <div
              ref={panelRef}
              className="fixed z-[70] w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white shadow-2xl"
              style={{ top: position.top, left: position.left }}
              role="dialog"
              aria-label="Notifications"
            >
              {content}
            </div>,
            document.body,
          )
        )
      ) : null}
    </>
  );
};
