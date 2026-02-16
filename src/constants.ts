
// ... existing imports ...
import type { DashboardData, StudentDetails, StaffRosterItem, StudentRosterItem, RAGDocument, Conversation, CalendarEvent, SchoolNode } from './types';
import { Tier, Trend, UserRole, DocumentScope, ApprovalStatus, EventType, AttendanceStatus } from './types';

// --- MOCK CALENDAR EVENTS ---
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const nextWeek = new Date(today);
nextWeek.setDate(today.getDate() + 7);

const dateAt = (base: Date, hour: number, minute = 0): string => {
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
};

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'evt1',
    title: 'MTSS Review: Leo Martinez',
    type: EventType.MTSS,
    description: 'Review Tier 2 reading intervention progress and determine if Tier 3 is necessary.',
    start: dateAt(today, 14),
    end: dateAt(today, 15),
    location: 'Conference Room B',
    organizer: 'Rosa Cortese',
    attachments: [],
    attendees: [
      { name: 'Rosa Cortese', role: UserRole.PRINCIPAL, status: AttendanceStatus.ORGANIZER, avatarSeed: 'RosaCortese' },
      { name: 'Mr. Davis', role: UserRole.TEACHER, status: AttendanceStatus.ACCEPTED, avatarSeed: 'MrDavis' },
      { name: 'Dr. Evans', role: UserRole.PRINCIPAL, status: AttendanceStatus.PENDING, avatarSeed: 'DrEvans' },
      { name: 'Mrs. Martinez', role: UserRole.PARENT, status: AttendanceStatus.PENDING, avatarSeed: 'MrsMartinez' }
    ]
  },
  {
    id: 'evt2',
    title: 'Staff Faculty Meeting',
    type: EventType.STAFF,
    description: 'Monthly faculty meeting. Agenda: New District Attendance Policy.',
    start: dateAt(tomorrow, 8),
    end: dateAt(tomorrow, 9),
    location: 'Library',
    organizer: 'Rosa Cortese',
    attachments: [],
    attendees: [
      { name: 'Rosa Cortese', role: UserRole.PRINCIPAL, status: AttendanceStatus.ORGANIZER, avatarSeed: 'RosaCortese' },
      { name: 'Mr. Davis', role: UserRole.TEACHER, status: AttendanceStatus.ACCEPTED, avatarSeed: 'MrDavis' },
      { name: 'Mrs. Johnson', role: UserRole.TEACHER, status: AttendanceStatus.ACCEPTED, avatarSeed: 'MrsJohnson' }
    ]
  },
  {
    id: 'evt3',
    title: 'District MTSS Training',
    type: EventType.DISTRICT,
    description: 'Mandatory training for all building admins on the new data dashboard.',
    start: dateAt(nextWeek, 10),
    end: dateAt(nextWeek, 12),
    location: 'Zoom',
    organizer: 'Dr. Aris Thorne',
    attachments: [],
    attendees: [
      { name: 'Dr. Aris Thorne', role: UserRole.DISTRICT, status: AttendanceStatus.ORGANIZER, avatarSeed: 'DrArisThorne' },
      { name: 'Rosa Cortese', role: UserRole.PRINCIPAL, status: AttendanceStatus.ACCEPTED, avatarSeed: 'RosaCortese' }
    ]
  },
  {
    id: 'evt4',
    title: 'Parent-Teacher Conf: Emma Wilson',
    type: EventType.PARENT,
    description: 'Discuss reading assessment results.',
    start: dateAt(tomorrow, 15, 30),
    end: dateAt(tomorrow, 16),
    location: 'Room 204',
    organizer: 'Mr. Davis',
    attachments: [],
    attendees: [
      { name: 'Mr. Davis', role: UserRole.TEACHER, status: AttendanceStatus.ORGANIZER, avatarSeed: 'MrDavis' }
    ]
  },
  {
    id: 'evt5',
    title: 'Grades Due',
    type: EventType.DEADLINE,
    description: 'Q1 Progress Reports must be submitted.',
    start: dateAt(today, 17),
    end: dateAt(today, 17),
    location: 'System',
    organizer: 'District',
    attachments: [],
    attendees: [
      { name: 'Mr. Davis', role: UserRole.TEACHER, status: AttendanceStatus.PENDING, avatarSeed: 'MrDavis' },
      { name: 'Mrs. Johnson', role: UserRole.TEACHER, status: AttendanceStatus.PENDING, avatarSeed: 'MrsJohnson' }
    ]
  }
];

