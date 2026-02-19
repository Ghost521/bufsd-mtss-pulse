import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  BookCopy,
  BookOpen,
  Bot,
  Bell,
  Calendar,
  FileText,
  FolderOpen,
  HardDriveUpload,
  LayoutDashboard,
  MessageSquare,
  Plus,
  RefreshCw,
  School,
  Settings,
  User,
  Users,
} from "lucide-react";

import type { WorkspacePageId } from "../workspaceRoutes";

export type IconSizeToken = "xs" | "sm" | "md" | "lg" | "xl";

export const ICON_SIZE_PX: Record<IconSizeToken, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
};

export const iconSize = (token: IconSizeToken): number => ICON_SIZE_PX[token];

export const ROUTE_ICON_BY_PAGE: Record<WorkspacePageId, LucideIcon> = {
  dashboard: LayoutDashboard,
  rosters: Users,
  class_roster: Users,
  gradebook: BookOpen,
  lesson_plans: BookCopy,
  interventions: FileText,
  calendar: Calendar,
  reports: BarChart2,
  messages: MessageSquare,
  notifications: Bell,
  documents: FolderOpen,
  import: HardDriveUpload,
  map: School,
  settings: Settings,
  profile: User,
};

export const getRouteIcon = (page: WorkspacePageId): LucideIcon => ROUTE_ICON_BY_PAGE[page];

export const ACTION_ICON_BY_ID = {
  createReferral: Plus,
  refreshData: RefreshCw,
  aiSummary: Bot,
} as const;
