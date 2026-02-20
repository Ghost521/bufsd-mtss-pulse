import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bell, Camera, CheckCircle2, Database, Globe, Loader2, LogOut, Mail, Palette, RotateCcw, Save, School, Shield, User } from "lucide-react";
import { UserRole } from "../types";
import { applyTenantBrandingTheme } from "../lib/branding-theme";
import { iconSize } from "../lib/ui/icons";
import {
  DEFAULT_READING_BENCHMARKS,
  READING_BENCHMARK_GRADE_ORDER,
  type NormalizedGrade,
} from "../lib/reading-benchmarks";
import {
  DEFAULT_DISTRICT_BRANDING,
  districtBrandingEditableSchema,
  districtBrandingRecordSchema,
  type DistrictBrandingEditable,
} from "../lib/schemas/branding";
import {
  profileSettingsSchema,
  settingsRecordSchema,
  settingsSectionSchemaMap,
  type SettingsRecord,
  type SettingsSectionId,
} from "../lib/schemas/settings";

interface SettingsViewProps {
  currentUserRole: UserRole;
  currentUserName: string;
  currentSchoolName: string;
}

type SectionStatus = { saving: boolean; success: string | null; error: string | null };
type SectionItem = { id: SettingsSectionId; label: string; icon: React.ComponentType<{ size?: number }>; roles: UserRole[] | "all" };
type AuthState = "ok" | "unauthorized" | "forbidden";
type BrandingStatus = { saving: boolean; success: string | null; error: string | null };

const sections: SectionItem[] = [
  { id: "profile", label: "My Profile", icon: User, roles: "all" },
  { id: "notifications", label: "Notifications", icon: Bell, roles: "all" },
  { id: "security", label: "Security", icon: Shield, roles: "all" },
  { id: "preferences", label: "Family Preferences", icon: Globe, roles: [UserRole.PARENT] },
  { id: "classroom", label: "Classroom Defaults", icon: School, roles: [UserRole.TEACHER] },
  { id: "system", label: "System Integrations", icon: Database, roles: [UserRole.PRINCIPAL, UserRole.DISTRICT] },
];

const sectionDescriptions: Record<SettingsSectionId, string> = {
  profile: "Update your name, contact details, and profile image used across the workspace.",
  notifications: "Control which alerts you receive and how often summary updates are delivered.",
  security: "Review authentication controls and re-authenticate with your identity provider when needed.",
  preferences: "Choose communication defaults that help your family receive updates clearly.",
  classroom: "Set classroom automation defaults for attendance and parent communications.",
  system: "Manage data integrations used to sync SIS and classroom platforms.",
};

const sectionIds = sections.map((s) => s.id);
const blankStatus = () =>
  Object.fromEntries(sectionIds.map((id) => [id, { saving: false, success: null, error: null }])) as Record<SettingsSectionId, SectionStatus>;
const blankErrors = () => Object.fromEntries(sectionIds.map((id) => [id, {}])) as Record<SettingsSectionId, Record<string, string>>;
const timezoneOptions = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
];
const colorFieldIds: Array<keyof DistrictBrandingEditable["colors"]> = ["primary", "secondary", "accent", "surface"];
const systemIntegrationRows: Array<{
  key: "infiniteCampusConnected" | "cleverConnected" | "powerSchoolConnected" | "eSchoolDataConnected";
  label: string;
  description: string;
}> = [
  {
    key: "infiniteCampusConnected",
    label: "Infinite Campus",
    description: "Sync roster and attendance data from Infinite Campus.",
  },
  {
    key: "cleverConnected",
    label: "Clever",
    description: "Enable secure classroom application and roster sync via Clever.",
  },
  {
    key: "powerSchoolConnected",
    label: "PowerSchool",
    description: "Connect PowerSchool for SIS data and gradebook integration.",
  },
  {
    key: "eSchoolDataConnected",
    label: "eSchoolData",
    description: "Connect eSchoolData for roster, attendance, and intervention data sync.",
  },
];
const blankBrandingStatus = (): BrandingStatus => ({ saving: false, success: null, error: null });
const blankBrandingErrors = (): Record<string, string> => ({});

class ApiRequestError extends Error {
  status: number;
  requestId: string | null;

  constructor(message: string, status: number, requestId: string | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.requestId = requestId;
  }
}

const parseApiError = async (response: Response): Promise<ApiRequestError> => {
  const payload = (await response.json().catch(() => null)) as { error?: string; requestId?: string } | null;
  return new ApiRequestError(payload?.error ?? `Request failed (${response.status})`, response.status, payload?.requestId ?? null);
};

const parseBrandingPayload = (payload: unknown): DistrictBrandingEditable => {
  const data = payload as { rows?: unknown[]; row?: unknown } | null;
  const fromRows = districtBrandingRecordSchema.safeParse(data?.rows?.[0]);
  if (fromRows.success) return fromRows.data;

  const fromRow = districtBrandingRecordSchema.safeParse(data?.row);
  if (fromRow.success) return fromRow.data;

  const editable = districtBrandingEditableSchema.safeParse(data?.row ?? data?.rows?.[0]);
  if (editable.success) return editable.data;

  return DEFAULT_DISTRICT_BRANDING;
};