// --- MOCK MESSAGES DATA ---
export const MOCK_CONVERSATIONS: Conversation[] = [
  // ... [Keeping existing conversations] ...
  {
    id: 'c1',
    participantId: 'p1',
    participantName: 'Mrs. Martinez', 
    participantRole: UserRole.PARENT,
    participantAvatarSeed: 'MrsMartinez',
    lastMessage: 'Thank you for the update on Leo.',
    lastMessageTime: '10:30 AM',
    unreadCount: 0,
    isGroup: false,
    participants: ['Mr. Davis', 'Mrs. Martinez'],
    messages: [
      { id: 'm1', senderId: 'u1', senderName: 'Mr. Davis', content: 'Hi Mrs. Martinez, I wanted to share that Leo did great on his math quiz today!', timestamp: '10:00 AM', isRead: true, isMe: true },
      { id: 'm2', senderId: 'p1', senderName: 'Mrs. Martinez', content: 'That is wonderful news! He was studying hard last night.', timestamp: '10:15 AM', isRead: true, isMe: false },
      { id: 'm3', senderId: 'p1', senderName: 'Mrs. Martinez', content: 'Thank you for the update on Leo.', timestamp: '10:30 AM', isRead: true, isMe: false }
    ]
  },
  {
    id: 'c2',
    participantId: 's3',
    participantName: 'Rosa Cortese',
    participantRole: UserRole.PRINCIPAL,
    participantAvatarSeed: 'RosaCortese',
    lastMessage: 'Please submit the tier 2 data by Friday.',
    lastMessageTime: 'Yesterday',
    unreadCount: 1,
    isGroup: false,
    participants: ['Rosa Cortese', 'Mr. Davis'],
    messages: [
      { id: 'm1', senderId: 's3', senderName: 'Rosa Cortese', content: 'How is the implementation of the new reading curriculum going?', timestamp: 'Yesterday', isRead: true, isMe: false },
      { id: 'm2', senderId: 'u1', senderName: 'Mr. Davis', content: 'It is going well. The students are engaged.', timestamp: 'Yesterday', isRead: true, isMe: true },
      { id: 'm3', senderId: 's3', senderName: 'Rosa Cortese', content: 'Great. Please submit the tier 2 data by Friday.', timestamp: 'Yesterday', isRead: false, isMe: false }
    ]
  },
  {
    id: 'c3',
    participantId: 't2',
    participantName: 'Mrs. Johnson',
    participantRole: UserRole.TEACHER,
    participantAvatarSeed: 'MrsJohnson',
    lastMessage: 'I uploaded the reading benchmark data.',
    lastMessageTime: 'Nov 18',
    unreadCount: 0,
    isGroup: false,
    participants: ['Mr. Davis', 'Mrs. Johnson'],
    messages: [
      { id: 'm1', senderId: 't2', senderName: 'Mrs. Johnson', content: 'I uploaded the reading benchmark data.', timestamp: 'Nov 18', isRead: true, isMe: false }
    ]
  },
  {
    id: 'c4',
    participantId: 'd1',
    participantName: 'Dr. Aris Thorne',
    participantRole: UserRole.DISTRICT,
    participantAvatarSeed: 'DrArisThorne',
    lastMessage: 'Budget approval for the new intervention kits is pending.',
    lastMessageTime: 'Nov 20',
    unreadCount: 2,
    isGroup: false,
    participants: ['Dr. Aris Thorne', 'Rosa Cortese'],
    messages: [
      { id: 'm1', senderId: 's3', senderName: 'Rosa Cortese', content: 'Dr. Thorne, have we received approval for the math intervention kits?', timestamp: 'Nov 19', isRead: true, isMe: true },
      { id: 'm2', senderId: 'd1', senderName: 'Dr. Aris Thorne', content: 'Reviewing the request today.', timestamp: 'Nov 20', isRead: true, isMe: false },
      { id: 'm3', senderId: 'd1', senderName: 'Dr. Aris Thorne', content: 'Budget approval for the new intervention kits is pending.', timestamp: 'Nov 20', isRead: false, isMe: false }
    ]
  },
  {
    id: 'c5',
    participantId: 'g1',
    participantName: 'MTSS Core Team',
    participantRole: 'Group',
    participantAvatarSeed: 'MTSS',
    lastMessage: 'Dr. Evans: I will bring the files.',
    lastMessageTime: '2h ago',
    unreadCount: 0,
    isGroup: true,
    participants: ['Rosa Cortese', 'Mr. Davis', 'Dr. Evans'],
    messages: [
      { id: 'm1', senderId: 's3', senderName: 'Rosa Cortese', content: 'Meeting at 2 PM confirmed?', timestamp: '10:00 AM', isRead: true, isMe: false },
      { id: 'm2', senderId: 'u1', senderName: 'Mr. Davis', content: 'Yes, I will be there.', timestamp: '10:05 AM', isRead: true, isMe: false },
      { id: 'm3', senderId: 'c1', senderName: 'Dr. Evans', content: 'I will bring the files.', timestamp: '12:00 PM', isRead: true, isMe: false }
    ]
  }
];

