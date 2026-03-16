export enum Tier {
  TIER_1 = "Tier 1",
  TIER_2 = "Tier 2",
  TIER_3 = "Tier 3",
}

export enum Trend {
  UP = "Trending Up",
  STAGNANT = "Stagnant",
  MET = "Goal Met",
  DOWN = "Trending Down",
}

export enum EventType {
  MTSS = "MTSS Meeting",
  IEP = "IEP Review",
  STAFF = "Staff Meeting",
  PARENT = "Parent Conference",
  DISTRICT = "District Training",
  CLASS = "Class Event",
  DEADLINE = "Deadline",
}

export enum AttendanceStatus {
  ACCEPTED = "Accepted",
  DECLINED = "Declined",
  PENDING = "Pending",
  ORGANIZER = "Organizer",
}

export enum DocumentScope {
  DISTRICT = "District",
  SCHOOL = "School",
  CLASS = "Class",
  STUDENT = "Student",
  INTERNAL = "Internal (Private)",
}

export enum ApprovalStatus {
  APPROVED = "Approved",
  PENDING = "Pending Approval",
  REJECTED = "Rejected",
  NONE = "No Approval Needed",
}
