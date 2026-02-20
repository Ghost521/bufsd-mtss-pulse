import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Search,
  X,
} from "lucide-react";
import { UserRole, type NotificationListItem } from "../types";
import { TenantContextSwitcher } from "./TenantContextSwitcher";
import { NotificationBellPopover } from "./notifications/NotificationBellPopover";
import type { WorkspacePageId } from "../lib/workspaceRoutes";
import { buildWorkspacePath } from "../lib/workspaceRoutes";
import type { SidebarGroupState } from "../hooks/useSidebarState";
import { getRouteIcon, iconSize } from "../lib/ui/icons";

interface SidebarProps {
  currentRole: UserRole;
  availableRoles: UserRole[];
  onRoleChange: (role: UserRole) => void;
  userName: string;
  userAvatarUrl?: string | null;
  schoolName: string;
  brandLogoUrl?: string | null;
  mascotName?: string;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  activePage: WorkspacePageId;
  isDesktopCollapsed: boolean;
  onDesktopCollapseToggle: () => void;
  groupState: SidebarGroupState;
  onGroupToggle: (groupId: string, defaultExpanded?: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  notificationUnseenCount?: number;
  activeNotifications?: NotificationListItem[];
  archivedNotifications?: NotificationListItem[];
  notificationLoading?: boolean;
  notificationError?: string | null;
  onNotificationOpen?: (id: string) => void;
  onNotificationDismiss?: (id: string) => void;
  onNotificationArchive?: (id: string) => void;
  onNotificationDelete?: (id: string) => void;
  onNotificationRestore?: (id: string) => void;
  onNotificationMarkSeen?: (ids: string[]) => void;
  onNotificationMarkAllRead?: () => void;
  onNotificationArchiveRead?: () => void;
  onBeforeOpenNotificationSheet?: () => void;
}

type WorkspaceNavItem = {
  id: WorkspacePageId;
  label: string;
};

type WorkspaceNavGroup = {
  id: string;
  label: string;
  defaultExpanded?: boolean;
  items: WorkspaceNavItem[];
};

const showSidebarTestControls =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_SIDEBAR_TEST_CONTROLS === "true";

const getMenuGroups = (role: UserRole): WorkspaceNavGroup[] => {
  const dashboardByRole: Record<UserRole, WorkspaceNavItem> = {
    [UserRole.PRINCIPAL]: { id: "dashboard", label: "School Dashboard" },
    [UserRole.TEACHER]: { id: "dashboard", label: "Class Dashboard" },
    [UserRole.DISTRICT]: { id: "dashboard", label: "District Dashboard" },
    [UserRole.PARENT]: { id: "dashboard", label: "Student Overview" },
  };

  const workItemsByRole: Record<UserRole, WorkspaceNavItem[]> = {
    [UserRole.PRINCIPAL]: [
      dashboardByRole[UserRole.PRINCIPAL],
      { id: "rosters", label: "Student Rosters" },
      { id: "interventions", label: "Intervention Plans" },
      { id: "reports", label: "School Reports" },
    ],
    [UserRole.TEACHER]: [
      dashboardByRole[UserRole.TEACHER],
      { id: "class_roster", label: "Student Roster" },
      { id: "gradebook", label: "Gradebook" },
      { id: "interventions", label: "Interventions" },
    ],
    [UserRole.DISTRICT]: [
      dashboardByRole[UserRole.DISTRICT],
      { id: "map", label: "School Map" },
      { id: "reports", label: "District Reports" },
    ],
    [UserRole.PARENT]: [
      dashboardByRole[UserRole.PARENT],
      { id: "reports", label: "Progress Reports" },
    ],
  };

  const planningItemsByRole: Record<UserRole, WorkspaceNavItem[]> = {
    [UserRole.PRINCIPAL]: [
      { id: "lesson_plans", label: "Lesson Plans" },
      { id: "calendar", label: "School Calendar" },
    ],
    [UserRole.TEACHER]: [
      { id: "lesson_plans", label: "Lesson Plans" },
      { id: "calendar", label: "Class Calendar" },
    ],
    [UserRole.DISTRICT]: [{ id: "calendar", label: "District Calendar" }],
    [UserRole.PARENT]: [{ id: "calendar", label: "School Calendar" }],
  };

  if (role === UserRole.PRINCIPAL) {
    return [
      {
        id: "student-support",
        label: "Student Support",
        defaultExpanded: true,
        items: [
          dashboardByRole[UserRole.PRINCIPAL],
          { id: "rosters", label: "Rosters" },
          { id: "interventions", label: "Interventions" },
          { id: "reports", label: "School Reports" },
        ],
      },
      {
        id: "staff-rosters",
        label: "Staff & Rosters",
        defaultExpanded: true,
        items: [{ id: "lesson_plans", label: "Lesson Plans" }],
      },
      {
        id: "school-ops",
        label: "School Operations",
        defaultExpanded: true,
        items: [
          { id: "calendar", label: "School Calendar" },
          { id: "documents", label: "Resource Library" },
          { id: "import", label: "Integrations" },
        ],
      },
      {
        id: "communication",
        label: "Communication",
        defaultExpanded: true,
        items: [
          { id: "messages", label: "Messages" },
          { id: "notifications", label: "Notifications" },
        ],
      },
    ];
  }

  return [
    { id: "work", label: "Instruction", defaultExpanded: true, items: workItemsByRole[role] },
    { id: "planning", label: "Planning & Calendar", defaultExpanded: true, items: planningItemsByRole[role] },
    {
      id: "communication",
      label: "Communication",
      defaultExpanded: true,
      items: [
        { id: "messages", label: "Messages" },
        { id: "notifications", label: "Notifications" },
      ],
    },
    {
      id: "administration",
      label: "Operations",
      defaultExpanded: true,
      items:
        role === UserRole.PARENT
          ? [{ id: "documents", label: "Family Resources" }]
          : [
              { id: "documents", label: "Resource Library" },
              { id: "import", label: "Integrations" },
            ],
    },
  ];
};

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");

type SidebarContentProps = {
  mode: "mobile" | "desktop";
  currentRole: UserRole;
  availableRoles: UserRole[];
  onRoleChange: (role: UserRole) => void;
  userName: string;
  userAvatarUrl?: string | null;
  schoolName: string;
  brandLogoUrl?: string | null;
  mascotName?: string;
  activePage: WorkspacePageId;
  isDesktopCollapsed: boolean;
  onDesktopCollapseToggle: () => void;
  groupState: SidebarGroupState;
  onGroupToggle: (groupId: string, defaultExpanded?: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  notificationUnseenCount: number;
  activeNotifications: NotificationListItem[];
  archivedNotifications: NotificationListItem[];
  notificationLoading: boolean;
  notificationError: string | null;
  onNotificationOpen: (id: string) => void;
  onNotificationDismiss: (id: string) => void;
  onNotificationArchive: (id: string) => void;
  onNotificationDelete: (id: string) => void;
  onNotificationRestore: (id: string) => void;
  onNotificationMarkSeen: (ids: string[]) => void;
  onNotificationMarkAllRead: () => void;
  onNotificationArchiveRead: () => void;
  onBeforeOpenNotificationSheet: () => void;
  onSearchKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  highlightedItemId: WorkspacePageId | null;
  onClose: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
};

const SidebarContent: React.FC<SidebarContentProps> = ({
  mode,
  currentRole,
  availableRoles,
  onRoleChange,
  userName,
  userAvatarUrl,
  schoolName,
  brandLogoUrl,
  mascotName,
  activePage,
  isDesktopCollapsed,
  onDesktopCollapseToggle,
  groupState,
  onGroupToggle,
  searchQuery,
  onSearchQueryChange,
  notificationUnseenCount,
  activeNotifications,
  archivedNotifications,
  notificationLoading,
  notificationError,
  onNotificationOpen,
  onNotificationDismiss,
  onNotificationArchive,
  onNotificationDelete,
  onNotificationRestore,
  onNotificationMarkSeen,
  onNotificationMarkAllRead,
  onNotificationArchiveRead,
  onBeforeOpenNotificationSheet,
  onSearchKeyDown,
  highlightedItemId,
  onClose,
  searchInputRef,
}) => {
  const isMobile = mode === "mobile";
  const navGroups = useMemo(() => getMenuGroups(currentRole), [currentRole]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [brandLogoLoadFailed, setBrandLogoLoadFailed] = useState(false);

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return navGroups;
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);
  }, [navGroups, normalizedQuery]);