// --- RAG KNOWLEDGE BASE MOCK DATA ---
export const MOCK_RAG_DOCUMENTS: RAGDocument[] = [
  {
    id: 'doc1',
    name: 'District MTSS Handbook 2024.pdf',
    type: 'PDF',
    uploadDate: 'Aug 15, 2024',
    uploaderName: 'Dr. Aris Thorne',
    uploaderRole: UserRole.DISTRICT,
    scope: DocumentScope.DISTRICT,
    status: ApprovalStatus.APPROVED,
    summary: 'Official guidelines for Tier 1, 2, and 3 interventions.',
    size: '2.4 MB'
  },
  {
    id: 'doc2',
    name: 'Attendance Policy Memo.pdf',
    type: 'PDF',
    uploadDate: 'Sep 01, 2024',
    uploaderName: 'Dr. Aris Thorne',
    uploaderRole: UserRole.DISTRICT,
    scope: DocumentScope.DISTRICT,
    status: ApprovalStatus.APPROVED,
    summary: 'New protocols for chronic absenteeism reporting.',
    size: '450 KB'
  },
  {
    id: 'doc3',
    name: 'Northeast Elem Schedule.pdf',
    type: 'PDF',
    uploadDate: 'Aug 20, 2024',
    uploaderName: 'Rosa Cortese',
    uploaderRole: UserRole.PRINCIPAL,
    scope: DocumentScope.SCHOOL,
    targetId: 'Northeast Elementary',
    status: ApprovalStatus.APPROVED,
    summary: 'Master schedule including intervention blocks.',
    size: '1.1 MB'
  },
  {
    id: 'doc4',
    name: '4th Grade Reading Curriculum.docx',
    type: 'DOCX',
    uploadDate: 'Sep 05, 2024',
    uploaderName: 'Mr. Davis',
    uploaderRole: UserRole.TEACHER,
    scope: DocumentScope.CLASS,
    targetId: 'Class 4-B',
    status: ApprovalStatus.APPROVED,
    summary: 'Unit 1-4 reading map and assessment dates.',
    size: '800 KB'
  },
  {
    id: 'doc5',
    name: 'Proposed Behavior Plan Template.pdf',
    type: 'PDF',
    uploadDate: 'Nov 20, 2024',
    uploaderName: 'Mr. Davis',
    uploaderRole: UserRole.TEACHER,
    scope: DocumentScope.SCHOOL,
    targetId: 'Northeast Elementary',
    status: ApprovalStatus.PENDING,
    summary: 'A new template for tracking Tier 2 behavior points.',
    size: '150 KB'
  },
  {
    id: 'doc6',
    name: 'Leo Martinez - Doctor Note.jpg',
    type: 'IMG',
    uploadDate: 'Nov 19, 2024',
    uploaderName: 'Mrs. Martinez',
    uploaderRole: UserRole.PARENT,
    scope: DocumentScope.STUDENT,
    targetId: 'Leo Martinez',
    status: ApprovalStatus.PENDING,
    summary: 'Medical excuse for absences on Nov 15-16.',
    size: '1.2 MB'
  }
];

// --- DISTRICT SCHOOLS DATA ---
export const DISTRICT_SCHOOLS: SchoolNode[] = [
  { 
    id: 'sch1', 
    name: 'Northeast Elementary', 
    type: 'Elementary', 
    principal: 'Rosa Cortese', 
    studentCount: 850, 
    attendanceRate: 92, 
    tier3Count: 45, 
    status: 'Watch', 
    coordinates: { x: 25, y: 35 }, 
    alerts: 2,
    tierDistribution: [
      { name: 'Tier 1', value: 700, color: '#34d399' },
      { name: 'Tier 2', value: 105, color: '#facc15' },
      { name: 'Tier 3', value: 45, color: '#f87171' },
    ]
  },
  { 
    id: 'sch2', 
    name: 'West Middle School', 
    type: 'Middle', 
    principal: 'Sarah Jenkins', 
    studentCount: 1200, 
    attendanceRate: 88, 
    tier3Count: 120, 
    status: 'Critical', 
    coordinates: { x: 65, y: 25 }, 
    alerts: 5,
    tierDistribution: [
      { name: 'Tier 1', value: 850, color: '#34d399' },
      { name: 'Tier 2', value: 230, color: '#facc15' },
      { name: 'Tier 3', value: 120, color: '#f87171' },
    ]
  },
  { 
    id: 'sch3', 
    name: 'South High School', 
    type: 'High', 
    principal: 'Marcus Thorne', 
    studentCount: 1800, 
    attendanceRate: 94, 
    tier3Count: 85, 
    status: 'On Track', 
    coordinates: { x: 45, y: 75 }, 
    alerts: 0,
    tierDistribution: [
      { name: 'Tier 1', value: 1550, color: '#34d399' },
      { name: 'Tier 2', value: 165, color: '#facc15' },
      { name: 'Tier 3', value: 85, color: '#f87171' },
    ]
  },
  { 
    id: 'sch4', 
    name: 'East Elementary', 
    type: 'Elementary', 
    principal: 'Emily Blunt', 
    studentCount: 600, 
    attendanceRate: 95, 
    tier3Count: 15, 
    status: 'On Track', 
    coordinates: { x: 80, y: 60 }, 
    alerts: 0,
    tierDistribution: [
      { name: 'Tier 1', value: 520, color: '#34d399' },
      { name: 'Tier 2', value: 65, color: '#facc15' },
      { name: 'Tier 3', value: 15, color: '#f87171' },
    ]
  },
];

