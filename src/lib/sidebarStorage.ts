const STORAGE_PREFIX = "sidebar";

const canUseStorage = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const probeKey = "__sidebar_storage_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
};

const buildKey = (key: string, userKey: string): string => `${STORAGE_PREFIX}.${key}.${userKey}`;

export const readSidebarStorage = <T>(key: string, userKey: string, fallback: T): T => {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(buildKey(key, userKey));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const writeSidebarStorage = <T>(key: string, userKey: string, value: T): void => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(buildKey(key, userKey), JSON.stringify(value));
  } catch {
    // Ignore storage write failures and continue with in-memory state.
  }
};
