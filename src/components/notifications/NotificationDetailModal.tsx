import React, { useEffect, useState } from "react";
import { Archive, ExternalLink, Trash2, X } from "lucide-react";
import type { NotificationRow } from "../../types";
import { DraggableModal } from "../DraggableModal";

type NotificationDetailModalProps = {
  notification: NotificationRow | null;
  isOpen: boolean;
  onClose: () => void;
  onDismiss: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenSource: (notification: NotificationRow) => void;
};

const formatTimestamp = (value: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const severityTone: Record<NotificationRow["severity"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
};

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notification,
  isOpen,
  onClose,
  onDismiss,
  onArchive,
  onDelete,
  onOpenSource,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmDelete(false);
      return;
    }
    setConfirmDelete(false);
  }, [isOpen, notification?.id]);

  if (!notification) return null;

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Notification details"
      initialWidth={620}
      initialHeight={560}
      mobileMode="fullscreen"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDismiss(notification.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <X size={14} />
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => onArchive(notification.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Archive size={14} />
              Archive
            </button>
            <button
              type="button"
              onClick={() => onDelete(notification.id)}
              onClickCapture={(event) => {
                if (!confirmDelete) {
                  event.preventDefault();
                  event.stopPropagation();
                  setConfirmDelete(true);
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
            >
              <Trash2 size={14} />
              {confirmDelete ? "Confirm delete" : "Delete"}
            </button>
            {confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {notification.sourceRoute ? (
            <button
              type="button"
              onClick={() => onOpenSource(notification)}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Open source
              <ExternalLink size={14} />
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${severityTone[notification.severity]}`}>
            {notification.category}
          </span>
          <span className="text-xs text-slate-500">Created {formatTimestamp(notification.createdAt)}</span>
          {notification.readAt ? <span className="text-xs text-emerald-600">Read {formatTimestamp(notification.readAt)}</span> : null}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-bold text-slate-900">{notification.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{notification.summary}</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{notification.body}</p>
        </section>

        <details
          className="rounded-xl border border-slate-200 bg-white p-4"
          open={detailsExpanded}
          onToggle={(event) => setDetailsExpanded((event.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Details
          </summary>
          <section className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Source</p>
              <p className="text-sm font-medium text-slate-700">{notification.sourceType}</p>
              <p className="text-xs text-slate-500">{notification.sourceId}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recipient</p>
              <p className="text-sm font-medium text-slate-700">{notification.recipientUserName}</p>
              <p className="text-xs text-slate-500">{notification.recipientUserId}</p>
            </div>
          </section>
        </details>
      </div>
    </DraggableModal>
  );
};