// --- PRINCIPAL DATA ---
export const PRINCIPAL_DATA: DashboardData = {
  role: UserRole.PRINCIPAL,
  userName: 'Rosa Cortese',
  schoolName: 'Northeast Elementary',
  metrics: [
    { label: 'Intervention Fidelity', value: '92%', trend: '+2%', trendDirection: 'up', status: 'success', icon: 'Activity' },
    { label: 'Active Interventions', value: '187', trend: '15 Pending', trendDirection: 'down', status: 'neutral', icon: 'Zap' },
    { label: 'Students Flagged', value: '12', trend: 'Requires Review', trendDirection: 'down', status: 'danger', icon: 'AlertCircle' },
    { label: 'MTSS Meetings', value: '8', trend: 'This Week', trendDirection: 'up', status: 'neutral', icon: 'Users' }
  ],
  actionItems: [
    { id: '1', studentName: 'Leo Martinez', grade: '3rd', category: 'Academic', insight: 'i-Ready Reading dropped 15% despite intervention fidelity.', isAiDetected: true },
    { id: '2', studentName: 'Sarah Chen', grade: '5th', category: 'Attendance', insight: 'Absent 4 days this month. Approaching chronic threshold.', isAiDetected: true },
    { id: '3', studentName: 'Jayden Smith', grade: '4th', category: 'Behavior', insight: '2 Office Referrals (Recess) in the last week.', isAiDetected: true }
  ],
  tierDistribution: [
    { tier: Tier.TIER_1, count: 748, percentage: 80 },
    { tier: Tier.TIER_2, count: 140, percentage: 15 },
    { tier: Tier.TIER_3, count: 47, percentage: 5 },
  ],
  monitoringPulse: [
    { id: 'm1', name: 'Leo Martinez', intervention: 'Leveled Literacy', trend: Trend.UP },
    { id: 'm2', name: 'Maria Rodriguez', intervention: 'Check-In/Check-Out', trend: Trend.STAGNANT },
    { id: 'm3', name: 'Ahmed Al-Fayed', intervention: 'Math Fluency Lab', trend: Trend.MET },
    { id: 'm4', name: 'Emily Johnson', intervention: 'Social Skills Group', trend: Trend.UP }
  ],
  chartTitle: 'Intervention Effectiveness',
  chartData: [
    { name: 'Tier 1', value: 85, fill: '#34d399' },
    { name: 'Tier 2', value: 65, fill: '#facc15' },
    { name: 'Tier 3', value: 45, fill: '#f87171' },
  ]
};

// --- TEACHER DATA ---
export const TEACHER_DATA: DashboardData = {
  role: UserRole.TEACHER,
  userName: 'Mr. Davis',
  schoolName: 'Class 4-B',
  metrics: [
    { label: 'Class Attendance', value: '96%', trend: 'Above Avg', trendDirection: 'up', status: 'success', icon: 'Users' },
    { label: 'Missing Assignments', value: '24', trend: '+5 this week', trendDirection: 'down', status: 'warning', icon: 'AlertCircle' },
    { label: 'Avg Reading Level', value: '4.2', trend: '+0.3 Growth', trendDirection: 'up', status: 'success', icon: 'Activity' },
    { label: 'Upcoming IEPs', value: '2', trend: 'Due in 5 days', trendDirection: 'up', status: 'neutral', icon: 'Calendar' }
  ],
  actionItems: [
    { id: 't1', studentName: 'Jayden Smith', grade: '4th', category: 'Behavior', insight: 'Disruptive during math block for 3 consecutive days.', isAiDetected: true },
    { id: 't2', studentName: 'Emma Wilson', grade: '4th', category: 'Academic', insight: 'Failed last 2 spelling quizzes.', isAiDetected: true }
  ],
  tierDistribution: [
    { tier: Tier.TIER_1, count: 18, percentage: 75 },
    { tier: Tier.TIER_2, count: 4, percentage: 16 },
    { tier: Tier.TIER_3, count: 2, percentage: 9 },
  ],
  monitoringPulse: [
    { id: 'm1', name: 'Jayden Smith', intervention: 'Behavior Chart', trend: Trend.DOWN },
    { id: 'm2', name: 'Emma Wilson', intervention: 'Phonics Small Group', trend: Trend.UP },
  ],
  chartTitle: 'Classroom Assessment Averages',
  chartData: [
    { name: 'Math', value: 78, fill: '#60a5fa' },
    { name: 'Reading', value: 82, fill: '#818cf8' },
    { name: 'Science', value: 88, fill: '#34d399' },
    { name: 'Writing', value: 72, fill: '#fbbf24' },
  ]
};

