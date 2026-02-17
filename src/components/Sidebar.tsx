import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart2,
  BookCopy,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  GraduationCap,
  HardDriveUpload,
  LayoutDashboard,
  MessageCircle,
  School,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { UserRole } from "../types";
import { TenantContextSwitcher } from "./TenantContextSwitcher";
import type { WorkspacePageId } from "../lib/workspaceRoutes";
import { buildWorkspacePath } from "../lib/workspaceRoutes";
import type { SidebarGroupState } from "../hooks/useSidebarState";

interface SidebarProps {
  currentRole: UserRole;
  availableRoles: UserRole[];
  onRoleChange: (role: UserRole) => void;
  userName: string;
  schoolName: string;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  activePage: WorkspacePageId;
  isDesktopCollapsed: boolean;
  onDesktopCollapseToggle: () => void;
  groupState: SidebarGroupState;
  onGroupToggle: (groupId: string, defaultExpanded?: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

type WorkspaceNavItem = {
  id: WorkspacePageId;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
};

type WorkspaceNavGroup = {
  id: string;
  label: string;
  defaultExpanded?: boolean;
  items: WorkspaceNavItem[];
};

const getMenuGroups = (role: UserRole): WorkspaceNavGroup[] => {
  const dashboardByRole: Record<UserRole, WorkspaceNavItem> = {
    [UserRole.PRINCIPAL]: { id: "dashboard", icon: LayoutDashboard, label: "Leadership Dashboard" },
    [UserRole.TEACHER]: { id: "dashboard", icon: LayoutDashboard, label: "Classroom Dashboard" },
    [UserRole.DISTRICT]: { id: "dashboard", icon: LayoutDashboard, label: "District Dashboard" },
    [UserRole.PARENT]: { id: "dashboard", icon: LayoutDashboard, label: "Student Progress" },
  };

  const workItemsByRole: Record<UserRole, WorkspaceNavItem[]> = {
    [UserRole.PRINCIPAL]: [
      dashboardByRole[UserRole.PRINCIPAL],
      { id: "rosters", icon: Users, label: "Rosters" },
      { id: "interventions", icon: FileText, label: "Intervention Plans" },
      { id: "reports", icon: BarChart2, label: "School Reports" },
    ],
    [UserRole.TEACHER]: [
      dashboardByRole[UserRole.TEACHER],
      { id: "class_roster", icon: Users, label: "Roster" },
      { id: "gradebook", icon: BookOpen, label: "Gradebook" },
      { id: "interventions", icon: FileText, label: "Interventions" },
    ],
    [UserRole.DISTRICT]: [
      dashboardByRole[UserRole.DISTRICT],
      { id: "map", icon: School, label: "Schools Map" },
      { id: "reports", icon: BarChart2, label: "System Reports" },
    ],
    [UserRole.PARENT]: [
      dashboardByRole[UserRole.PARENT],
      { id: "reports", icon: FileText, label: "Report Cards" },
    ],
  };

  const planningItemsByRole: Record<UserRole, WorkspaceNavItem[]> = {
    [UserRole.PRINCIPAL]: [
      { id: "lesson_plans", icon: BookCopy, label: "Lesson Plans" },
      { id: "calendar", icon: Calendar, label: "Calendar" },
    ],
    [UserRole.TEACHER]: [
      { id: "lesson_plans", icon: BookCopy, label: "Lesson Plans" },
      { id: "calendar", icon: Calendar, label: "Calendar" },
    ],
    [UserRole.DISTRICT]: [{ id: "calendar", icon: Calendar, label: "Calendar" }],
    [UserRole.PARENT]: [{ id: "calendar", icon: Calendar, label: "Calendar" }],
  };

  return [
    { id: "work", label: "Work", defaultExpanded: true, items: workItemsByRole[role] },
    { id: "planning", label: "Planning", defaultExpanded: true, items: planningItemsByRole[role] },
    { id: "communication", label: "Communication", defaultExpanded: true, items: [{ id: "messages", icon: MessageCircle, label: "Messages" }] },
    {
      id: "administration",
      label: "Administration",
      defaultExpanded: true,
      items:
        role === UserRole.PARENT
          ? [{ id: "documents", icon: Database, label: "Resource Library" }]
          : [
              { id: "documents", icon: Database, label: "Resource Library" },
              { id: "import", icon: HardDriveUpload, label: "Data Integrations" },
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
  schoolName: string;
  activePage: WorkspacePageId;
  isDesktopCollapsed: boolean;
  onDesktopCollapseToggle: () => void;
  groupState: SidebarGroupState;
  onGroupToggle: (groupId: string, defaultExpanded?: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
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
  schoolName,
  activePage,
  isDesktopCollapsed,
  onDesktopCollapseToggle,
  groupState,
  onGroupToggle,
  searchQuery,
  onSearchQueryChange,
  onSearchKeyDown,
  highlightedItemId,
  onClose,
  searchInputRef,
}) => {
  const isMobile = mode === "mobile";
  const navGroups = useMemo(() => getMenuGroups(currentRole), [currentRole]);
  const normalizedQuery = searchQuery.trim().toLowerCase();

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

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className={`flex items-center gap-3 ${isDesktopCollapsed && !isMobile ? "justify-center" : ""}`}>
            <div className="rounded-lg bg-brand-600 p-2">
              <GraduationCap size={22} className="text-white" />
            </div>
            {isDesktopCollapsed && !isMobile ? null : (
              <div className="overflow-hidden">
                <h1 id={isMobile ? "workspace-menu-title" : undefined} className="whitespace-nowrap text-lg font-bold leading-tight">
                  BUFSD MTSS
                </h1>
                <p className="max-w-[165px] truncate text-xs font-medium tracking-wide text-slate-400">{schoolName}</p>
              </div>
            )}
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 p-1.5 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              aria-label="Close workspace menu"
            >
              <X size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onDesktopCollapseToggle}
              className="hidden rounded-md border border-slate-700 p-1.5 text-slate-300 transition-colors hover:border-slate-500 hover:text-white lg:inline-flex"
              aria-label={isDesktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isDesktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isDesktopCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {isDesktopCollapsed && !isMobile ? null : (
          <>
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">MTSS Platform</p>
              <p className="text-xs font-semibold text-slate-300">Role Workspace</p>
            </div>
            <div className="mt-3">
              <label htmlFor={`sidebar-search-${mode}`} className="sr-only">
                Search navigation
              </label>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id={`sidebar-search-${mode}`}
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Quick navigation"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <nav className={navContainerClasses} aria-label="Workspace navigation">
        {filteredGroups.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-400">No matching pages.</p>
        ) : (
          filteredGroups.map((group) => {
            const isExpanded = normalizedQuery ? true : groupState[group.id] ?? group.defaultExpanded ?? true;
            return (
              <section key={group.id} className="space-y-1">
                {isDesktopCollapsed && !isMobile ? null : (
                  <button
                    type="button"
                    onClick={() => onGroupToggle(group.id, group.defaultExpanded ?? true)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                    aria-expanded={isExpanded}
                  >
                    {group.label}
                    <ChevronDown size={12} className={`transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                  </button>
                )}
                {isExpanded || (isDesktopCollapsed && !isMobile)
                  ? group.items.map((item) => {
                      const isActive = activePage === item.id;
                      const isHighlighted = highlightedItemId === item.id && normalizedQuery.length > 0;
                      const itemClasses = isDesktopCollapsed && !isMobile
                        ? `group flex w-full items-center justify-center rounded-lg px-2 py-2.5 transition-all duration-150 ${
                            isActive
                              ? "bg-brand-600 text-white shadow-lg shadow-brand-900/40"
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
                          <item.icon size={18} />
                          {isDesktopCollapsed && !isMobile ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
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
          <>
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
              <Settings size={18} />
            </Link>
            <button
              type="button"
              onClick={onDesktopCollapseToggle}
              className="flex w-full items-center justify-center rounded-lg bg-slate-800/60 p-2 text-slate-200"
              aria-label="Expand account and workspace controls"
              title="Expand account and workspace controls"
            >
              <span className="text-xs font-semibold">{userName.substring(0, 2).toUpperCase()}</span>
            </button>
          </>
        ) : (
          <details className="rounded-xl border border-slate-800 bg-slate-800/50 p-3" open>
            <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Account &amp; Workspace
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">View As Role</label>
                <select
                  value={currentRole}
                  onChange={(event) => onRoleChange(event.target.value as UserRole)}
                  disabled={availableRoles.length <= 1}
                  className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-slate-200 focus:border-brand-500 focus:outline-none"
                  aria-label="Switch active role view"
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <Link
                to={buildWorkspacePath("settings")}
                activeOptions={{ exact: true }}
                onClick={onClose}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  activePage === "settings" ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <Settings size={16} />
                <span className="text-sm font-medium">Settings</span>
              </Link>

              <div className="rounded-lg bg-slate-900/50 p-3">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-brand-500 text-center text-white shadow-md">
                    <span className="inline-flex h-9 items-center justify-center font-bold">{userName.substring(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-semibold text-white">{userName}</p>
                    <p className="truncate text-xs text-slate-400">{currentRole}</p>
                  </div>
                </div>
                <TenantContextSwitcher variant="sidebar" />
              </div>
            </div>
          </details>
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
  schoolName,
  isMobileOpen,
  onMobileClose,
  activePage,
  isDesktopCollapsed,
  onDesktopCollapseToggle,
  groupState,
  onGroupToggle,
  searchQuery,
  onSearchQueryChange,
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
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-white shadow-xl lg:hidden"
          >
            <SidebarContent
              mode="mobile"
              currentRole={currentRole}
              availableRoles={availableRoles}
              onRoleChange={onRoleChange}
              userName={userName}
              schoolName={schoolName}
              activePage={activePage}
              isDesktopCollapsed={false}
              onDesktopCollapseToggle={onDesktopCollapseToggle}
              groupState={groupState}
              onGroupToggle={onGroupToggle}
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              onSearchKeyDown={handleSearchKeyDown}
              highlightedItemId={highlightedItemId}
              onClose={onMobileClose}
              searchInputRef={searchInputRef}
            />
          </aside>
        </>
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden bg-slate-900 text-white shadow-xl transition-[width] duration-200 lg:flex ${
          isDesktopCollapsed ? "w-20" : "w-64"
        }`}
      >
        <SidebarContent
          mode="desktop"
          currentRole={currentRole}
          availableRoles={availableRoles}
          onRoleChange={onRoleChange}
          userName={userName}
          schoolName={schoolName}
          activePage={activePage}
          isDesktopCollapsed={isDesktopCollapsed}
          onDesktopCollapseToggle={onDesktopCollapseToggle}
          groupState={groupState}
          onGroupToggle={onGroupToggle}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          highlightedItemId={highlightedItemId}
          onClose={() => {
            // Desktop nav should remain open; no-op for shared link handlers.
          }}
        />
      </aside>
    </>
  );
};
