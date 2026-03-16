import React, { lazy } from 'react';
import type {
  MessagesLaunchContext,
  NotificationListItem,
  RAGDocument,
} from '../types';
import { ApprovalStatus, DocumentScope, UserRole } from '../types';
import type { WorkspacePageId } from '../lib/workspaceRoutes';

const StudentProfile = lazy(() => import('./StudentProfile').then((m) => ({ default: m.StudentProfile })));
const RosterView = lazy(() => import('./RosterView').then((m) => ({ default: m.RosterView })));
const StudentRosterView = lazy(() => import('./StudentRosterView').then((m) => ({ default: m.StudentRosterView })));
const GradebookView = lazy(() => import('./GradebookView').then((m) => ({ default: m.GradebookView })));
const LessonPlanLibrary = lazy(() => import('./LessonPlanLibrary').then((m) => ({ default: m.LessonPlanLibrary })));
const DocumentManager = lazy(() => import('./DocumentManager').then((m) => ({ default: m.DocumentManager })));
const MessagesView = lazy(() => import('./MessagesView').then((m) => ({ default: m.MessagesView })));
const NotificationsView = lazy(() => import('./NotificationsView').then((m) => ({ default: m.NotificationsView })));
const CalendarView = lazy(() => import('./CalendarView').then((m) => ({ default: m.CalendarView })));
const SchoolsMapView = lazy(() => import('./SchoolsMapView').then((m) => ({ default: m.SchoolsMapView })));
const DataImporter = lazy(() => import('./DataImporter').then((m) => ({ default: m.DataImporter })));
const ReportsView = lazy(() => import('./ReportsView').then((m) => ({ default: m.ReportsView })));
const InterventionManager = lazy(() => import('./InterventionManager').then((m) => ({ default: m.InterventionManager })));
const SettingsView = lazy(() => import('./SettingsView').then((m) => ({ default: m.SettingsView })));

type WorkspaceNotificationsProps = {
  activeNotifications: NotificationListItem[];
  archivedNotifications: NotificationListItem[];
  trashNotifications: NotificationListItem[];
  unreadCount: number;
  loading: boolean;
  errorMessage: string | null;
  onOpenNotification: (id: string) => void;
  onDismissNotification: (id: string) => void;
  onArchiveNotification: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onRestoreNotification: (id: string) => void;
  onMarkAllRead: () => void;
  onArchiveRead: () => void;
};

type WorkspacePageContentProps = {
  currentViewPage: WorkspacePageId;
  profileStudent: string | null;
  currentRole: UserRole;
  currentUserName: string;
  currentSchoolName: string;
  currentUserId: string | null;
  ragDocuments: RAGDocument[];
  messageLaunchContext: MessagesLaunchContext | null;
  referralQueueFocusId: string | null;
  notificationErrorMessage: string | null;
  notifications: WorkspaceNotificationsProps;
  renderDashboard: () => React.ReactNode;
  onOpenMobileMenu: () => void;
  onNavigateToPage: (page: WorkspacePageId) => void;
  onNavigateToMessages: (launch?: string | MessagesLaunchContext) => void;
  onStudentClick: (studentName: string) => void;
  onBackToDashboard: () => void;
  onUploadDocument: (doc: RAGDocument) => void;
  onApproveDocument: (id: string) => void;
  onRejectDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onStatusChange: (id: string, status: ApprovalStatus) => void;
  onScopeChange: (id: string, scope: DocumentScope) => void;
  onReferralHighlightConsumed: () => void;
};

