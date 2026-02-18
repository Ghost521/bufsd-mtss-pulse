type SidebarTelemetryEvent =
  | "sidebar_opened"
  | "sidebar_closed"
  | "sidebar_collapsed"
  | "sidebar_search_used";

type SidebarTelemetryPayload = Record<string, string | number | boolean | null | undefined>;

const telemetryEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("sidebar.telemetry.debug") === "true";
};

export const trackSidebarEvent = (event: SidebarTelemetryEvent, payload?: SidebarTelemetryPayload): void => {
  if (!telemetryEnabled()) return;
  // This is intentionally a debug-only no-op sink until product analytics is wired.
  console.debug("[sidebar]", event, payload ?? {});
};