const createSafeDisplayName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length >= 2) return trimmed.slice(0, 80);
  return "MTSS User";
};

const createSafeEmail = (name: string): string => {
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s._-]/g, "")
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");
  const localPart = cleaned.length > 0 ? cleaned : "user";
  return `${localPart}@bufsd.org`;
};

const fallbackRecord = (name: string, role: UserRole): SettingsRecord => {
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  const safeProfile = {
    displayName: createSafeDisplayName(name),
    email: createSafeEmail(name),
    bio: "",
    timezone: detectedTimezone,
    avatarUrl: null,
  };

  const parsed = settingsRecordSchema.safeParse({
    id: "settings::fallback",
    userId: "fallback",
    version: 1,
    profile: safeProfile,
    notifications: {
      emailNotifications: true,
      pushNotifications: false,
      digestFrequency: "Daily",
      alerts: {
        newMessageReceived: true,
        mtssMeetingScheduled: true,
        interventionPlanGoalMet: true,
        studentFlaggedAtRisk: true,
      },
    },
    security: { twoFactorEnabled: true, providerManagedAuth: true, lastPasswordChangedAt: null },
    preferences: { preferredLanguage: "English", contactMethodPriority: "Email first, then Phone" },
    classroom: { autoFlagLowAttendance: role === UserRole.TEACHER, weeklyParentSummary: role === UserRole.TEACHER },
    system: {
      infiniteCampusConnected: true,
      cleverConnected: true,
      powerSchoolConnected: false,
      eSchoolDataConnected: false,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: "fallback",
  });
  if (parsed.success) return parsed.data;

  return settingsRecordSchema.parse({
    id: "settings::fallback",
    userId: "fallback",
    version: 1,
    profile: {
      displayName: "MTSS User",
      email: "user@bufsd.org",
      bio: "",
      timezone: detectedTimezone,
      avatarUrl: null,
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: false,
      digestFrequency: "Daily",
      alerts: {
        newMessageReceived: true,
        mtssMeetingScheduled: true,
        interventionPlanGoalMet: true,
        studentFlaggedAtRisk: true,
      },
    },
    security: { twoFactorEnabled: true, providerManagedAuth: true, lastPasswordChangedAt: null },
    preferences: { preferredLanguage: "English", contactMethodPriority: "Email first, then Phone" },
    classroom: { autoFlagLowAttendance: role === UserRole.TEACHER, weeklyParentSummary: role === UserRole.TEACHER },
    system: {
      infiniteCampusConnected: true,
      cleverConnected: true,
      powerSchoolConnected: false,
      eSchoolDataConnected: false,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: "fallback",
  });
};

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }> = ({
  label,
  checked,
  onChange,
  disabled = false,
}) => (
  <label className={`relative inline-flex items-center ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`} aria-label={label}>
    <input
      type="checkbox"
      className="peer sr-only"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600 peer-disabled:cursor-not-allowed peer-disabled:bg-slate-300 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-300" />
    <span className="pointer-events-none absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5 peer-disabled:bg-slate-200" />
  </label>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUserRole, currentUserName, currentSchoolName }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brandingLogoInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsSectionId>("profile");
  const [reloadToken, setReloadToken] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>("ok");
  const [record, setRecord] = useState<SettingsRecord | null>(null);
  const [draft, setDraft] = useState<SettingsRecord | null>(null);
  const [status, setStatus] = useState<Record<SettingsSectionId, SectionStatus>>(blankStatus);
  const [errors, setErrors] = useState<Record<SettingsSectionId, Record<string, string>>>(blankErrors);
  const [branding, setBranding] = useState<DistrictBrandingEditable>(DEFAULT_DISTRICT_BRANDING);
  const [brandingDraft, setBrandingDraft] = useState<DistrictBrandingEditable>(DEFAULT_DISTRICT_BRANDING);
  const [brandingStatus, setBrandingStatus] = useState<BrandingStatus>(blankBrandingStatus);
  const [brandingErrors, setBrandingErrors] = useState<Record<string, string>>(blankBrandingErrors);

  const visibleSections = useMemo(
    () => sections.filter((item) => item.roles === "all" || item.roles.includes(currentUserRole)),
    [currentUserRole]
  );

  useEffect(() => {
    if (!visibleSections.some((section) => section.id === activeTab)) {
      setActiveTab(visibleSections[0]?.id ?? "profile");
    }
  }, [activeTab, visibleSections]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      setAuthState("ok");
      try {
        const response = await fetch("/api/data/settings");
        if (!response.ok) throw await parseApiError(response);
        const payload = (await response.json()) as { rows?: unknown[] };
        const parsed = settingsRecordSchema.safeParse(payload.rows?.[0]);
        const next = parsed.success ? parsed.data : fallbackRecord(currentUserName, currentUserRole);
        if (!mounted) return;
        if (!parsed.success) {
          setLoadError("Some settings data was invalid. Defaults were loaded for this session.");
        }
        setRecord(next);
        setDraft(next);
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiRequestError) {
          if (error.status === 401) {
            setAuthState("unauthorized");
            setLoadError("Session expired. Sign in again to edit your settings.");
          } else if (error.status === 403) {
            setAuthState("forbidden");
            setLoadError("You do not have permission to edit settings in this workspace.");
          } else {
            setLoadError(error.message);
          }
        } else {
          setLoadError(error instanceof Error ? error.message : "Unable to load settings.");
        }
        const fallback = fallbackRecord(currentUserName, currentUserRole);
        setRecord(fallback);
        setDraft(fallback);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [currentUserName, currentUserRole, reloadToken]);

  useEffect(() => {
    let mounted = true;

    const loadBranding = async () => {
      try {
        const response = await fetch("/api/data/branding");
        if (!response.ok) throw await parseApiError(response);
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!mounted) return;
        const parsed = parseBrandingPayload(payload);
        setBranding(parsed);
        setBrandingDraft(parsed);
        setBrandingStatus(blankBrandingStatus());
        setBrandingErrors(blankBrandingErrors());
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiRequestError && error.status !== 401 && error.status !== 403) {
          setBrandingStatus({ saving: false, success: null, error: error.message });
        } else {
          setBrandingStatus(blankBrandingStatus());
        }
        setBranding(DEFAULT_DISTRICT_BRANDING);
        setBrandingDraft(DEFAULT_DISTRICT_BRANDING);
        setBrandingErrors(blankBrandingErrors());
      }
    };

    void loadBranding();
    return () => {
      mounted = false;
    };
  }, [reloadToken]);

  const updateSection = <T extends SettingsSectionId>(section: T, patch: Partial<SettingsRecord[T]>) => {
    setDraft((previous) => (previous ? { ...previous, [section]: { ...previous[section], ...patch } } : previous));
    const patchKeys = Object.keys(patch);
    setErrors((previous) => ({
      ...previous,
      [section]: Object.fromEntries(
        Object.entries(previous[section]).filter(
          ([key]) => !patchKeys.some((patchKey) => key === patchKey || key.startsWith(`${patchKey}.`))
        )
      ),
    }));
    setStatus((previous) => ({
      ...previous,
      [section]: { ...previous[section], success: null, error: null },
    }));
  };

  const updateBrandingDraft = (patch: Partial<DistrictBrandingEditable>) => {
    setBrandingDraft((previous) => ({
      ...previous,
      ...patch,
      colors: { ...previous.colors, ...patch.colors },
    }));
    setBrandingStatus((previous) => ({ ...previous, success: null, error: null }));
  };

  const updateReadingBenchmark = (grade: NormalizedGrade, field: "min" | "max", value: string) => {
    const normalizedValue = value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);
    const current = draft?.system.readingBenchmarks ?? {};
    const baseline = current[grade] ?? DEFAULT_READING_BENCHMARKS[grade];
    updateSection("system", {
      readingBenchmarks: {
        ...current,
        [grade]: { ...baseline, [field]: normalizedValue },
      },
    });
  };

  const resetReadingBenchmarksToDefaults = () => {
    updateSection("system", { readingBenchmarks: undefined });
  };

  const isDirty = (section: SettingsSectionId) => (!!record && !!draft ? JSON.stringify(record[section]) !== JSON.stringify(draft[section]) : false);
  const isSectionDirty = (section: SettingsSectionId) => isDirty(section);
  const dirtySectionCount = sectionIds.filter((sectionId) => isSectionDirty(sectionId)).length;
  const hasUnsavedChanges =
    !!record && !!draft
      ? sectionIds.some((sectionId) => JSON.stringify(record[sectionId]) !== JSON.stringify(draft[sectionId]))
      : false;
  const isBrandingDirty = JSON.stringify(branding) !== JSON.stringify(brandingDraft);
  const canManageBranding = currentUserRole === UserRole.DISTRICT && authState === "ok";

  const requestTabChange = (nextTab: SettingsSectionId): boolean => {
    if (nextTab === activeTab) return true;
    const currentDirty = isSectionDirty(activeTab) || (activeTab === "system" && isBrandingDirty);
    if (currentDirty && !status[activeTab].saving && authState === "ok") {
      const shouldLeave = window.confirm("You have unsaved changes in this section. Leave without saving?");
      if (!shouldLeave) return false;
    }
    setActiveTab(nextTab);
    return true;
  };

  useEffect(() => {
    if ((!hasUnsavedChanges && !isBrandingDirty) || authState !== "ok") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges, isBrandingDirty, authState]);

  const resetSection = (section: SettingsSectionId) => {
    if (!record) return;
    setDraft((previous) => (previous ? { ...previous, [section]: record[section] } : previous));
    setErrors((previous) => ({ ...previous, [section]: {} }));
    setStatus((previous) => ({ ...previous, [section]: { ...previous[section], success: null, error: null } }));
  };

  const saveSection = async (section: SettingsSectionId) => {
    if (!draft) return;
    if (authState !== "ok") {
      setStatus((previous) => ({
        ...previous,
        [section]: {
          ...previous[section],
          error:
            authState === "unauthorized"
              ? "Your session expired. Sign in again to save settings."
              : "You do not have permission to update settings in this workspace.",
        },
      }));
      return;
    }
    const parsed = settingsSectionSchemaMap[section].safeParse(draft[section]);
    if (!parsed.success) {
      const fieldErrors = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
        const key = issue.path.length > 0 ? issue.path.join(".") : "root";
        acc[key] = issue.message;
        return acc;
      }, {});
      setErrors((previous) => ({ ...previous, [section]: fieldErrors }));
      setStatus((previous) => ({ ...previous, [section]: { ...previous[section], error: "Please resolve validation errors before saving." } }));
      return;
    }

    setStatus((previous) => ({ ...previous, [section]: { saving: true, success: null, error: null } }));
    try {
      const response = await fetch("/api/data/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data: parsed.data }),
      });
      if (!response.ok) throw await parseApiError(response);
      const payload = (await response.json()) as { row?: unknown };
      const nextParsed = settingsRecordSchema.safeParse(payload.row);
      if (!nextParsed.success) throw new Error("Settings response was invalid.");
      setAuthState("ok");
      setRecord(nextParsed.data);
      setDraft(nextParsed.data);
      setErrors((previous) => ({ ...previous, [section]: {} }));
      setStatus((previous) => ({ ...previous, [section]: { saving: false, success: "Changes saved.", error: null } }));
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        setAuthState(error.status === 401 ? "unauthorized" : "forbidden");
      }
      setStatus((previous) => ({
        ...previous,
        [section]: {
          saving: false,
          success: null,
          error:
            error instanceof ApiRequestError && error.status === 401
              ? "Session expired. Sign in again, then retry saving."
              : error instanceof ApiRequestError && error.status === 403
                ? "You do not have permission to update this settings section."
                : error instanceof Error
                  ? error.message
                  : "Unable to save section.",
        },
      }));
    }
  };

  const resetBranding = () => {
    setBrandingDraft(branding);
    setBrandingErrors(blankBrandingErrors());
    setBrandingStatus(blankBrandingStatus());
    const applied = applyTenantBrandingTheme(branding);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mtss_branding_snapshot", JSON.stringify(applied));
    }
  };

  const saveBranding = async () => {
    if (!canManageBranding) {
      setBrandingStatus({
        saving: false,
        success: null,
        error:
          authState === "unauthorized"
            ? "Session expired. Sign in again to update district branding."
            : "Only district administrators can update district branding.",
      });
      return;
    }

    const parsed = districtBrandingEditableSchema.safeParse(brandingDraft);
    if (!parsed.success) {
      const fieldErrors = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
        const key = issue.path.length > 0 ? issue.path.join(".") : "root";
        acc[key] = issue.message;
        return acc;
      }, {});
      setBrandingErrors(fieldErrors);
      setBrandingStatus({ saving: false, success: null, error: "Please resolve branding validation errors before saving." });
      return;
    }

    setBrandingStatus({ saving: true, success: null, error: null });
    try {
      const response = await fetch("/api/data/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed.data }),
      });
      if (!response.ok) throw await parseApiError(response);
      const payload = (await response.json().catch(() => null)) as unknown;
      const next = parseBrandingPayload(payload);
      setBranding(next);
      setBrandingDraft(next);
      setBrandingErrors(blankBrandingErrors());
      setBrandingStatus({ saving: false, success: "District branding updated.", error: null });
      const applied = applyTenantBrandingTheme(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("mtss_branding_snapshot", JSON.stringify(applied));
      }
    } catch (error) {
      setBrandingStatus({
        saving: false,
        success: null,
        error:
          error instanceof ApiRequestError && error.status === 403
            ? "Only district administrators can update district branding."
            : error instanceof ApiRequestError && error.status === 401
              ? "Session expired. Sign in again to update district branding."
              : error instanceof Error
                ? error.message
                : "Unable to update district branding.",
      });
    }
  };

  const onBrandingLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBrandingErrors((previous) => ({ ...previous, logoUrl: "Please upload an image file." }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setBrandingErrors((previous) => ({ ...previous, logoUrl: "Image must be 2MB or smaller." }));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const value = (reader.result as string) ?? null;
      updateBrandingDraft({ logoUrl: value });
      if (value) {
        applyTenantBrandingTheme({ ...brandingDraft, logoUrl: value });
      }
    };
    reader.readAsDataURL(file);
  };

  const onAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((previous) => ({ ...previous, profile: { ...previous.profile, avatarUrl: "Please upload an image file." } }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((previous) => ({ ...previous, profile: { ...previous.profile, avatarUrl: "Image must be 2MB or smaller." } }));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => updateSection("profile", { avatarUrl: (reader.result as string) ?? null });
    reader.readAsDataURL(file);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, sectionId: SettingsSectionId) => {
    const index = visibleSections.findIndex((section) => section.id === sectionId);
    if (index < 0) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (index + 1) % visibleSections.length;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (index - 1 + visibleSections.length) % visibleSections.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = visibleSections.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextSection = visibleSections[nextIndex];
    const didChange = requestTabChange(nextSection.id);
    if (didChange) {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(`settings-tab-${nextSection.id}`);
        if (target instanceof HTMLButtonElement) target.focus();
      });
    }
  };

  const validateProfileField = (field: keyof SettingsRecord["profile"], value: unknown) => {
    const fieldSchema = profileSettingsSchema.shape[field];
    const parsed = fieldSchema.safeParse(value);
    setErrors((previous) => {
      const nextProfileErrors = { ...previous.profile };
      if (parsed.success) {
        delete nextProfileErrors[field];
      } else {
        nextProfileErrors[field] = parsed.error.issues[0]?.message ?? "Invalid value.";
      }
      return { ...previous, profile: nextProfileErrors };
    });
  };

  if (isLoading && !draft) {
    return (
      <div className="mx-auto flex min-h-[340px] max-w-5xl items-center justify-center">
        <p className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
          <Loader2 size={16} className="animate-spin" /> Loading settings...
        </p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <p className="inline-flex items-center gap-2 text-sm font-semibold">
          <AlertCircle size={16} /> Unable to load settings.
        </p>
        <p className="mt-2 text-sm">Try again. If this continues, verify your session and tenant access.</p>
        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          <RotateCcw size={iconSize("sm")} /> Retry
        </button>
      </div>
    );
  }

  const activeStatus = status[activeTab];
  const activeErrors = errors[activeTab];
  const isProviderManagedAuth = draft.security.providerManagedAuth;
  const bioRemaining = 280 - draft.profile.bio.length;
  const isSessionLocked = authState !== "ok";
  const lastSavedValue = record?.updatedAt ?? draft.updatedAt;
  const parsedLastSaved = new Date(lastSavedValue);
  const lastSavedLabel = Number.isNaN(parsedLastSaved.getTime())
    ? "Unknown"
    : parsedLastSaved.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Account Settings</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Manage your workspace preferences</h1>
        <p className="mt-2 text-sm text-slate-600">{currentUserName} | {currentUserRole} | {currentSchoolName}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
            Last saved: {lastSavedLabel}
          </span>
          {hasUnsavedChanges ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
              {dirtySectionCount} section{dirtySectionCount === 1 ? "" : "s"} with unsaved changes
            </span>
          ) : (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">All changes saved</span>
          )}
        </div>
        {isSessionLocked ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <p className="inline-flex items-center gap-2 font-semibold">
              <AlertCircle size={16} />
              {authState === "unauthorized"
                ? "Session expired. Sign in again to continue editing settings."
                : "You do not have permission to edit settings in this workspace."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/api/auth/login?returnTo=/app/settings"
                className="inline-flex items-center rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
              >
                Sign in again
              </a>
              <a
                href="/api/auth/logout?returnTo=/"
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Sign out
              </a>
              <button
                type="button"
                onClick={() => setReloadToken((value) => value + 1)}
                className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
              >
                <RotateCcw size={14} /> Retry
              </button>
            </div>
          </div>
        ) : loadError ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p className="inline-flex items-center gap-2">
              <AlertCircle size={16} />
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-amber-100"
            >
              <RotateCcw size={14} /> Retry
            </button>
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden space-y-4 lg:block">
          <nav role="tablist" aria-label="Settings sections" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {visibleSections.map((section) => (
              <button
                key={section.id}
                id={`settings-tab-${section.id}`}
                role="tab"
                aria-selected={activeTab === section.id}
                aria-controls={`settings-panel-${section.id}`}
                type="button"
                tabIndex={activeTab === section.id ? 0 : -1}
                onClick={() => requestTabChange(section.id)}
                onKeyDown={(event) => handleTabKeyDown(event, section.id)}
                className={`flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left text-sm font-medium ${
                  activeTab === section.id ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-transparent text-slate-600 hover:bg-slate-50"
                }`}
              >
                <section.icon size={iconSize("md")} />
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{section.label}</span>
                  {isSectionDirty(section.id) ? <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /> : null}
                </span>
              </button>
            ))}
          </nav>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                {currentUserName.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{currentUserName}</p>
                <p className="truncate text-xs text-slate-500">{currentUserRole}</p>
              </div>
            </div>
            <a href="/api/auth/logout?returnTo=/" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
              <LogOut size={14} /> Sign Out
            </a>
          </div>
        </aside>

        <section id={`settings-panel-${activeTab}`} role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-4 lg:hidden">
            <label htmlFor="settings-mobile-section" className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
              Settings Section
            </label>
            <select
              id="settings-mobile-section"
              value={activeTab}
              onChange={(event) => requestTabChange(event.target.value as SettingsSectionId)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {visibleSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset disabled={isSessionLocked} className="space-y-4 disabled:cursor-not-allowed disabled:opacity-75">
          {activeTab === "profile" ? (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-slate-900">Public Profile</h2>
              <p className="-mt-3 text-sm text-slate-600">{sectionDescriptions.profile}</p>
              <div className="grid gap-8 md:grid-cols-[170px_minmax(0,1fr)]">
                <div>
                  <div className="relative">
                    <img src={draft.profile.avatarUrl || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentUserName.replace(/\s/g, "")}&backgroundColor=e0e7ff`} alt="profile avatar" className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-md ring-1 ring-slate-200" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Upload profile image">
                      <Camera size={16} />
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={onAvatarChange} />
                  </div>
                  {activeErrors.avatarUrl ? <p className="mt-2 text-xs text-rose-600">{activeErrors.avatarUrl}</p> : null}
                </div>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="profile-display-name" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Display Name
                      </label>
                      <input
                        id="profile-display-name"
                        value={draft.profile.displayName}
                        autoComplete="name"
                        onChange={(event) => updateSection("profile", { displayName: event.target.value })}
                        onBlur={() => validateProfileField("displayName", draft.profile.displayName)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {activeErrors.displayName ? <p className="mt-1 text-xs text-rose-600">{activeErrors.displayName}</p> : null}
                    </div>
                    <div>
                      <label htmlFor="profile-role" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Role</label>
                      <input id="profile-role" disabled value={currentUserRole} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="profile-timezone" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Timezone</label>
                    <select
                      id="profile-timezone"
                      value={draft.profile.timezone}
                      onChange={(event) => updateSection("profile", { timezone: event.target.value })}
                      onBlur={() => validateProfileField("timezone", draft.profile.timezone)}
                      className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {timezoneOptions.map((timezone) => (
                        <option key={timezone} value={timezone}>
                          {timezone}
                        </option>
                      ))}
                    </select>
                    {activeErrors.timezone ? <p className="mt-1 text-xs text-rose-600">{activeErrors.timezone}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="profile-email" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="profile-email"
                        type="email"
                        autoComplete="email"
                        value={draft.profile.email}
                        onChange={(event) => updateSection("profile", { email: event.target.value })}
                        onBlur={() => validateProfileField("email", draft.profile.email)}
                        className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {activeErrors.email ? <p className="mt-1 text-xs text-rose-600">{activeErrors.email}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="profile-bio" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Bio</label>
                    <textarea
                      id="profile-bio"
                      value={draft.profile.bio}
                      onChange={(event) => updateSection("profile", { bio: event.target.value })}
                      onBlur={() => validateProfileField("bio", draft.profile.bio)}
                      className="h-24 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className={`mt-1 text-xs ${bioRemaining < 0 ? "text-rose-600" : "text-slate-500"}`}>{bioRemaining} characters remaining</p>
                    {activeErrors.bio ? <p className="mt-1 text-xs text-rose-600">{activeErrors.bio}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
              <p className="-mt-2 text-sm text-slate-600">{sectionDescriptions.notifications}</p>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">Email Notifications</p>
                  <p className="text-xs text-slate-500">Receive updates in your inbox for alerts and summaries.</p>
                </div>
                <Toggle
                  label="Email notifications"
                  checked={draft.notifications.emailNotifications}
                  disabled={isSessionLocked}
                  onChange={(checked) => updateSection("notifications", { emailNotifications: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">Push Notifications</p>
                  <p className="text-xs text-slate-500">Show immediate in-app alerts while you work.</p>
                </div>
                <Toggle
                  label="Push notifications"
                  checked={draft.notifications.pushNotifications}
                  disabled={isSessionLocked}
                  onChange={(checked) => updateSection("notifications", { pushNotifications: checked })}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Digest Frequency</label>
                <p className="-mt-1 mb-2 text-xs text-slate-500">Choose how often consolidated updates are delivered.</p>
                <select value={draft.notifications.digestFrequency} onChange={(event) => updateSection("notifications", { digestFrequency: event.target.value as "Instant" | "Daily" | "Weekly" })} className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Instant">Instant</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>
            </div>
          ) : null}

          {activeTab === "security" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Security</h2>
              <p className="-mt-2 text-sm text-slate-600">{sectionDescriptions.security}</p>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">Two-Factor Authentication</p>
                <Toggle
                  label="Two-factor authentication"
                  checked={draft.security.twoFactorEnabled}
                  disabled={isProviderManagedAuth || isSessionLocked}
                  onChange={(checked) => updateSection("security", { twoFactorEnabled: checked })}
                />
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
                <p className="font-bold">Authentication is managed by WorkOS</p>
                <p className="mt-1 text-xs text-indigo-800">
                  Password reset and MFA policy are controlled by your identity provider.
                  {isProviderManagedAuth ? " Two-factor toggles in this app are read-only." : ""}
                </p>
                <a href="/api/auth/login?returnTo=/app/settings" className="mt-3 inline-flex rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                  Re-authenticate with provider
                </a>
              </div>
            </div>
          ) : null}

          {activeTab === "preferences" ? (
            <div className="space-y-4 max-w-md">
              <h2 className="text-xl font-bold text-slate-900">Family Preferences</h2>
              <p className="-mt-2 text-sm text-slate-600">{sectionDescriptions.preferences}</p>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Preferred Language</label>
                <select value={draft.preferences.preferredLanguage} onChange={(event) => updateSection("preferences", { preferredLanguage: event.target.value as "English" | "Spanish" | "Mandarin" | "Arabic" })} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Mandarin">Mandarin</option>
                  <option value="Arabic">Arabic</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Contact Priority</label>
                <p className="-mt-1 mb-2 text-xs text-slate-500">Set which channel school outreach should try first.</p>
                <select
                  value={draft.preferences.contactMethodPriority}
                  onChange={(event) =>
                    updateSection("preferences", {
                      contactMethodPriority: event.target.value as "Email first, then Phone" | "Phone first, then Email" | "SMS Only",
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Email first, then Phone">Email first, then Phone</option>
                  <option value="Phone first, then Email">Phone first, then Email</option>
                  <option value="SMS Only">SMS Only</option>
                </select>
              </div>
            </div>
          ) : null}

          {activeTab === "classroom" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Classroom Defaults</h2>
              <p className="-mt-2 text-sm text-slate-600">{sectionDescriptions.classroom}</p>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-800">Auto-flag low attendance</p>
                <Toggle
                  label="Auto-flag low attendance"
                  checked={draft.classroom.autoFlagLowAttendance}
                  disabled={isSessionLocked}
                  onChange={(checked) => updateSection("classroom", { autoFlagLowAttendance: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-800">Weekly parent summary</p>
                <Toggle
                  label="Weekly parent summary"
                  checked={draft.classroom.weeklyParentSummary}
                  disabled={isSessionLocked}
                  onChange={(checked) => updateSection("classroom", { weeklyParentSummary: checked })}
                />
              </div>
            </div>
          ) : null}

          {activeTab === "system" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">System Integrations</h2>
              <p className="-mt-2 text-sm text-slate-600">{sectionDescriptions.system}</p>
              {systemIntegrationRows.map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500">{description}</p>
                  </div>
                  <Toggle
                    label={`Connect ${label}`}
                    checked={draft.system[key]}
                    disabled={isSessionLocked}
                    onChange={(checked) => updateSection("system", { [key]: checked })}
                  />
                </div>
              ))}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                      <Globe size={14} />
                      Reading Benchmarks
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">Grade-level reading targets</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Teacher views use distance scoring; principal, district, and parent views use band-based statuses.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetReadingBenchmarksToDefaults}
                    disabled={isSessionLocked || !draft.system.readingBenchmarks || Object.keys(draft.system.readingBenchmarks).length === 0}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <RotateCcw size={14} />
                    Reset to Defaults
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-[540px] w-full text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                      <tr>
                        <th className="px-2 py-2">Grade</th>
                        <th className="px-2 py-2">Minimum</th>
                        <th className="px-2 py-2">Maximum</th>
                        <th className="px-2 py-2">Default Band</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {READING_BENCHMARK_GRADE_ORDER.map((grade) => {
                        const customBand = draft.system.readingBenchmarks?.[grade];
                        const effectiveBand = customBand ?? DEFAULT_READING_BENCHMARKS[grade];
                        const minError = activeErrors[`readingBenchmarks.${grade}.min`];
                        const maxError = activeErrors[`readingBenchmarks.${grade}.max`];
                        return (
                          <tr key={grade}>
                            <td className="px-2 py-3">
                              <span className="inline-flex rounded-full border border-slate-300 bg-white px-2.5 py-1 font-bold text-slate-700">
                                {grade === "K" ? "K" : `Grade ${grade}`}
                              </span>
                            </td>
                            <td className="px-2 py-3 align-top">
                              <input
                                value={effectiveBand.min}
                                maxLength={1}
                                onChange={(event) => updateReadingBenchmark(grade, "min", event.target.value)}
                                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-sm font-bold uppercase text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                aria-label={`Minimum reading level for grade ${grade}`}
                              />
                              {minError ? <p className="mt-1 text-[11px] text-rose-600">{minError}</p> : null}
                            </td>
                            <td className="px-2 py-3 align-top">
                              <input
                                value={effectiveBand.max}
                                maxLength={1}
                                onChange={(event) => updateReadingBenchmark(grade, "max", event.target.value)}
                                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-sm font-bold uppercase text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                aria-label={`Maximum reading level for grade ${grade}`}
                              />
                              {maxError ? <p className="mt-1 text-[11px] text-rose-600">{maxError}</p> : null}
                            </td>
                            <td className="px-2 py-3 text-slate-600">
                              {DEFAULT_READING_BENCHMARKS[grade].min}-{DEFAULT_READING_BENCHMARKS[grade].max}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                      <Palette size={14} />
                      District Branding
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">Colors, logo, and mascot defaults</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      This branding applies across workspace surfaces for all schools in the district context.
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      canManageBranding ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {canManageBranding ? "Editable" : "Read only"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div
                    className="rounded-xl border p-4 shadow-sm"
                    style={{ borderColor: brandingDraft.colors.secondary, backgroundColor: brandingDraft.colors.surface }}
                  >
                    <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 ring-1 ring-black/10">
                      {brandingDraft.logoUrl ? (
                        <img src={brandingDraft.logoUrl} alt="District logo preview" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <Palette size={18} style={{ color: brandingDraft.colors.primary }} />
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-900">{brandingDraft.mascotName}</p>
                    <p className="mt-1 text-xs text-slate-600">Mascot and logo preview</p>
                    <div className="mt-3 flex items-center gap-2">
                      {colorFieldIds.map((field) => (
                        <span
                          key={field}
                          className="h-5 w-5 rounded-full border border-white/80 shadow-sm"
                          style={{ backgroundColor: brandingDraft.colors[field] }}
                          aria-label={`${field} color`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="branding-mascot-name" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Mascot Name
                      </label>
                      <input
                        id="branding-mascot-name"
                        value={brandingDraft.mascotName}
                        disabled={!canManageBranding}
                        onChange={(event) => updateBrandingDraft({ mascotName: event.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                      {brandingErrors.mascotName ? <p className="mt-1 text-xs text-rose-600">{brandingErrors.mascotName}</p> : null}
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">District Logo</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!canManageBranding}
                          onClick={() => brandingLogoInputRef.current?.click()}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          <Camera size={14} />
                          Upload Logo
                        </button>
                        <button
                          type="button"
                          disabled={!canManageBranding || !brandingDraft.logoUrl}
                          onClick={() => updateBrandingDraft({ logoUrl: null })}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          Remove
                        </button>
                      </div>
                      <input ref={brandingLogoInputRef} type="file" className="hidden" accept="image/*" onChange={onBrandingLogoChange} />
                      {brandingErrors.logoUrl ? <p className="mt-1 text-xs text-rose-600">{brandingErrors.logoUrl}</p> : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {colorFieldIds.map((field) => (
                        <div key={field}>
                          <label htmlFor={`branding-color-${field}`} className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            {field}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              id={`branding-color-${field}`}
                              type="color"
                              value={brandingDraft.colors[field]}
                              disabled={!canManageBranding}
                              onChange={(event) => {
                                const nextColors = { ...brandingDraft.colors, [field]: event.target.value };
                                updateBrandingDraft({ colors: nextColors });
                                applyTenantBrandingTheme({ ...brandingDraft, colors: nextColors });
                              }}
                              className="h-9 w-11 rounded border border-slate-300 bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <input
                              value={brandingDraft.colors[field]}
                              disabled={!canManageBranding}
                              onChange={(event) => {
                                const nextColors = { ...brandingDraft.colors, [field]: event.target.value };
                                updateBrandingDraft({ colors: nextColors });
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                            />
                          </div>
                          {brandingErrors[`colors.${field}`] ? (
                            <p className="mt-1 text-xs text-rose-600">{brandingErrors[`colors.${field}`]}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {brandingStatus.error ? (
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-rose-700">
                    <AlertCircle size={14} />
                    {brandingStatus.error}
                  </p>
                ) : null}
                {brandingStatus.success ? (
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <CheckCircle2 size={14} />
                    {brandingStatus.success}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {!canManageBranding ? (
                    <p className="mr-auto text-xs font-semibold text-slate-500">District admin role required to save branding changes.</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={!canManageBranding || !isBrandingDirty || brandingStatus.saving}
                    onClick={resetBranding}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <RotateCcw size={14} />
                    Reset Branding
                  </button>
                  <button
                    type="button"
                    disabled={!canManageBranding || !isBrandingDirty || brandingStatus.saving}
                    onClick={() => void saveBranding()}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {brandingStatus.saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {brandingStatus.saving ? "Saving..." : "Save Branding"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          </fieldset>

          <div aria-live="polite" className="mt-6">
            {activeStatus.error ? <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-rose-700"><AlertCircle size={16} />{activeStatus.error}</p> : null}
            {activeStatus.success ? <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 size={16} />{activeStatus.success}</p> : null}
          </div>

          <div className="sticky bottom-0 z-10 -mx-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur md:-mx-8 md:px-8 lg:static lg:m-0 lg:bg-transparent lg:p-0 lg:pt-4">
            {isSessionLocked ? (
              <p className="mr-auto text-xs font-semibold text-rose-700">Re-authenticate to edit settings.</p>
            ) : null}
            <button type="button" onClick={() => resetSection(activeTab)} disabled={isSessionLocked || !isDirty(activeTab) || activeStatus.saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RotateCcw size={16} /> Reset
            </button>
            <button type="button" onClick={() => void saveSection(activeTab)} disabled={isSessionLocked || !isDirty(activeTab) || activeStatus.saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {activeStatus.saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {activeStatus.saving ? "Saving..." : "Save"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
