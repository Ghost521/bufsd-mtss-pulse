export const UserRole = {
  PRINCIPAL: "Principal",
  TEACHER: "Teacher",
  DISTRICT: "District Admin",
  PARENT: "Parent",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