// --- DISTRICT DATA ---
export const DISTRICT_DATA: DashboardData = {
  role: UserRole.DISTRICT,
  userName: 'Dr. Aris Thorne',
  schoolName: 'BUFSD Central',
  metrics: [
    { label: 'District Attendance', value: '94.2%', trend: '-0.5%', trendDirection: 'down', status: 'warning', icon: 'Users' },
    { label: 'Suspension Rate', value: '2.1%', trend: 'Stable', trendDirection: 'up', status: 'neutral', icon: 'AlertCircle' },
    { label: 'Chronic Absenteeism', value: '14%', trend: 'High Priority', trendDirection: 'down', status: 'danger', icon: 'Activity' },
    { label: 'Schools Flagged', value: '2', trend: 'Northeast & West', trendDirection: 'down', status: 'danger', icon: 'Zap' }
  ],
  actionItems: [
    { id: 'd1', studentName: 'Northeast Elem', grade: 'K-5', category: 'System', insight: 'Tier 3 referrals exceeded capacity by 10%.', isAiDetected: true },
    { id: 'd2', studentName: 'West Middle', grade: '6-8', category: 'Attendance', insight: 'Sudden drop in 8th grade attendance detected.', isAiDetected: true }
  ],
  monitoringPulse: [ // Re-purposing for School Pulse
    { id: 's1', name: 'Northeast Elem', intervention: 'Tier 3 Cap Exceeded', trend: Trend.DOWN },
    { id: 's2', name: 'West Middle', intervention: 'Attendance Audit', trend: Trend.DOWN },
    { id: 's3', name: 'South High', intervention: 'On Track', trend: Trend.UP },
  ],
  chartTitle: 'Intervention Success Rate by School',
  chartData: [
    { name: 'Northeast', value: 92, fill: '#34d399' },
    { name: 'South', value: 88, fill: '#60a5fa' },
    { name: 'West', value: 76, fill: '#f87171' },
    { name: 'East', value: 82, fill: '#fbbf24' },
  ]
};

// --- PARENT DATA ---
export const PARENT_DATA: DashboardData = {
  role: UserRole.PARENT,
  userName: 'Mrs. Martinez',
  schoolName: 'Leo Martinez',
  metrics: [
    { label: 'Current GPA', value: '3.2', trend: 'Last Report', trendDirection: 'up', status: 'success', icon: 'Activity' },
    { label: 'Attendance', value: '95%', trend: '2 Absences', trendDirection: 'down', status: 'warning', icon: 'Users' },
    { label: 'Assignments Due', value: '3', trend: 'This Week', trendDirection: 'up', status: 'neutral', icon: 'Calendar' },
    { label: 'Reading Level', value: 'Level M', trend: 'On Track', trendDirection: 'up', status: 'success', icon: 'Zap' }
  ],
  actionItems: [
    { id: 'p1', studentName: 'Leo Martinez', grade: '3rd', category: 'Academic', insight: 'Upcoming Math Test on Friday: Fractions.', isAiDetected: true },
    { id: 'p2', studentName: 'Leo Martinez', grade: '3rd', category: 'Behavior', insight: 'Great participation in Science Lab this week!', isAiDetected: true }
  ],
  monitoringPulse: [
    { id: 'g1', name: 'Math Quiz', intervention: 'Score: 85/100', trend: Trend.UP },
    { id: 'g2', name: 'Spelling Test', intervention: 'Score: 90/100', trend: Trend.UP },
    { id: 'g3', name: 'History Project', intervention: 'Pending', trend: Trend.STAGNANT },
  ],
  chartTitle: 'Leo\'s Subject Performance',
  chartData: [
    { name: 'Math', value: 85, fill: '#60a5fa' },
    { name: 'Reading', value: 78, fill: '#818cf8' },
    { name: 'Science', value: 92, fill: '#34d399' },
    { name: 'Art', value: 95, fill: '#fbbf24' },
  ]
};

