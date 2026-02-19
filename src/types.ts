
export enum Tier {
  TIER_1 = 'Tier 1',
  TIER_2 = 'Tier 2',
  TIER_3 = 'Tier 3',
}

export enum Trend {
  UP = 'Trending Up',
  STAGNANT = 'Stagnant',
  MET = 'Goal Met',
  DOWN = 'Trending Down',
}

export enum UserRole {
  PRINCIPAL = 'Principal',
  TEACHER = 'Teacher',
  DISTRICT = 'District Admin',
  PARENT = 'Parent',
}

// --- Calendar Types ---

export enum EventType {
  MTSS = 'MTSS Meeting',
  IEP = 'IEP Review',
  STAFF = 'Staff Meeting',
  PARENT = 'Parent Conference',
  DISTRICT = 'District Training',
  CLASS = 'Class Event',
  DEADLINE = 'Deadline'
}

export enum AttendanceStatus {
  ACCEPTED = 'Accepted',
  DECLINED = 'Declined',
  PENDING = 'Pending',
  ORGANIZER = 'Organizer'
}

export interface CalendarAttendee {
  name: string;
  role: UserRole;
  status: AttendanceStatus;
  avatarSeed?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  start: string; // ISO String
  end: string;   // ISO String
  allDay?: boolean;
  timezone?: string;
  location?: string;
  organizer: string;
  attendees: CalendarAttendee[];
  attachments?: Attachment[];
  recurrence?: {
    pattern: 'Daily' | 'Weekly' | 'Monthly';
    endDate: string;
  };
  parentId?: string;
}

// --- RAG & Document Types ---

export enum DocumentScope {
  DISTRICT = 'District',
  SCHOOL = 'School',
  CLASS = 'Class',
  STUDENT = 'Student',
  INTERNAL = 'Internal (Private)',
}

export enum ApprovalStatus {
  APPROVED = 'Approved',
  PENDING = 'Pending Approval',
  REJECTED = 'Rejected',
  NONE = 'No Approval Needed', // For downward sharing
}

export interface RAGDocument {
  id: string;
  name: string;
  type: string; // pdf, txt, etc
  uploadDate: string;
  uploaderName: string;
  uploaderRole: UserRole;
  scope: DocumentScope;
  targetId?: string; // SchoolID, ClassID, or StudentID depending on scope
  status: ApprovalStatus;
  summary?: string;
  size?: string;
  uri?: string; // Gemini File URI
  base64Data?: string;
  mimeType?: string;
  sourceUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  sources?: string[]; // Names of docs used
}

// --- Messaging Types ---

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'video';
  url: string; // Base64 data or URL
  name: string;
  size?: string;
  mimeType?: string;
}

export type MessageContextType = 'intervention' | 'referral';

export interface MessageThreadContext {
  type: MessageContextType;
  studentName: string;
  interventionId?: string;
  interventionPlanName?: string;
  referralId?: string;
  referralType?: string;
  referralUrgency?: string;
}

export interface MessagesLaunchContext {
  recipientName?: string;
  recipientRole?: UserRole;
  recipientNames?: string[];
  recipientRolesByName?: Record<string, UserRole>;
  context?: MessageThreadContext;
  draft?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string; // ISO string or relative time
  isRead: boolean;
  isMe: boolean; // Helper for UI rendering
  attachments?: Attachment[];
  threadContext?: MessageThreadContext;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: UserRole | 'Group';
  participantAvatarSeed: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
  isGroup?: boolean;
  participants?: string[]; // List of names participating
  threadContext?: MessageThreadContext;
}

export type NotificationCategory = 'Message' | 'Referral' | 'Intervention' | 'Document' | 'System';
export type NotificationSeverity = 'info' | 'warning' | 'critical';
export type NotificationSourceType = 'messages' | 'referrals' | 'interventions' | 'documents' | 'system';

export interface NotificationRow {
  id: string;
  recipientUserId: string;
  recipientUserName: string;
  title: string;
  summary: string;
  body: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  sourceType: NotificationSourceType;
  sourceId: string;
  sourceFingerprint: string;
  sourceRoute?: string;
  sourceContext?: Record<string, string>;
  createdAt: string;
  seenAt?: string;
  readAt?: string;
  dismissedAt?: string;
  archivedAt?: string;
  deletedAt?: string;
  updatedAt: string;
}

