import type { LandingExperimentEventPayload } from "../schemas/landing-experiments";

type LandingExperimentEventRecord = LandingExperimentEventPayload & {
  id: string;
  receivedAt: string;
  userAgent: string | null;
};

const MAX_EVENT_ROWS = 5_000;
const eventRows: LandingExperimentEventRecord[] = [];

export const appendLandingExperimentEvent = (
  payload: LandingExperimentEventPayload,
  request: Request
): LandingExperimentEventRecord => {
  const record: LandingExperimentEventRecord = {
    ...payload,
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    userAgent: request.headers.get("user-agent"),
  };
  eventRows.push(record);
  if (eventRows.length > MAX_EVENT_ROWS) {
    eventRows.splice(0, eventRows.length - MAX_EVENT_ROWS);
  }
  return record;
};

export const getLandingExperimentEventCount = (): number => eventRows.length;