// --- STAFF ROSTER DATA ---
export const STAFF_ROSTER_DATA: StaffRosterItem[] = [
  {
    id: 's1',
    name: 'Mr. Davis',
    role: 'Teacher',
    grade: '4th Grade',
    studentCount: 24,
    attendanceRate: 96,
    performanceMetric: '82% Reading Proficiency',
    mtssFidelityScore: 94,
    activeInterventions: 5,
    flaggedStudents: 2,
    avatarSeed: 'MrDavis'
  },
  {
    id: 's2',
    name: 'Mrs. Johnson',
    role: 'Teacher',
    grade: '3rd Grade',
    studentCount: 22,
    attendanceRate: 92,
    performanceMetric: '78% Math Proficiency',
    mtssFidelityScore: 88,
    activeInterventions: 8,
    flaggedStudents: 4,
    avatarSeed: 'MrsJohnson'
  },
  {
    id: 's3',
    name: 'Dr. Evans',
    role: 'Consultant',
    studentCount: 45,
    attendanceRate: 98,
    performanceMetric: 'Case Closure Rate: 90%',
    mtssFidelityScore: 98,
    activeInterventions: 45,
    flaggedStudents: 0,
    avatarSeed: 'DrEvans'
  },
  {
    id: 's4',
    name: 'Ms. Lee',
    role: 'Specialist',
    grade: 'Reading Recovery',
    studentCount: 12,
    attendanceRate: 91,
    performanceMetric: 'Avg Growth: 1.5 Levels',
    mtssFidelityScore: 100,
    activeInterventions: 12,
    flaggedStudents: 1,
    avatarSeed: 'MsLee'
  },
  {
    id: 's5',
    name: 'Mr. Thompson',
    role: 'Teacher',
    grade: '5th Grade',
    studentCount: 26,
    attendanceRate: 94,
    performanceMetric: '85% Science Proficiency',
    mtssFidelityScore: 78,
    activeInterventions: 3,
    flaggedStudents: 5,
    avatarSeed: 'MrThompson'
  },
  {
    id: 's6',
    name: 'Mrs. Garcia',
    role: 'Teacher',
    grade: 'Kindergarten',
    studentCount: 20,
    attendanceRate: 89,
    performanceMetric: '92% Letter Rec.',
    mtssFidelityScore: 95,
    activeInterventions: 6,
    flaggedStudents: 2,
    avatarSeed: 'MrsGarcia'
  }
];

// --- CLASS ROSTER DATA (Teacher View) ---
export const CLASS_ROSTER_DATA: StudentRosterItem[] = [
  {
    id: '1001',
    name: 'Jayden Smith',
    grade: '4th',
    tier: Tier.TIER_3,
    gpa: '2.1',
    attendance: 84,
    readingLevel: 'K',
    activeInterventions: 2,
    alerts: 1,
    avatarSeed: 'Jayden'
  },
  {
    id: '1002',
    name: 'Emma Wilson',
    grade: '4th',
    tier: Tier.TIER_2,
    gpa: '2.8',
    attendance: 92,
    readingLevel: 'O',
    activeInterventions: 1,
    alerts: 1,
    avatarSeed: 'Emma'
  },
  {
    id: '1003',
    name: 'Liam Parker',
    grade: '4th',
    tier: Tier.TIER_1,
    gpa: '3.8',
    attendance: 98,
    readingLevel: 'R',
    activeInterventions: 0,
    alerts: 0,
    avatarSeed: 'Liam'
  },
  {
    id: '1004',
    name: 'Sophia Rodriguez',
    grade: '4th',
    tier: Tier.TIER_1,
    gpa: '3.5',
    attendance: 96,
    readingLevel: 'Q',
    activeInterventions: 0,
    alerts: 0,
    avatarSeed: 'Sophia'
  },
  {
    id: '1005',
    name: 'Noah Chang',
    grade: '4th',
    tier: Tier.TIER_2,
    gpa: '3.0',
    attendance: 89,
    readingLevel: 'N',
    activeInterventions: 1,
    alerts: 0,
    avatarSeed: 'Noah'
  },
  {
    id: '1006',
    name: 'Ava Patel',
    grade: '4th',
    tier: Tier.TIER_1,
    gpa: '3.9',
    attendance: 99,
    readingLevel: 'S',
    activeInterventions: 0,
    alerts: 0,
    avatarSeed: 'Ava'
  },
  {
    id: '1007',
    name: 'Ethan James',
    grade: '4th',
    tier: Tier.TIER_3,
    gpa: '1.9',
    attendance: 78,
    readingLevel: 'J',
    activeInterventions: 3,
    alerts: 2,
    avatarSeed: 'Ethan'
  },
  {
    id: '1008',
    name: 'Isabella Rossi',
    grade: '4th',
    tier: Tier.TIER_1,
    gpa: '3.4',
    attendance: 95,
    readingLevel: 'P',
    activeInterventions: 0,
    alerts: 0,
    avatarSeed: 'Isabella'
  }
];

