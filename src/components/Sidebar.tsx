import React from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  BarChart2,
  Settings,
  GraduationCap,
  BookOpen,
  School,
  MessageCircle,
  ClipboardList,
  X,
  Database,
  HardDriveUpload,
  BookCopy,
} from "lucide-react";
import { UserRole } from "../types";
import { TenantContextSwitcher } from "./TenantContextSwitcher";

interface SidebarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  userName: string;
  schoolName: string;
  isOpen: boolean;
  onClose: () => void;
  activePage: string;
  onNavigate: (page: string) => void;
}

type WorkspaceNavItem = {
  id: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  implemented: boolean;
};

const getMenuItems = (role: UserRole): WorkspaceNavItem[] => {
  const knowledgeBaseItem: WorkspaceNavItem = { id: "documents", icon: Database, label: "Knowledge Base", implemented: true };
  const messagesItem: WorkspaceNavItem = { id: "messages", icon: MessageCircle, label: "Messages", implemented: true };
  const calendarItem: WorkspaceNavItem = { id: "calendar", icon: Calendar, label: "Calendar", implemented: true };
  const importItem: WorkspaceNavItem = { id: "import", icon: HardDriveUpload, label: "Data Import", implemented: true };
  const lessonPlansItem: WorkspaceNavItem = { id: "lesson_plans", icon: BookCopy, label: "Lesson Plans", implemented: true };

  switch (role) {
    case UserRole.PRINCIPAL:
      return [
        { id: "dashboard", icon: LayoutDashboard, label: "Command Center", implemented: true },
        { id: "rosters", icon: Users, label: "Rosters", implemented: true },
        lessonPlansItem,
        { id: "interventions", icon: FileText, label: "Intervention Plans", implemented: true },
        calendarItem,
        { id: "reports", icon: BarChart2, label: "District Reports", implemented: true },
        messagesItem,
        knowledgeBaseItem,
        importItem,
      ];
    case UserRole.TEACHER:
      return [
        { id: "dashboard", icon: LayoutDashboard, label: "My Classroom", implemented: true },
        { id: "class_roster", icon: Users, label: "Roster", implemented: true },
        { id: "gradebook", icon: BookOpen, label: "Gradebook", implemented: true },
        lessonPlansItem,
        { id: "interventions", icon: FileText, label: "Interventions", implemented: true },
        calendarItem,
        messagesItem,
        knowledgeBaseItem,
        importItem,
      ];
    case UserRole.DISTRICT:
      return [
        { id: "dashboard", icon: LayoutDashboard, label: "District Pulse", implemented: true },
        { id: "map", icon: School, label: "Schools Map", implemented: true },
        { id: "reports", icon: BarChart2, label: "System Reports", implemented: true },
        { id: "staffing", icon: Users, label: "Staffing", implemented: false },
        calendarItem,
        messagesItem,
        knowledgeBaseItem,
        importItem,
      ];
    case UserRole.PARENT:
      return [
        { id: "dashboard", icon: LayoutDashboard, label: "My Child", implemented: true },
        { id: "assignments", icon: ClipboardList, label: "Assignments", implemented: false },
        { id: "reports", icon: FileText, label: "Report Cards", implemented: true },
        calendarItem,
        messagesItem,
        knowledgeBaseItem,
      ];
    default:
      return [];
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  onRoleChange,
  userName,
  schoolName,
  isOpen,
  onClose,
  activePage,
  onNavigate,
}) => {
  const menuItems = getMenuItems(currentRole).filter((item) => item.implemented);

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-900 text-white shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        } lg:translate-x-0 lg:pointer-events-auto`}
      >
        <div className="flex h-full flex-col">
          <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-600 p-2">
                  <GraduationCap size={24} className="text-white" />
                </div>
                <div className="overflow-hidden">
                  <h1 className="whitespace-nowrap text-lg font-bold leading-tight">BUFSD MTSS</h1>
                  <p className="max-w-[140px] truncate text-xs font-medium tracking-wide text-slate-400">{schoolName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-700 p-1.5 text-slate-300 transition-colors hover:border-slate-500 hover:text-white lg:hidden"
                aria-label="Close workspace menu"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="px-4 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Workspace</p>
            <p className="text-xs font-semibold text-slate-300">Role Tools</p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {menuItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                    isActive ? "bg-brand-600 text-white shadow-lg shadow-brand-900/50" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={`Open ${item.label}`}
                >
                  <span className="flex items-center gap-3">
                    <item.icon size={20} />
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="space-y-4 border-t border-slate-800 p-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Demo Role</label>
              <select
                value={currentRole}
                onChange={(event) => onRoleChange(event.target.value as UserRole)}
                className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-slate-300 focus:border-brand-500 focus:outline-none"
                aria-label="Switch workspace role"
              >
                {Object.values(UserRole).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                onNavigate("settings");
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                activePage === "settings" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Settings size={20} />
              <span className="text-sm font-medium">Settings</span>
            </button>

            <div className="rounded-xl bg-slate-800/50 p-3">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-brand-500 text-center text-white shadow-md">
                  <span className="inline-flex h-10 items-center justify-center font-bold">{userName.substring(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-semibold text-white">{userName}</p>
                  <p className="truncate text-xs text-slate-400">{currentRole}</p>
                </div>
              </div>
              <TenantContextSwitcher variant="sidebar" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