  const navContainerClasses = isMobile
    ? "flex-1 space-y-1 overflow-y-auto px-3 py-4"
    : `flex-1 space-y-1 overflow-y-auto px-3 py-4 ${isDesktopCollapsed ? "pt-3" : "pt-4"}`;
  const userInitials = useMemo(() => {
    const parts = userName
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "US";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [userName]);
  const displayName = userName.trim() || "MTSS User";
  const showAvatarImage = Boolean(userAvatarUrl && userAvatarUrl.trim().length > 0 && !avatarLoadFailed);
  const showBrandLogo = Boolean(brandLogoUrl && brandLogoUrl.trim().length > 0 && !brandLogoLoadFailed);
  const isCollapsedDesktop = isDesktopCollapsed && !isMobile;
  const displaySchoolName = schoolName.trim().length > 0 ? schoolName : "School Workspace";
  const displayMascotName = mascotName?.trim() ? mascotName : null;
  const brandMark = (
    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600">
      {showBrandLogo ? (
        <img
          src={brandLogoUrl ?? undefined}
          alt="District logo"
          className="h-7 w-7 rounded-md object-cover"
          onError={() => setBrandLogoLoadFailed(true)}
        />
      ) : (
        <GraduationCap size={iconSize("xl")} className="text-white" />
      )}
    </div>
  );
  const SettingsIcon = getRouteIcon("settings");

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [userAvatarUrl]);