// --- MASTER ROSTER GENERATOR ---
export const TEACHERS = ['Mr. Davis', 'Mrs. Johnson', 'Ms. Lee', 'Mr. Thompson', 'Mrs. Garcia', 'Mr. Wilson'];
export const MOCK_FIRST_NAMES = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Oliver", "Isabella", "Elijah", "Sophia", "James", "Charlotte", "William", "Amelia", "Benjamin", "Mia", "Lucas", "Henry", "Alexander", "Michael", "Daniel"];
export const MOCK_LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson"];

export const generateMasterRoster = () => {
    return Array.from({ length: 120 }).map((_, i) => {
        const firstName = MOCK_FIRST_NAMES[i % MOCK_FIRST_NAMES.length];
        const lastName = MOCK_LAST_NAMES[i % MOCK_LAST_NAMES.length];
        const gradeLevel = (i % 6) + 1; // 1-6
        
        // Weighted random tier (more Tier 2/3 in monitored list)
        const rand = Math.random();
        let tier = Tier.TIER_1;
        if (rand > 0.6) tier = Tier.TIER_3;
        else if (rand > 0.3) tier = Tier.TIER_2;

        return {
            id: `STU-M-${1000 + i}`,
            name: `${firstName} ${lastName}`,
            grade: `${gradeLevel}${['st','nd','rd','th','th','th'][gradeLevel-1] || 'th'}`,
            tier: tier,
            gpa: (1.5 + Math.random() * 2.5).toFixed(1),
            attendance: 80 + Math.floor(Math.random() * 20),
            readingLevel: String.fromCharCode(65 + Math.floor(Math.random() * 12)), // A-L
            activeInterventions: tier === Tier.TIER_1 ? 0 : Math.ceil(Math.random() * 3),
            alerts: tier === Tier.TIER_3 ? Math.floor(Math.random() * 3) : 0,
            avatarSeed: `student-${i}-${firstName}`
        };
    }).sort((a,b) => {
        const tierScore = (t: string) => t === Tier.TIER_3 ? 3 : t === Tier.TIER_2 ? 2 : 1;
        return tierScore(b.tier) - tierScore(a.tier);
    });
};

// Shared Mock Data Generator
export const getStudentDetails = (name: string): StudentDetails => {
  // Seeded random-ish data based on name length to keep it consistent per session
  const seed = name.length;
  
  const aiRecommendations = [
    { 
      id: 'rec1', 
      name: seed % 2 === 0 ? 'Math Fluency Lab' : 'Social Skills Group', 
      reason: seed % 2 === 0 ? 'Computation speed lagging behind grade level norms based on last 3 assessments.' : 'Recent peer conflicts during unstructured time detected in daily logs.',
      action: seed % 2 === 0 ? 'Enroll in daily 15-min reflex math block before lunch.' : 'Assign to "Lunch Bunch" guided peer group twice weekly.',
      confidenceLevel: 'High',
      confidenceScore: 94
    },
    { 
      id: 'rec2', 
      name: 'Executive Function Coaching', 
      reason: 'Pattern of inconsistent homework submission observed over last 2 weeks (missing 4 assignments).', 
      action: 'Implement digital planner check-in protocol with homeroom teacher.',
      confidenceLevel: 'Medium',
      confidenceScore: 78
    }
  ];

  // Helper to generate fake data points
  const generateDataPoints = (baseline: number, count: number, trend: 'up' | 'down') => {
    const points: Array<{ date: string; score: number }> = [];
    let current = baseline;
    for (let i = 0; i < count; i++) {
        points.push({
            date: `Week ${i + 1}`,
            score: Math.round(current)
        });
        // Add some noise and trend
        const change = trend === 'up' ? Math.random() * 5 : -(Math.random() * 5);
        current += change;
    }
    return points;
  };

  return {
    id: `STU-${10000 + seed * 123}`,
    grade: seed % 2 === 0 ? '4th Grade' : '3rd Grade',
    teacher: 'Mr. Davis',
    tier: seed % 3 === 0 ? Tier.TIER_3 : (seed % 2 === 0 ? Tier.TIER_2 : Tier.TIER_1),
    attendance: 85 + (seed % 15),
    gpa: (2.0 + (seed % 20) / 10).toFixed(1),
    readingLevel: String.fromCharCode(65 + (seed % 10)), // A-J
    interventions: [
      { 
          id: 1, 
          name: 'Leveled Literacy Intervention', 
          date: 'Oct 12, 2023', 
          status: 'Active', 
          progress: 65,
          baselineScore: 40,
          goalScore: 90,
          dataPoints: generateDataPoints(40, 6, 'up')
      },
      { 
          id: 2, 
          name: 'Check-In/Check-Out', 
          date: 'Sep 05, 2023', 
          status: 'Completed', 
          progress: 100,
          baselineScore: 60,
          goalScore: 80,
          dataPoints: generateDataPoints(60, 8, 'up')
      },
    ],
    recentActivity: [
      { date: 'Nov 20', type: 'Behavior', note: 'Disruptive during silent reading.', isNew: false, tags: ['Classroom', 'Redirection'] },
      { date: 'Nov 18', type: 'Academic', note: 'Scored 85% on Math Unit 3.', isNew: false, tags: ['Math', 'Assessment'] },
      { date: 'Nov 15', type: 'Attendance', note: 'Absent (Excused).', isNew: false, tags: ['Medical'] },
      { date: 'Nov 10', type: 'General', note: 'Parent conference scheduled for next week.', isNew: false, tags: ['Parent Contact'] },
    ],
    aiRecommendations,
    medical: {
      allergies: seed % 3 === 0 ? ['Peanuts', 'Bee Stings'] : (seed % 5 === 0 ? ['Penicillin'] : []),
      medications: seed % 4 === 0 ? ['Albuterol Inhaler (As needed)'] : [],
      visionScreening: { 
        status: seed % 2 === 0 ? 'Pass' : 'Corrected', 
        date: 'Sept 15, 2023', 
        notes: seed % 2 !== 0 ? 'Wears glasses for reading.' : undefined 
      },
      hearingScreening: { status: 'Pass', date: 'Sept 15, 2023' },
      conditions: seed % 4 === 0 ? ['Asthma'] : []
    },
    support: {
      planType: seed % 3 === 0 ? 'IEP' : (seed % 5 === 0 ? '504 Plan' : 'None'),
      primaryDisability: seed % 3 === 0 ? 'Specific Learning Disability (Reading)' : undefined,
      nextReviewDate: 'May 20, 2025',
      accommodations: seed % 3 === 0 || seed % 5 === 0 ? [
        'Preferential seating near instruction',
        'Extended time on tests (1.5x)',
        'Tests read aloud',
        'Use of fidgets'
      ] : [],
      behavioralStrategies: [
        'Use "First/Then" statements',
        'Provide frequent movement breaks',
        'Positive reinforcement for task completion'
      ]
    }
  };
};

