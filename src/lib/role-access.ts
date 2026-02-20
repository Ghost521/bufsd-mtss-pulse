import { UserRole } from "../types";

export const canAccessStudentNotes = (role: UserRole): boolean => role !== UserRole.PARENT;