  useEffect(() => {
    setBrandLogoLoadFailed(false);
  }, [brandLogoUrl]);

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 p-3">
        {isCollapsedDesktop ? (
          <div className="flex flex-col items-center gap-2">
            {brandMark}
            <button
              type="button"
              onClick={onDesktopCollapseToggle}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700 p-0 text-slate-300 transition-colors hover:border-slate-500 hover:text-white lg:inline-flex"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight size={iconSize("md")} />
            </button>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2">
              <div className="justify-self-start">{brandMark}</div>
              <div className="min-w-0 text-left leading-tight">
                <h1
                  id={isMobile ? "workspace-menu-title" : undefined}
                  className="truncate text-[13px] font-semibold text-slate-100"
                  title={displaySchoolName}
                  style={{ color: "#f8fafc" }}
                >
                  {displaySchoolName}
                </h1>
                {displayMascotName ? (
                  <p
                    className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-slate-300"
                    title={displayMascotName}
                    style={{ color: "#cbd5e1" }}
                  >
                    {displayMascotName}
                  </p>
                ) : null}
              </div>
              {isMobile ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700 p-0 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                  aria-label="Close workspace menu"
                >
                  <X size={iconSize("lg")} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onDesktopCollapseToggle}
                  className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700 p-0 text-slate-300 transition-colors hover:border-slate-500 hover:text-white lg:inline-flex"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <ChevronLeft size={iconSize("md")} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className={`mt-2 flex ${isDesktopCollapsed && !isMobile ? "justify-center" : "justify-start"}`}>
          <NotificationBellPopover
            activeNotifications={activeNotifications}
            archivedNotifications={archivedNotifications}
            unseenCount={notificationUnseenCount}
            loading={notificationLoading}
            errorMessage={notificationError}
            isCompact={isDesktopCollapsed && !isMobile}
            presentation={isMobile ? "sheet" : "popover"}
            onNotificationOpen={onNotificationOpen}
            onNotificationDismiss={onNotificationDismiss}
            onNotificationArchive={onNotificationArchive}
            onNotificationDelete={onNotificationDelete}
            onNotificationRestore={onNotificationRestore}
            onNotificationMarkSeen={onNotificationMarkSeen}
            onNotificationMarkAllRead={onNotificationMarkAllRead}
            onNotificationArchiveRead={onNotificationArchiveRead}
            onBeforeOpenSheet={onBeforeOpenNotificationSheet}
          />
        </div>

        {isDesktopCollapsed && !isMobile ? null : (
          <>
            <div className="mt-2 border-t border-slate-800/80 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Workspace</p>
            </div>
            <div className="mt-3">
              <label htmlFor={`sidebar-search-${mode}`} className="sr-only">
                Search navigation
              </label>
              <div className="relative">
                <Search size={iconSize("sm")} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id={`sidebar-search-${mode}`}
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search pages"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <nav className={navContainerClasses} aria-label="Workspace navigation">
        {filteredGroups.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-400">No pages match your search.</p>
        ) : (
          filteredGroups.map((group) => {
            const isExpanded = normalizedQuery ? true : groupState[group.id] ?? group.defaultExpanded ?? true;
            return (
              <section key={group.id} className="space-y-1">
                {isDesktopCollapsed && !isMobile ? null : (
                  <button
                    type="button"
                    onClick={() => onGroupToggle(group.id, group.defaultExpanded ?? true)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300"
                    aria-expanded={isExpanded}
                  >
                    {group.label}
                    <ChevronDown size={iconSize("xs")} className={`transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                  </button>
                )}
                {isExpanded || (isDesktopCollapsed && !isMobile)
                    ? group.items.map((item) => {
                      const ItemIcon = getRouteIcon(item.id);
                      const isActive = activePage === item.id;
                      const isHighlighted = highlightedItemId === item.id && normalizedQuery.length > 0;
                      const itemClasses = isDesktopCollapsed && !isMobile
                        ? `group relative flex w-full items-center justify-center rounded-lg px-2 py-2.5 transition-all duration-150 ${
                            isActive
                              ? "bg-brand-600 text-white shadow-lg shadow-brand-900/40 ring-2 ring-brand-300/90 ring-offset-2 ring-offset-slate-900"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          } ${isHighlighted ? "ring-2 ring-brand-400" : ""}`
                        : `group flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
                            isActive
                              ? "bg-brand-600 text-white shadow-lg shadow-brand-900/40"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          } ${isHighlighted ? "ring-2 ring-brand-400" : ""}`;
                      return (
                        <Link
                          key={item.id}
                          to={buildWorkspacePath(item.id)}
                          activeOptions={{ exact: true }}
                          onClick={onClose}
                          className={itemClasses}
                          aria-current={isActive ? "page" : undefined}
                          aria-label={isDesktopCollapsed && !isMobile ? `Open ${item.label}` : undefined}
                          title={isDesktopCollapsed && !isMobile ? item.label : undefined}
                        >
                          <ItemIcon size={iconSize("lg")} />
                          {isDesktopCollapsed && !isMobile ? (
                            <>
                              <span className="sr-only">{item.label}</span>
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute left-[calc(100%+0.55rem)] top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-100 shadow-lg group-hover:block group-focus-visible:block"
                              >
                                {item.label}
                              </span>
                            </>
                          ) : (
                            <span>{item.label}</span>
                          )}
                        </Link>
                      );
                    })
                  : null}
              </section>
            );
          })
        )}
      </nav>

      <div className={`border-t border-slate-800 p-3 ${isDesktopCollapsed && !isMobile ? "space-y-2" : "space-y-3"}`}>
        {isDesktopCollapsed && !isMobile ? (
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-800/40 p-2">
            <button
              type="button"
              onClick={onDesktopCollapseToggle}
              className="mx-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 p-0 text-slate-100 transition-colors hover:border-slate-500 hover:text-white"
              aria-label="Show account options"
              title="Show account options"
            >
              {showAvatarImage ? (
                <img
                  src={userAvatarUrl ?? undefined}
                  alt={`Profile photo for ${displayName}`}
                  className="h-7 w-7 rounded-full border border-slate-600 object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                  {userInitials}
                </span>
              )}
            </button>
            <Link
              to={buildWorkspacePath("settings")}
              activeOptions={{ exact: true }}
              onClick={onClose}
              className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
                activePage === "settings" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
              aria-label="Open settings"
              title="Settings"
            >
              <SettingsIcon size={iconSize("lg")} />
            </Link>
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-800/70 to-slate-900/80 p-3 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.8)]">
            <div className="flex items-start gap-3">
              {showAvatarImage ? (
                <img
                  src={userAvatarUrl ?? undefined}
                  alt={`Profile photo for ${displayName}`}
                  className="h-10 w-10 shrink-0 rounded-full border border-slate-600 object-cover shadow-md"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white shadow-md">
                  {userInitials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                <p className="truncate text-xs text-slate-400">{schoolName}</p>
                {mascotName ? <p className="truncate text-[11px] text-brand-200">{mascotName}</p> : null}
                <span className="mt-2 inline-flex self-start rounded-full border border-brand-400/50 bg-brand-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-100">
                  {currentRole}
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {showSidebarTestControls ? (
                <div className="rounded-xl border border-slate-700 bg-slate-900/55 p-3">
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">View As Role</label>
                  <p className="mb-2 text-xs text-slate-400">Choose the perspective for this workspace.</p>
                  <select
                    value={currentRole}
                    onChange={(event) => onRoleChange(event.target.value as UserRole)}
                    disabled={availableRoles.length <= 1}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-slate-100 transition-colors focus:border-brand-400 focus:outline-none"
                    aria-label="Switch active role view"
                  >
                    {availableRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <Link
                to={buildWorkspacePath("settings")}
                activeOptions={{ exact: true }}
                onClick={onClose}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  activePage === "settings"
                    ? "border-brand-500/60 bg-brand-500/20 text-white"
                    : "border-slate-700 bg-slate-900/40 text-slate-200 hover:border-slate-500 hover:text-white"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <SettingsIcon size={iconSize("md")} />
                  <span className="text-sm font-medium">Settings</span>
                </span>
              </Link>

              {showSidebarTestControls ? (
                <div className="rounded-xl border border-slate-700 bg-slate-900/55 p-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Workspace Session</p>
                  <p className="mb-2 text-xs text-slate-400">Update organization context and authentication state.</p>
                  <TenantContextSwitcher variant="sidebar" />
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  availableRoles,
  onRoleChange,
  userName,
  userAvatarUrl,
  schoolName,
  brandLogoUrl,
  mascotName,
  isMobileOpen,
  onMobileClose,
  activePage,
  isDesktopCollapsed,
  onDesktopCollapseToggle,
  groupState,
  onGroupToggle,
  searchQuery,
  onSearchQueryChange,
  notificationUnseenCount = 0,
  activeNotifications = [],
  archivedNotifications = [],
  notificationLoading = false,
  notificationError = null,
  onNotificationOpen,
  onNotificationDismiss,
  onNotificationArchive,
  onNotificationDelete,
  onNotificationRestore,
  onNotificationMarkSeen,
  onNotificationMarkAllRead,
  onNotificationArchiveRead,
  onBeforeOpenNotificationSheet,
}) => {
  const navigate = useNavigate();
  const mobileDialogRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<WorkspacePageId | null>(null);

  const allItems = useMemo(() => getMenuGroups(currentRole).flatMap((group) => group.items), [currentRole]);
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allItems;
    return allItems.filter((item) => item.label.toLowerCase().includes(query));
  }, [allItems, searchQuery]);

  useEffect(() => {
    setHighlightedItemId(filteredItems[0]?.id ?? null);
  }, [filteredItems]);

  const navigateToItem = (id: WorkspacePageId) => {
    void navigate({ to: buildWorkspacePath(id) });
    onMobileClose();
  };

  useEffect(() => {
    if (!isMobileOpen) return;
    const target = searchInputRef.current ?? mobileDialogRef.current?.querySelector<HTMLElement>("button, a, input, select");
    target?.focus();
  }, [isMobileOpen]);

  useEffect(() => {
    if (!isMobileOpen || !mobileDialogRef.current) return;
    const container = mobileDialogRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onMobileClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileOpen, onMobileClose]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredItems.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const currentIndex = filteredItems.findIndex((item) => item.id === highlightedItemId);
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % filteredItems.length;
      setHighlightedItemId(filteredItems[nextIndex].id);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const currentIndex = filteredItems.findIndex((item) => item.id === highlightedItemId);
      const nextIndex = currentIndex <= 0 ? filteredItems.length - 1 : currentIndex - 1;
      setHighlightedItemId(filteredItems[nextIndex].id);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const match = highlightedItemId ? filteredItems.find((item) => item.id === highlightedItemId) : filteredItems[0];
      if (match) {
        navigateToItem(match.id);
      }
    }
  };

  const handleNotificationOpen = (id: string) => {
    onNotificationOpen?.(id);
  };
  const handleNotificationDismiss = (id: string) => {
    onNotificationDismiss?.(id);
  };
  const handleNotificationArchive = (id: string) => {
    onNotificationArchive?.(id);
  };
  const handleNotificationDelete = (id: string) => {
    onNotificationDelete?.(id);
  };
  const handleNotificationRestore = (id: string) => {
    onNotificationRestore?.(id);
  };
  const handleNotificationMarkSeen = (ids: string[]) => {
    onNotificationMarkSeen?.(ids);
  };
  const handleNotificationMarkAllRead = () => {
    onNotificationMarkAllRead?.();
  };
  const handleNotificationArchiveRead = () => {
    onNotificationArchiveRead?.();
  };
  const handleBeforeOpenNotificationSheet = () => {
    onBeforeOpenNotificationSheet?.();
  };

  return (
    <>
      {isMobileOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside
            ref={mobileDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-menu-title"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-hidden bg-slate-900 text-white shadow-xl lg:hidden"
          >
            <SidebarContent
              mode="mobile"
              currentRole={currentRole}
              availableRoles={availableRoles}
              onRoleChange={onRoleChange}
              userName={userName}
              userAvatarUrl={userAvatarUrl}
              schoolName={schoolName}
              brandLogoUrl={brandLogoUrl}
              mascotName={mascotName}
              activePage={activePage}
              isDesktopCollapsed={false}
              onDesktopCollapseToggle={onDesktopCollapseToggle}
              groupState={groupState}
              onGroupToggle={onGroupToggle}
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              notificationUnseenCount={notificationUnseenCount}
              activeNotifications={activeNotifications}
              archivedNotifications={archivedNotifications}
              notificationLoading={notificationLoading}
              notificationError={notificationError}
              onNotificationOpen={handleNotificationOpen}
              onNotificationDismiss={handleNotificationDismiss}
              onNotificationArchive={handleNotificationArchive}
              onNotificationDelete={handleNotificationDelete}
              onNotificationRestore={handleNotificationRestore}
              onNotificationMarkSeen={handleNotificationMarkSeen}
              onNotificationMarkAllRead={handleNotificationMarkAllRead}
              onNotificationArchiveRead={handleNotificationArchiveRead}
              onBeforeOpenNotificationSheet={handleBeforeOpenNotificationSheet}
              onSearchKeyDown={handleSearchKeyDown}
              highlightedItemId={highlightedItemId}
              onClose={onMobileClose}
              searchInputRef={searchInputRef}
            />
          </aside>
        </>
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden overflow-hidden bg-slate-900 text-white shadow-xl transition-[width] duration-200 lg:flex ${
          isDesktopCollapsed ? "w-20" : "w-64"
        }`}
      >
        <SidebarContent
          mode="desktop"
          currentRole={currentRole}
          availableRoles={availableRoles}
          onRoleChange={onRoleChange}
          userName={userName}
          userAvatarUrl={userAvatarUrl}
          schoolName={schoolName}
          brandLogoUrl={brandLogoUrl}
          mascotName={mascotName}
          activePage={activePage}
          isDesktopCollapsed={isDesktopCollapsed}
          onDesktopCollapseToggle={onDesktopCollapseToggle}
          groupState={groupState}
          onGroupToggle={onGroupToggle}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          notificationUnseenCount={notificationUnseenCount}
          activeNotifications={activeNotifications}
          archivedNotifications={archivedNotifications}
          notificationLoading={notificationLoading}
          notificationError={notificationError}
          onNotificationOpen={handleNotificationOpen}
          onNotificationDismiss={handleNotificationDismiss}
          onNotificationArchive={handleNotificationArchive}
          onNotificationDelete={handleNotificationDelete}
          onNotificationRestore={handleNotificationRestore}
          onNotificationMarkSeen={handleNotificationMarkSeen}
          onNotificationMarkAllRead={handleNotificationMarkAllRead}
          onNotificationArchiveRead={handleNotificationArchiveRead}
          onBeforeOpenNotificationSheet={handleBeforeOpenNotificationSheet}
          highlightedItemId={highlightedItemId}
          onClose={() => {
            // Desktop nav should remain open; no-op for shared link handlers.
          }}
        />
      </aside>
    </>
  );
};
