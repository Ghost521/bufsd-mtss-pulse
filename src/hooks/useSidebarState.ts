import { useCallback, useEffect, useMemo, useState } from "react";
import { readSidebarStorage, writeSidebarStorage } from "../lib/sidebarStorage";
import { trackSidebarEvent } from "../lib/sidebarTelemetry";

const DESKTOP_COLLAPSED_STORAGE_KEY = "desktopCollapsed";
const GROUP_STATE_STORAGE_KEY = "groupState";

export type SidebarGroupState = Record<string, boolean>;

type UseSidebarStateArgs = {
  userKey: string;
  defaultGroupState?: SidebarGroupState;
};

export const useSidebarState = ({ userKey, defaultGroupState = {} }: UseSidebarStateArgs) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  // Start with deterministic values to avoid SSR/client hydration drift.
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [groupState, setGroupState] = useState<SidebarGroupState>(defaultGroupState);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setDesktopCollapsed(readSidebarStorage<boolean>(DESKTOP_COLLAPSED_STORAGE_KEY, userKey, false));
    setGroupState(readSidebarStorage<SidebarGroupState>(GROUP_STATE_STORAGE_KEY, userKey, defaultGroupState));
    setSearchQuery("");
  }, [defaultGroupState, userKey]);

  const openMobile = useCallback(() => {
    setIsMobileOpen(true);
    trackSidebarEvent("sidebar_opened", { scope: "mobile" });
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
    trackSidebarEvent("sidebar_closed", { scope: "mobile" });
  }, []);

  const toggleDesktopCollapsed = useCallback(() => {
    setDesktopCollapsed((previous) => {
      const next = !previous;
      writeSidebarStorage(DESKTOP_COLLAPSED_STORAGE_KEY, userKey, next);
      trackSidebarEvent("sidebar_collapsed", { collapsed: next });
      return next;
    });
  }, [userKey]);

  const setGroupExpanded = useCallback(
    (groupId: string, expanded: boolean) => {
      setGroupState((previous) => {
        const next = { ...previous, [groupId]: expanded };
        writeSidebarStorage(GROUP_STATE_STORAGE_KEY, userKey, next);
        return next;
      });
    },
    [userKey]
  );

  const toggleGroupExpanded = useCallback(
    (groupId: string, defaultExpanded = true) => {
      setGroupState((previous) => {
        const current = previous[groupId] ?? defaultExpanded;
        const next = { ...previous, [groupId]: !current };
        writeSidebarStorage(GROUP_STATE_STORAGE_KEY, userKey, next);
        return next;
      });
    },
    [userKey]
  );

  const onSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 0) {
      trackSidebarEvent("sidebar_search_used", { length: query.trim().length });
    }
  }, []);

  const state = useMemo(
    () => ({
      isMobileOpen,
      isDesktopCollapsed: desktopCollapsed,
      groupState,
      searchQuery,
    }),
    [desktopCollapsed, groupState, isMobileOpen, searchQuery]
  );

  const actions = useMemo(
    () => ({
      openMobile,
      closeMobile,
      setMobileOpen: setIsMobileOpen,
      toggleDesktopCollapsed,
      setGroupExpanded,
      toggleGroupExpanded,
      setSearchQuery: onSearchQueryChange,
    }),
    [closeMobile, onSearchQueryChange, openMobile, setGroupExpanded, toggleDesktopCollapsed, toggleGroupExpanded]
  );

  return { state, actions };
};
