import type { EventType } from "../types";

export type RecurrencePattern = "None" | "Daily" | "Weekly" | "Monthly";
export type EventComposerField = "title" | "date" | "startTime" | "endTime" | "recurrenceEnd" | "attendees";
export type EventComposerErrors = Partial<Record<EventComposerField | "form", string>>;

export type EventComposerFormState = {
  title: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  description: string;
  location: string;
  recurrencePattern: RecurrencePattern;
  recurrenceEnd: string;
};

export const RECURRENCE_PATTERNS: RecurrencePattern[] = ["None", "Daily", "Weekly", "Monthly"];

export const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00`);
  return !Number.isNaN(parsed);
};

export const isValidTimeValue = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const buildEventComposerValidation = (
  form: EventComposerFormState,
  invitees: string[],
  currentUserName: string,
): EventComposerErrors => {
  const errors: EventComposerErrors = {};

  if (!form.title.trim()) {
    errors.title = "Event title is required.";
  }

  if (!isValidIsoDate(form.date)) {
    errors.date = "Enter a valid date.";
  }

  if (!form.allDay) {
    if (!isValidTimeValue(form.startTime)) {
      errors.startTime = "Enter a valid start time.";
    }
    if (!isValidTimeValue(form.endTime)) {
      errors.endTime = "Enter a valid end time.";
    }
    if (!errors.startTime && !errors.endTime) {
      const start = Date.parse(`${form.date}T${form.startTime}:00`);
      const end = Date.parse(`${form.date}T${form.endTime}:00`);
      if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
        errors.endTime = "End time must be after start time.";
      }
    }
  }

  if (form.recurrencePattern !== "None") {
    if (!isValidIsoDate(form.recurrenceEnd)) {
      errors.recurrenceEnd = "Select a recurrence end date.";
    } else if (isValidIsoDate(form.date) && form.recurrenceEnd < form.date) {
      errors.recurrenceEnd = "End date must be on or after the event date.";
    }
  }

  if (invitees.length === 0) {
    errors.attendees = "Add at least one attendee.";
  } else if (!invitees.includes(currentUserName)) {
    errors.attendees = "Organizer must remain an attendee.";
  }

  return errors;
};