export type NotificationListItem = NotificationRow;

// --- Existing Types ---

export interface MetricData {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down';
  metricWindow?: string;
  metricBaseline?: string;
  status?: 'success' | 'warning' | 'danger' | 'neutral';
  icon: string;
}

export interface ActionItem {
  id: string;
  studentName: string;
  grade: string;
  category: 'Academic' | 'Attendance' | 'Behavior' | 'System';
  insight: string;
  isAiDetected: boolean;
}

export interface StudentMonitoring {
  id: string;
  name: string;
  intervention: string;
  trend: Trend;
}

export interface DashboardData {
  role: UserRole;
  userName: string;
  schoolName: string;
  metrics: MetricData[];
  actionItems: ActionItem[];
  tierDistribution?: { tier: Tier; count: number; percentage: number }[];
  monitoringPulse: StudentMonitoring[];
  chartData: { name: string; value: number; fill: string }[];
  chartTitle: string;
}

export interface InterventionDataPoint {
  date: string;
  score: number;
  notes?: string;
}

export interface Intervention {
  id: number;
  name: string;
  date: string; // Start Date
  status: string;
  progress: number; // Calculated percentage of goal met or current score
  baselineScore: number;
  goalScore: number;
  dataPoints: InterventionDataPoint[];
}

export interface ActivityLog {
  date: string;
  type: string;
  note: string;
  source?: string;
  isNew?: boolean;
  tags?: string[];
}

export interface AiRecommendation {
  id: string;
  name: string;
  reason: string;
  action: string;
  confidenceLevel: string;
  confidenceScore: number;
}

export interface MedicalInfo {
  allergies: string[];
  medications: string[];
  visionScreening: { status: 'Pass' | 'Fail' | 'Corrected', date: string, notes?: string };
  hearingScreening: { status: 'Pass' | 'Fail', date: string };
  conditions: string[];
}

export interface SupportProfile {
  planType: 'IEP' | '504 Plan' | 'None';
  primaryDisability?: string;
  nextReviewDate?: string;
  accommodations: string[];
  behavioralStrategies: string[];
}

export interface StudentDetails {
  id: string;
  name?: string; // Optional as it's passed in separate args usually
  grade: string;
  teacher: string;
  tier: Tier;
  attendance: number;
  gpa: string;
  readingLevel: string;
  interventions: Intervention[];
  recentActivity: ActivityLog[];
  aiRecommendations: AiRecommendation[];
  medical: MedicalInfo;
  support: SupportProfile;
}

export interface StaffRosterItem {
  id: string;
  name: string;
  role: 'Teacher' | 'Consultant' | 'Specialist';
  isInterventionist?: boolean;
  interventionFocus?: Array<'Math' | 'Reading'>;
  grade?: string;
  studentCount: number;
  attendanceRate: number; // Class average
  performanceMetric: string; // e.g. "82% Math Proficiency"
  mtssFidelityScore: number; // 0-100
  activeInterventions: number;
  flaggedStudents: number;
  avatarSeed: string;
  customAvatar?: string;
}

export interface StudentRosterItem {
  id: string;
  name: string;
  grade: string;
  tier: Tier;
  gpa: string;
  attendance: number;
  readingLevel: string;
  activeInterventions: number;
  alerts: number;
  avatarSeed: string;
  teacherName?: string;
  teacher?: string;
  status?: 'active' | 'monitoring' | 'completed' | 'unknown';
  isArchived?: boolean;
}

export interface SchoolNode {
  id: string;
  name: string;
  type: 'Elementary' | 'Middle' | 'High';
  principal: string;
  studentCount: number;
  attendanceRate: number;
  tier3Count: number;
  tierDistribution: { name: string; value: number; color: string }[]; // Added
  status: 'On Track' | 'Watch' | 'Critical';
  coordinates: { x: number; y: number };
  alerts: number;
}
