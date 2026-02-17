import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bell, Camera, CheckCircle2, Database, Globe, Loader2, LogOut, Mail, RotateCcw, Save, School, Shield, User } from "lucide-react";
import { UserRole } from "../types";
import { settingsRecordSchema, settingsSectionSchemaMap, type SettingsRecord, type SettingsSectionId } from "../lib/schemas/settings";

interface SettingsViewProps {
  currentUserRole: UserRole;
  currentUserName: string;
  currentSchoolName: string;
}

type SectionStatus = { saving: boolean; success: string | null; error: string | null };
type SectionItem = { id: SettingsSectionId; label: string; icon: React.ComponentType<{ size?: number }>; roles: UserRole[] | "all" };

const sections: SectionItem[] = [
  { id: "profile", label: "My Profile", icon: User, roles: "all" },
  { id: "notifications", label: "Notifications", icon: Bell, roles: "all" },
  { id: "security", label: "Security", icon: Shield, roles: "all" },
  { id: "preferences", label: "Family Preferences", icon: Globe, roles: [UserRole.PARENT] },
  { id: "classroom", label: "Classroom Defaults", icon: School, roles: [UserRole.TEACHER] },
  { id: "system", label: "System Integrations", icon: Database, roles: [UserRole.PRINCIPAL, UserRole.DISTRICT] },
];

const sectionIds = sections.map((s) => s.id);
const blankStatus = () =>
  Object.fromEntries(sectionIds.map((id) => [id, { saving: false, success: null, error: null }])) as Record<SettingsSectionId, SectionStatus>;
const blankErrors = () => Object.fromEntries(sectionIds.map((id) => [id, {}])) as Record<SettingsSectionId, Record<string, string>>;

const parseApiError = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? `Request failed (${response.status})`;
};

