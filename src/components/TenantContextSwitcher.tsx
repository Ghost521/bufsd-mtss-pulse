import { useEffect, useMemo, useState } from "react";

type TenantContext = {
  organizationId: string;
  districtId?: string;
  schoolId?: string;
};

type HealthSessionResponse = {
  ok: boolean;
  auth?: {
    workosEnabled: boolean;
    signedIn: boolean;
    canSwitchUsers: boolean;
  };
  session: {
    user: {
      id: string;
      name: string;
      email: string;
      primaryRole: string;
    };
    effectiveRoles: string[];
    activeContext: TenantContext;
    availableContexts: TenantContext[];
  } | null;
  availableUsers: Array<{
    id: string;
    name: string;
    email: string;
    primaryRole: string;
  }>;
};

const contextKey = (context: TenantContext): string =>
  `${context.organizationId}:${context.districtId ?? ""}:${context.schoolId ?? ""}`;

const describeContext = (context: TenantContext): string => {
  const districtPart = context.districtId ? ` / ${context.districtId}` : "";
  const schoolPart = context.schoolId ? ` / ${context.schoolId}` : "";
  return `${context.organizationId}${districtPart}${schoolPart}`;
};

type TenantContextSwitcherVariant = "topnav" | "sidebar";

interface TenantContextSwitcherProps {
  variant?: TenantContextSwitcherVariant;
}

export function TenantContextSwitcher({ variant = "topnav" }: TenantContextSwitcherProps) {
  const [data, setData] = useState<HealthSessionResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginHref = "/api/auth/login";
  const logoutHref = "/api/auth/logout";

  const load = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/health");
      const json = (await response.json()) as HealthSessionResponse;
      setData(json);
    } catch {
      setError("Unable to load organization context.");
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const availableContexts = useMemo(() => data?.session?.availableContexts ?? [], [data]);
  const activeContext = data?.session?.activeContext;
  const activeContextKey = activeContext ? contextKey(activeContext) : "";
  const canSwitchUsers = Boolean(data?.auth?.canSwitchUsers);
  const workosEnabled = Boolean(data?.auth?.workosEnabled);
  const hasSession = Boolean(data?.session);

  const postSessionChange = async (payload: { userId?: string; context?: TenantContext }) => {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Context update failed.");
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Context update failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const onUserChange = async (userId: string) => {
    await postSessionChange({ userId });
  };

  const onContextChange = async (key: string) => {
    const target = availableContexts.find((context) => contextKey(context) === key);
    if (!target) return;
    await postSessionChange({ context: target });
  };

  const isSidebar = variant === "sidebar";
  const containerClass = isSidebar ? "space-y-2.5" : "flex items-center gap-2";
  const labelClass = isSidebar ? "block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400" : "sr-only";
  const inputClass = isSidebar
    ? "w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-2 text-xs text-slate-100 transition-colors focus:border-brand-400 focus:outline-none disabled:opacity-60"
    : "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700";
  const actionClass = isSidebar
    ? "rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-2 text-xs text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-700 disabled:opacity-50"
    : "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  const primaryActionClass = isSidebar
    ? "rounded-lg border border-brand-400/60 bg-brand-500/20 px-2.5 py-2 text-xs text-brand-100 transition-colors hover:bg-brand-500/30"
    : "rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100";

  return (
    <div className={containerClass}>
      <p className={labelClass}>Organization Context</p>
      {canSwitchUsers ? (
        <select
          value={data?.session?.user.id ?? ""}
          onChange={(event) => void onUserChange(event.target.value)}
          disabled={isBusy || !data}
          className={`${inputClass} ${isSidebar ? "w-full" : "max-w-[180px]"}`}
          title="Active user profile"
          aria-label="Active user profile"
        >
          {(data?.availableUsers ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      ) : null}

      <select
        value={activeContextKey}
        onChange={(event) => void onContextChange(event.target.value)}
        disabled={isBusy || !hasSession || availableContexts.length === 0}
        className={`${inputClass} ${isSidebar ? "w-full" : "max-w-[240px]"}`}
        title="Active organization context"
        aria-label="Active organization context"
      >
        {availableContexts.map((context) => (
          <option key={contextKey(context)} value={contextKey(context)}>
            {describeContext(context)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => void load()}
        disabled={isBusy}
        className={actionClass}
      >
        Refresh Context
      </button>
      {workosEnabled && hasSession ? (
        <a
          href={logoutHref}
          className={actionClass}
        >
          Sign out
        </a>
      ) : null}
      {workosEnabled && !hasSession ? (
        <a
          href={loginHref}
          className={primaryActionClass}
        >
          Sign in
        </a>
      ) : null}

      {error ? <span className={`truncate text-xs text-rose-400 ${isSidebar ? "" : "max-w-[220px]"}`}>{error}</span> : null}
    </div>
  );
}
