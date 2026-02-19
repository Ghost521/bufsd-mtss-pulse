import { describe, expect, it } from "vitest";

import { EventType } from "../src/types";
import { buildEventComposerValidation, type EventComposerFormState } from "../src/lib/calendar-event-composer";

const baseForm: EventComposerFormState = {
  title: "MTSS Team Check-in",
  type: EventType.STAFF,
  date: "2026-02-19",
  startTime: "09:00",
  endTime: "10:00",
  allDay: false,
  description: "",
  location: "",
  recurrencePattern: "None",
  recurrenceEnd: "",
};

describe("calendar event composer validation", () => {
  it("requires title and attendees", () => {
    const errors = buildEventComposerValidation(
      { ...baseForm, title: "   " },
      [],
      "Rosa Cortese",
    );
    expect(errors.title).toBe("Event title is required.");
    expect(errors.attendees).toBe("Add at least one attendee.");
  });

  it("requires end time to be after start time", () => {
    const errors = buildEventComposerValidation(
      { ...baseForm, startTime: "11:00", endTime: "10:00" },
      ["Rosa Cortese"],
      "Rosa Cortese",
    );
    expect(errors.endTime).toBe("End time must be after start time.");
  });

  it("requires recurrence end date for recurring events", () => {
    const errors = buildEventComposerValidation(
      { ...baseForm, recurrencePattern: "Weekly", recurrenceEnd: "" },
      ["Rosa Cortese"],
      "Rosa Cortese",
    );
    expect(errors.recurrenceEnd).toBe("Select a recurrence end date.");
  });

  it("requires organizer to remain in attendee list", () => {
    const errors = buildEventComposerValidation(
      baseForm,
      ["Mr. Davis"],
      "Rosa Cortese",
    );
    expect(errors.attendees).toBe("Organizer must remain an attendee.");
  });

  it("passes valid all-day recurring event", () => {
    const errors = buildEventComposerValidation(
      {
        ...baseForm,
        allDay: true,
        recurrencePattern: "Monthly",
        recurrenceEnd: "2026-06-19",
      },
      ["Rosa Cortese"],
      "Rosa Cortese",
    );
    expect(errors).toEqual({});
  });
});
