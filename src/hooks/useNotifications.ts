import { useCallback, useMemo } from "react";
import { useTenantCollection } from "./useTenantCollection";
import type { Conversation, NotificationRow, RAGDocument, UserRole } from "../types";
import { buildDerivedNotificationCandidates, mergeDerivedNotifications } from "../lib/notifications/notification-engine";

type ReferralSource = {
  id: string;
  studentName: string;
  type: string;
  urgency: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  grade?: string;
};

type InterventionSource = {
  id: string;
  studentName: string;
  planName?: string;
  status?: string;
  progress?: number;
  startDate?: string;
  teacher?: string;
};

const normalize = (value: string | null | undefined): string => value?.trim().toLowerCase() ?? "";

const nowIso = (): string => new Date().toISOString();

const isOwnedByCurrentUser = (row: NotificationRow, userId: string | null, userName: string | null): boolean => {
  if (userId && row.recipientUserId === userId) return true;
  if (userName && normalize(row.recipientUserName) === normalize(userName)) return true;
  return false;
};

const byCreatedAtDescending = (left: NotificationRow, right: NotificationRow): number => {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);
  return rightTime - leftTime;
};

export const useNotifications = (input: {
  userId: string | null;
  userName: string | null;
  currentRole: UserRole;
}) => {
  const notificationsCollection = useTenantCollection<NotificationRow>("notifications", {
    enabled: Boolean(input.userId || input.userName),
  });

  const allRows = notificationsCollection.query.data?.rows ?? [];

  const userRows = useMemo(
    () =>
      allRows
        .filter((row) => isOwnedByCurrentUser(row, input.userId, input.userName))
        .sort(byCreatedAtDescending),
    [allRows, input.userId, input.userName],
  );

  const activeNotifications = useMemo(
    () => userRows.filter((row) => !row.deletedAt && !row.archivedAt && !row.dismissedAt),
    [userRows],
  );

  const archivedNotifications = useMemo(
    () => userRows.filter((row) => !row.deletedAt && Boolean(row.archivedAt)),
    [userRows],
  );

  const unseenCount = useMemo(
    () => activeNotifications.filter((row) => !row.seenAt).length,
    [activeNotifications],
  );
  const unreadCount = useMemo(
    () => activeNotifications.filter((row) => !row.readAt).length,
    [activeNotifications],
  );

  const updateMany = useCallback(
    (ids: string[], patchFactory: (row: NotificationRow) => Partial<NotificationRow>) => {
      const idSet = new Set(ids);
      userRows
        .filter((row) => idSet.has(row.id))
        .forEach((row) => {
          notificationsCollection.updateMutation.mutate({
            id: row.id,
            patch: {
              ...patchFactory(row),
              updatedAt: nowIso(),
            },
          });
        });
    },
    [notificationsCollection.updateMutation, userRows],
  );

  const markSeen = useCallback(
    (ids: string[]) => {
      updateMany(ids, (row) => (row.seenAt ? {} : { seenAt: nowIso() }));
    },
    [updateMany],
  );

  const markRead = useCallback(
    (id: string) => {
      updateMany([id], (row) => ({
        seenAt: row.seenAt ?? nowIso(),
        readAt: row.readAt ?? nowIso(),
      }));
    },
    [updateMany],
  );

  const markAllRead = useCallback(() => {
    const unreadIds = activeNotifications.filter((row) => !row.readAt).map((row) => row.id);
    if (unreadIds.length === 0) return;
    updateMany(unreadIds, (row) => ({
      seenAt: row.seenAt ?? nowIso(),
      readAt: row.readAt ?? nowIso(),
    }));
  }, [activeNotifications, updateMany]);

  const archiveRead = useCallback(() => {
    const readIds = activeNotifications.filter((row) => Boolean(row.readAt)).map((row) => row.id);
    if (readIds.length === 0) return;
    updateMany(readIds, (row) => ({
      seenAt: row.seenAt ?? nowIso(),
      readAt: row.readAt ?? nowIso(),
      archivedAt: row.archivedAt ?? nowIso(),
    }));
  }, [activeNotifications, updateMany]);

  const dismiss = useCallback(
    (id: string) => {
      updateMany([id], (row) => ({
        seenAt: row.seenAt ?? nowIso(),
        readAt: row.readAt ?? nowIso(),
        dismissedAt: row.dismissedAt ?? nowIso(),
      }));
    },
    [updateMany],
  );

  const archive = useCallback(
    (id: string) => {
      updateMany([id], (row) => ({
        seenAt: row.seenAt ?? nowIso(),
        readAt: row.readAt ?? nowIso(),
        archivedAt: row.archivedAt ?? nowIso(),
      }));
    },
    [updateMany],
  );

  const restore = useCallback(
    (id: string) => {
      const nextRows = allRows.map((row) => {
        if (row.id !== id) return row;
        const nextRow: NotificationRow = {
          ...row,
          updatedAt: nowIso(),
        };
        delete nextRow.archivedAt;
        delete nextRow.dismissedAt;
        return nextRow;
      });
      notificationsCollection.replaceMutation.mutate(nextRows);
    },
    [allRows, notificationsCollection.replaceMutation],
  );

  const remove = useCallback(
    (id: string) => {
      updateMany([id], () => ({
        deletedAt: nowIso(),
      }));
    },
    [updateMany],
  );

  const syncDerivedNotifications = useCallback(
    (sources: {
      messages: Conversation[];
      referrals: ReferralSource[];
      interventions: InterventionSource[];
      documents: RAGDocument[];
    }) => {
      if (!notificationsCollection.query.data) return;
      if (!input.userId && !input.userName) return;

      const recipientUserId = input.userId ?? `name:${normalize(input.userName)}`;
      const recipientUserName = input.userName ?? "MTSS User";
      const candidates = buildDerivedNotificationCandidates({
        currentUserId: recipientUserId,
        currentUserName: recipientUserName,
        currentRole: input.currentRole,
        messages: sources.messages,
        referrals: sources.referrals,
        interventions: sources.interventions,
        documents: sources.documents,
      });

      const merged = mergeDerivedNotifications({
        existingRows: allRows,
        candidates,
      });

      if (!merged.changed) return;
      notificationsCollection.replaceMutation.mutate(merged.rows);
    },
    [
      allRows,
      input.currentRole,
      input.userId,
      input.userName,
      notificationsCollection.query.data,
      notificationsCollection.replaceMutation,
    ],
  );

  return {
    query: notificationsCollection.query,
    activeNotifications,
    archivedNotifications,
    userNotifications: userRows,
    unseenCount,
    unreadCount,
    markSeen,
    markRead,
    markAllRead,
    archiveRead,
    dismiss,
    archive,
    restore,
    deleteNotification: remove,
    syncDerivedNotifications,
  };
};