export function WorkspacePageContent({
  currentViewPage,
  profileStudent,
  currentRole,
  currentUserName,
  currentSchoolName,
  currentUserId,
  ragDocuments,
  messageLaunchContext,
  referralQueueFocusId,
  notificationErrorMessage: _notificationErrorMessage,
  notifications,
  renderDashboard,
  onOpenMobileMenu,
  onNavigateToPage,
  onNavigateToMessages,
  onStudentClick,
  onBackToDashboard,
  onUploadDocument,
  onApproveDocument,
  onRejectDocument,
  onDeleteDocument,
  onStatusChange,
  onScopeChange,
  onReferralHighlightConsumed,
}: WorkspacePageContentProps) {
  switch (currentViewPage) {
    case 'profile':
      return profileStudent ? (
        <StudentProfile
          studentName={profileStudent}
          onBack={onBackToDashboard}
          onMenuClick={onOpenMobileMenu}
          onMessageClick={() => onNavigateToMessages('Mrs. Martinez')}
          currentUserRole={currentRole}
          currentUserName={currentUserName}
          currentUserId={currentUserId}
        />
      ) : (
        <SettingsView
          currentUserRole={currentRole}
          currentUserName={currentUserName}
          currentSchoolName={currentSchoolName}
        />
      );
    case 'rosters':
      return (
        <RosterView
          onMenuClick={onOpenMobileMenu}
          onEmailClick={(name) => onNavigateToMessages(name)}
          onStudentClick={onStudentClick}
          onNavigate={onNavigateToPage}
          currentUserRole={currentRole}
          defaultTab={currentRole === UserRole.PRINCIPAL ? 'students' : 'staff'}
        />
      );
    case 'class_roster':
      return (
        <StudentRosterView
          key={currentRole}
          onMenuClick={onOpenMobileMenu}
          onStudentClick={onStudentClick}
          currentUserRole={currentRole}
          viewType={currentRole === UserRole.PRINCIPAL || currentRole === UserRole.DISTRICT ? 'master' : 'classroom'}
          onNavigate={onNavigateToPage}
        />
      );
    case 'gradebook':
      return <GradebookView onMenuClick={onOpenMobileMenu} currentUserRole={currentRole} />;
    case 'lesson_plans':
      return (
        <LessonPlanLibrary
          onMenuClick={onOpenMobileMenu}
          currentUserRole={currentRole}
          currentUserName={currentUserName}
          currentSchoolName={currentSchoolName}
          onComposeMessage={onNavigateToMessages}
        />
      );
    case 'documents':
      return (
        <DocumentManager
          currentUserRole={currentRole}
          currentSchoolName={currentSchoolName}
          currentUserName={currentUserName}
          documents={ragDocuments}
          onUpload={onUploadDocument}
          onApprove={onApproveDocument}
          onReject={onRejectDocument}
          onDelete={onDeleteDocument}
          onStatusChange={onStatusChange}
          onScopeChange={onScopeChange}
          onMenuClick={onOpenMobileMenu}
        />
      );
    case 'messages':
      return (
        <MessagesView
          currentUserRole={currentRole}
          currentUserName={currentUserName}
          onMenuClick={onOpenMobileMenu}
          launchContext={messageLaunchContext}
        />
      );
    case 'notifications':
      return (
        <NotificationsView
          activeNotifications={notifications.activeNotifications}
          archivedNotifications={notifications.archivedNotifications}
          trashNotifications={notifications.trashNotifications}
          unreadCount={notifications.unreadCount}
          loading={notifications.loading}
          errorMessage={notifications.errorMessage}
          onOpenNotification={notifications.onOpenNotification}
          onDismissNotification={notifications.onDismissNotification}
          onArchiveNotification={notifications.onArchiveNotification}
          onDeleteNotification={notifications.onDeleteNotification}
          onRestoreNotification={notifications.onRestoreNotification}
          onMarkAllRead={notifications.onMarkAllRead}
          onArchiveRead={notifications.onArchiveRead}
        />
      );
    case 'calendar':
      return (
        <CalendarView
          currentUserRole={currentRole}
          currentUserName={currentUserName}
          onMenuClick={onOpenMobileMenu}
        />
      );
    case 'map':
      return <SchoolsMapView onMenuClick={onOpenMobileMenu} onNavigate={onNavigateToPage} />;
    case 'import':
      return (
        <DataImporter
          onMenuClick={onOpenMobileMenu}
          onImportComplete={() => onNavigateToPage('dashboard')}
          currentUserRole={currentRole}
        />
      );
    case 'reports':
      return (
        <ReportsView
          currentUserRole={currentRole}
          currentUserName={currentUserName}
          onNavigate={onNavigateToPage}
        />
      );
    case 'interventions':
      return (
        <InterventionManager
          onStudentClick={onStudentClick}
          onMenuClick={onOpenMobileMenu}
          currentUserRole={currentRole}
          currentUserName={currentUserName}
          onComposeMessage={onNavigateToMessages}
          highlightedReferralId={referralQueueFocusId}
          onReferralHighlightConsumed={onReferralHighlightConsumed}
        />
      );
    case 'settings':
      return (
        <SettingsView
          currentUserRole={currentRole}
          currentUserName={currentUserName}
          currentSchoolName={currentSchoolName}
        />
      );
    default:
      return renderDashboard();
  }
}
