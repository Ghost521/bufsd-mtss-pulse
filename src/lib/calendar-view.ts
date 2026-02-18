export type CalendarViewMode = "month" | "week" | "day";

export const CALENDAR_DAY_START_HOUR = 6;
export const CALENDAR_DAY_END_HOUR = 20;
export const CALENDAR_SLOT_MINUTES = 30;
export const CALENDAR_TOTAL_MINUTES = (CALENDAR_DAY_END_HOUR - CALENDAR_DAY_START_HOUR) * 60;

const DAY_MS = 24 * 60 * 60 * 1000;

const pad2 = (value: number): string => String(value).padStart(2, "0");

export const toLocalDateInputValue = (value: Date): string =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

export const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

export const startOfDayLocal = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const endOfDayLocal = (date: Date): Date => {
  const start = startOfDayLocal(date);
  return new Date(start.getTime() + DAY_MS);
};

export const getWeekStartLocal = (anchor: Date, weekStart = 0): Date => {
  const day = anchor.getDay();
  const diff = (day - weekStart + 7) % 7;
  return startOfDayLocal(addDays(anchor, -diff));
};

export const getWeekDatesLocal = (anchor: Date, weekStart = 0): Date[] => {
  const start = getWeekStartLocal(anchor, weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

export const toTimeZoneDayKey = (value: Date, timeZone: string): string =>
  value.toLocaleDateString("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

export const minutesInTimeZoneDay = (value: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
};

export const formatMonthHeader = (value: Date, timeZone: string): string =>
  value.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone });

export const formatWeekHeader = (weekDays: Date[], timeZone: string): string => {
  const start = weekDays[0];
  const end = weekDays[weekDays.length - 1];
  const sameMonth = start.toLocaleDateString("en-US", { month: "numeric", timeZone }) === end.toLocaleDateString("en-US", { month: "numeric", timeZone });
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameMonth ? {} : { year: "numeric" }),
    timeZone,
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  return `${startLabel} - ${endLabel}`;
};

export const formatDayHeader = (value: Date, timeZone: string): string => {
  const dateLabel = value.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  return `${dateLabel} - ${timeZone}`;
};

export const formatEventTimeRange = (startIso: string, endIso: string, timeZone: string): string => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startLabel = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone });
  const endLabel = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone });
  return `${startLabel} - ${endLabel}`;
};

export const eventOverlapsRange = (startIso: string, endIso: string, rangeStart: Date, rangeEnd: Date): boolean => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const clampedEnd = end <= start ? start + 30 * 60 * 1000 : end;
  return start < rangeEnd.getTime() && clampedEnd > rangeStart.getTime();
};

export const eventDurationMinutes = (startIso: string, endIso: string): number => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(30, Math.round((end - start) / 60000));
};

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const snapMinutes = (value: number, step = CALENDAR_SLOT_MINUTES): number => Math.round(value / step) * step;

export const toTimeInputValue = (totalMinutes: number): string => {
  const minute = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hourValue = Math.floor(minute / 60);
  const minuteValue = minute % 60;
  return `${pad2(hourValue)}:${pad2(minuteValue)}`;
};

export const parseTimeInputMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return CALENDAR_DAY_START_HOUR * 60;
  return clamp(hours * 60 + minutes, 0, 24 * 60);
};

export const combineDateAndMinutes = (day: Date, totalMinutes: number): Date => {
  const date = startOfDayLocal(day);
  date.setMinutes(totalMinutes);
  return date;
};

