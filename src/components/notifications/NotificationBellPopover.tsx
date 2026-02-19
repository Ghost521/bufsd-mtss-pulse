import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Bell, Check, Trash2, X } from "lucide-react";
import type { NotificationListItem } from "../../types";

type NotificationBellPopoverProps = {
  activeNotifications: NotificationListItem[];
  archivedNotifications: NotificationListItem[];
  unseenCount: number;
  loading?: boolean;
  isCompact?: boolean;
  onNotificationOpen: (id: string) => void;
  onNotificationDismiss: (id: string) => void;
  onNotificationArchive: (id: string) => void;
  onNotificationDelete: (id: string) => void;
  onNotificationRestore: (id: string) => void;
  onNotificationMarkSeen: (ids: string[]) => void;
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

const severityClasses: Record<NotificationListItem["severity"], string> = {
  info: "bg-sky-50 text-sky-700 border-sky-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
};

export const NotificationBellPopover: React.FC<NotificationBellPopoverProps> = ({
  activeNotifications,
  archivedNotifications,
  unseenCount,
  loading = false,
  isCompact = false,
  onNotificationOpen,
  onNotificationDismiss,
  onNotificationArchive,
  onNotificationDelete,
  onNotificationRestore,
  onNotificationMarkSeen,
}) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [position, setPosition] = useState({ top: 56, left: 16 });

  const visibleActive = useMemo(() => activeNotifications.slice(0, 8), [activeNotifications]);
  const visibleArchived = useMemo(() => archivedNotifications.slice(0, 8), [archivedNotifications]);

  useEffect(() => {
    if (!open) return;
    const unseenVisibleIds = visibleActive.filter((item) => !item.seenAt).map((item) => item.id);
    if (unseenVisibleIds.length > 0) {
      onNotificationMarkSeen(unseenVisibleIds);
    }
  }, [onNotificationMarkSeen, open, visibleActive]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const anchor = triggerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = 360;
      const height = 460;
      const nextLeft = Math.min(
        window.innerWidth - width - 12,
        Math.max(12, rect.right - width),
      );
      const preferredTop = rect.bottom + 8;
      const nextTop =
        preferredTop + height > window.innerHeight
          ? Math.max(12, rect.top - height - 8)
          : preferredTop;
      setPosition({ top: nextTop, left: nextLeft });
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={`relative inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-100 transition-colors hover:border-slate-500 hover:text-white ${
          isCompact ? "h-9 w-9" : "h-9 w-9"
        }`}
        aria-label={unseenCount > 0 ? `Notifications (${unseenCount} unseen)` : "Notifications"}
        title={unseenCount > 0 ? `${unseenCount} unseen notifications` : "Notifications"}
      >
        <Bell size={16} />
        {unseenCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {unseenCount > 99 ? "99+" : unseenCount}
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-[70] w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white shadow-2xl"
              style={{ top: position.top, left: position.left }}
              role="dialog"
              aria-label="Notifications"
            >
              <div className="border-b border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">Notifications</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {unseenCount} unseen
                  </span>
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
              </div>

              <div className="max-h-[380px] overflow-y-auto p-2">
                {loading ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-500">Loading notifications...</p>
                ) : null}

                {!loading && tab === "active" && visibleActive.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-500">No active notifications.</p>
                ) : null}

                {!loading && tab === "archived" && visibleArchived.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-500">No archived notifications.</p>
                ) : null}

                {!loading &&
                  (tab === "active" ? visibleActive : visibleArchived).map((notification) => (
                    <article
                      key={notification.id}
                      className="group mb-2 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50"
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
                            <span className="text-[11px] text-slate-400">{formatTime(notification.createdAt)}</span>
                          </div>
                          <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-800">{notification.title}</p>
                          <p className="line-clamp-2 text-xs text-slate-500">{notification.summary}</p>
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
                                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Dismiss notification"
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
                                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Archive notification"
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
                              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Restore notification"
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
                            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                            aria-label="Delete notification"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