const fallbackRecord = (name: string, role: UserRole): SettingsRecord =>
  settingsRecordSchema.parse({
    id: "settings::fallback",
    userId: "fallback",
    version: 1,
    profile: { displayName: name, email: `${name.toLowerCase().replace(/\s+/g, ".")}@bufsd.org`, bio: "", avatarUrl: null },
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
    system: { infiniteCampusConnected: true, cleverConnected: true, powerSchoolConnected: false },
    updatedAt: new Date().toISOString(),
    updatedBy: "fallback",
  });

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="relative inline-flex cursor-pointer items-center" aria-label={label}>
    <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-300" />
    <span className="pointer-events-none absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
  </label>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUserRole, currentUserName, currentSchoolName }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsSectionId>("profile");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [record, setRecord] = useState<SettingsRecord | null>(null);
  const [draft, setDraft] = useState<SettingsRecord | null>(null);
  const [status, setStatus] = useState<Record<SettingsSectionId, SectionStatus>>(blankStatus);
  const [errors, setErrors] = useState<Record<SettingsSectionId, Record<string, string>>>(blankErrors);

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
      try {
        const response = await fetch("/api/data/settings");
        if (!response.ok) throw new Error(await parseApiError(response));
        const payload = (await response.json()) as { rows?: unknown[] };
        const parsed = settingsRecordSchema.safeParse(payload.rows?.[0]);
        const next = parsed.success ? parsed.data : fallbackRecord(currentUserName, currentUserRole);
        if (!mounted) return;
        setRecord(next);
        setDraft(next);
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load settings.");
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
  }, [currentUserName, currentUserRole]);

  const updateSection = <T extends SettingsSectionId>(section: T, patch: Partial<SettingsRecord[T]>) => {
    setDraft((previous) => (previous ? { ...previous, [section]: { ...previous[section], ...patch } } : previous));
  };

  const isDirty = (section: SettingsSectionId) => (!!record && !!draft ? JSON.stringify(record[section]) !== JSON.stringify(draft[section]) : false);

  const resetSection = (section: SettingsSectionId) => {
    if (!record) return;
    setDraft((previous) => (previous ? { ...previous, [section]: record[section] } : previous));
    setErrors((previous) => ({ ...previous, [section]: {} }));
    setStatus((previous) => ({ ...previous, [section]: { ...previous[section], success: null, error: null } }));
  };

  const saveSection = async (section: SettingsSectionId) => {
    if (!draft) return;
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
      if (!response.ok) throw new Error(await parseApiError(response));
      const payload = (await response.json()) as { row?: unknown };
      const nextParsed = settingsRecordSchema.safeParse(payload.row);
      if (!nextParsed.success) throw new Error("Settings response was invalid.");
      setRecord(nextParsed.data);
      setDraft(nextParsed.data);
      setErrors((previous) => ({ ...previous, [section]: {} }));
      setStatus((previous) => ({ ...previous, [section]: { saving: false, success: "Changes saved.", error: null } }));
    } catch (error) {
      setStatus((previous) => ({
        ...previous,
        [section]: { saving: false, success: null, error: error instanceof Error ? error.message : "Unable to save section." },
      }));
    }
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

  if (isLoading || !draft) {
    return (
      <div className="mx-auto flex min-h-[340px] max-w-5xl items-center justify-center">
        <p className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
          <Loader2 size={16} className="animate-spin" /> Loading settings...
        </p>
      </div>
    );
  }

  const activeStatus = status[activeTab];
  const activeErrors = errors[activeTab];

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Account Settings</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Manage your workspace preferences</h1>
        <p className="mt-2 text-sm text-slate-600">{currentUserName} | {currentUserRole} | {currentSchoolName}</p>
        {loadError ? <p className="mt-3 inline-flex items-center gap-2 text-sm text-amber-700"><AlertCircle size={16} />{loadError}</p> : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <nav role="tablist" aria-label="Settings sections" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {visibleSections.map((section) => (
              <button
                key={section.id}
                id={`settings-tab-${section.id}`}
                role="tab"
                aria-selected={activeTab === section.id}
                aria-controls={`settings-panel-${section.id}`}
                type="button"
                onClick={() => setActiveTab(section.id)}
                className={`flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left text-sm font-medium ${
                  activeTab === section.id ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-transparent text-slate-600 hover:bg-slate-50"
                }`}
              >
                <section.icon size={17} /> {section.label}
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
          {activeTab === "profile" ? (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-slate-900">Public Profile</h2>
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
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Display Name</label>
                      <input value={draft.profile.displayName} onChange={(event) => updateSection("profile", { displayName: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      {activeErrors.displayName ? <p className="mt-1 text-xs text-rose-600">{activeErrors.displayName}</p> : null}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Role</label>
                      <input disabled value={currentUserRole} className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={draft.profile.email} onChange={(event) => updateSection("profile", { email: event.target.value })} className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    {activeErrors.email ? <p className="mt-1 text-xs text-rose-600">{activeErrors.email}</p> : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Bio</label>
                    <textarea value={draft.profile.bio} onChange={(event) => updateSection("profile", { bio: event.target.value })} className="h-24 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    {activeErrors.bio ? <p className="mt-1 text-xs text-rose-600">{activeErrors.bio}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">Email Notifications</p>
                <Toggle label="Email notifications" checked={draft.notifications.emailNotifications} onChange={(checked) => updateSection("notifications", { emailNotifications: checked })} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">Push Notifications</p>
                <Toggle label="Push notifications" checked={draft.notifications.pushNotifications} onChange={(checked) => updateSection("notifications", { pushNotifications: checked })} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Digest Frequency</label>
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
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">Two-Factor Authentication</p>
                <Toggle label="Two-factor authentication" checked={draft.security.twoFactorEnabled} onChange={(checked) => updateSection("security", { twoFactorEnabled: checked })} />
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
                <p className="font-bold">Authentication is managed by WorkOS</p>
                <p className="mt-1 text-xs text-indigo-800">Password reset and account recovery are controlled by your identity provider.</p>
                <a href="/api/auth/login?returnTo=/app/settings" className="mt-3 inline-flex rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                  Re-authenticate with provider
                </a>
              </div>
            </div>
          ) : null}

          {activeTab === "preferences" ? (
            <div className="space-y-4 max-w-md">
              <h2 className="text-xl font-bold text-slate-900">Family Preferences</h2>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Preferred Language</label>
                <select value={draft.preferences.preferredLanguage} onChange={(event) => updateSection("preferences", { preferredLanguage: event.target.value as "English" | "Spanish" | "Mandarin" | "Arabic" })} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Mandarin">Mandarin</option>
                  <option value="Arabic">Arabic</option>
                </select>
              </div>
            </div>
          ) : null}

          {activeTab === "classroom" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Classroom Defaults</h2>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-800">Auto-flag low attendance</p>
                <Toggle label="Auto-flag low attendance" checked={draft.classroom.autoFlagLowAttendance} onChange={(checked) => updateSection("classroom", { autoFlagLowAttendance: checked })} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-800">Weekly parent summary</p>
                <Toggle label="Weekly parent summary" checked={draft.classroom.weeklyParentSummary} onChange={(checked) => updateSection("classroom", { weeklyParentSummary: checked })} />
              </div>
            </div>
          ) : null}

          {activeTab === "system" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">System Integrations</h2>
              {[
                ["infiniteCampusConnected", "Infinite Campus"],
                ["cleverConnected", "Clever"],
                ["powerSchoolConnected", "PowerSchool"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-800">{label}</p>
                  <Toggle
                    label={`Toggle ${label}`}
                    checked={draft.system[key as keyof typeof draft.system]}
                    onChange={(checked) => updateSection("system", { [key]: checked } as Partial<typeof draft.system>)}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            {activeStatus.error ? <p className="mr-auto inline-flex items-center gap-2 text-sm font-medium text-rose-700"><AlertCircle size={16} />{activeStatus.error}</p> : null}
            {activeStatus.success ? <p className="mr-auto inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 size={16} />{activeStatus.success}</p> : null}
            <button type="button" onClick={() => resetSection(activeTab)} disabled={!isDirty(activeTab) || activeStatus.saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RotateCcw size={16} /> Reset
            </button>
            <button type="button" onClick={() => void saveSection(activeTab)} disabled={!isDirty(activeTab) || activeStatus.saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {activeStatus.saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