// --- SHARED GRADEBOOK DATA ---

export type AssignmentType = 'Homework' | 'Quiz' | 'Test' | 'Project';

export interface Assignment {
  id: string;
  title: string;
  date: string;
  type: AssignmentType;
  maxPoints: number;
  subject: string;
  description?: string;
}

export interface GradeEntry {
  studentId: string;
  assignmentId: string;
  score: string | number | null; 
}

export const SUBJECTS = ['Mathematics', 'Reading', 'Science', 'Social Studies'];

// Helper to generate consistent assignments for the whole system
const generateGlobalAssignments = (): Assignment[] => {
  const types: AssignmentType[] = ['Homework', 'Quiz', 'Test', 'Project'];
  const today = new Date();
  const allAssignments: Assignment[] = [];

  SUBJECTS.forEach(subject => {
    // Generate 12 assignments per subject
    Array.from({ length: 12 }).forEach((_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (i * 4)); // Spread back
      
      allAssignments.push({
        id: `asn-${subject}-${i}`,
        title: `${subject} ${types[i % 4]} ${Math.floor(i / 4) + 1}.${(i % 3) + 1}`,
        date: date.toISOString().split('T')[0],
        type: types[i % 4],
        maxPoints: 100,
        subject: subject
      });
    });
  });
  
  return allAssignments;
};

// Helper to generate grades for all students/assignments
const generateGlobalGrades = (students: typeof CLASS_ROSTER_DATA, assignments: Assignment[]): GradeEntry[] => {
  const grades: GradeEntry[] = [];
  students.forEach(student => {
    assignments.forEach(asn => {
      let baseScore = 0;
      if (student.tier === Tier.TIER_1) baseScore = 88 + Math.random() * 12;
      else if (student.tier === Tier.TIER_2) baseScore = 72 + Math.random() * 18;
      else baseScore = 55 + Math.random() * 25;

      const rand = Math.random();
      let score: number | string | null = Math.min(100, Math.round(baseScore));
      
      // Simulate missing/excused/late work based on tier/randomness
      // Tier 3 has more missing work for the AI to find
      if (student.tier === Tier.TIER_3 && rand < 0.15) score = 'M';
      else if (student.tier === Tier.TIER_2 && rand < 0.05) score = 'M'; // Occasional missing for Tier 2
      else if (rand > 0.98) score = 'E';
      else if (student.tier === Tier.TIER_2 && rand < 0.10) score = 'L';

      grades.push({
        studentId: student.id,
        assignmentId: asn.id,
        score: score
      });
    });
  });
  return grades;
};

// Execute Generation
export const GLOBAL_ASSIGNMENTS = generateGlobalAssignments();
export const GLOBAL_GRADES = generateGlobalGrades(CLASS_ROSTER_DATA, GLOBAL_ASSIGNMENTS);
