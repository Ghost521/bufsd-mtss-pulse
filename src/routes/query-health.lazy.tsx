import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { queryClient } from "../lib/query-client";

type HealthResponse = {
  ok?: boolean;
  timestamp?: string;
  environment?: string;
  requestId?: string;
  authConfigured?: boolean;
  auth?: {
    signedIn?: boolean;
    workosEnabled?: boolean;
    reason?: string;
    canSwitchUsers?: boolean;
    autoProvisionEnabled?: boolean;
  };
  session?: {
    activeRole?: string;
    activeUserId?: string;
    activeSchoolId?: string | null;
    activeTeacherId?: string | null;
  } | null;
  availableUsers?: Array<{
    id: string;
    name: string;
    email: string;
    primaryRole: string;
  }>;
  auditCount?: number;
  persistence?: Record<string, unknown>;
};

export const Route = createLazyFileRoute("/query-health")({
  component: QueryHealthRoute,
});

function QueryHealthRoute() {
  return (
    <QueryClientProvider client={queryClient}>
      <QueryHealthContent />
    </QueryClientProvider>
  );
}

function QueryHealthContent() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await fetch("/api/health", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Health request failed (${response.status})`);
      }

      return (await response.json()) as HealthResponse;
    },
  });

  const payload = healthQuery.data;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Diagnostics</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Query Health</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            This route stays outside the main workspace shell and exercises the React Query bootstrap path directly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => healthQuery.refetch()}
          disabled={healthQuery.isFetching}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {healthQuery.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {healthQuery.isPending ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading health snapshot…</p>
        </section>
      ) : null}

      {healthQuery.isError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-rose-900">Health route failed</h2>
          <p className="mt-2 text-sm text-rose-700">
            {healthQuery.error instanceof Error ? healthQuery.error.message : "Unknown error"}
          </p>
        </section>
      ) : null}

      {payload ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="API Status" value={payload.ok ? "OK" : "Unavailable"} />
            <MetricCard label="Environment" value={payload.environment ?? "Unknown"} />
            <MetricCard label="Signed In" value={payload.auth?.signedIn ? "Yes" : "No"} />
            <MetricCard label="Audit Entries" value={String(payload.auditCount ?? 0)} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Auth Snapshot</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <DetailRow label="Request ID" value={payload.requestId ?? "Unavailable"} />
                <DetailRow label="Timestamp" value={payload.timestamp ?? "Unavailable"} />
                <DetailRow label="Auth Configured" value={payload.authConfigured ? "Yes" : "No"} />
                <DetailRow label="WorkOS Enabled" value={payload.auth?.workosEnabled ? "Yes" : "No"} />
                <DetailRow label="Can Switch Users" value={payload.auth?.canSwitchUsers ? "Yes" : "No"} />
                <DetailRow label="Auto Provision" value={payload.auth?.autoProvisionEnabled ? "Yes" : "No"} />
                <DetailRow label="Active Role" value={payload.session?.activeRole ?? "None"} />
                <DetailRow label="Active User" value={payload.session?.activeUserId ?? "None"} />
              </dl>
              {payload.auth?.reason ? (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Auth reason: {payload.auth.reason}
                </p>
              ) : null}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Available Users</h2>
              <p className="mt-2 text-sm text-slate-600">
                {payload.availableUsers?.length
                  ? "Users exposed by the health route for quick session switching."
                  : "No switchable users in this session."}
              </p>
              <ul className="mt-4 space-y-3">
                {(payload.availableUsers ?? []).map((user) => (
                  <li key={user.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-900">{user.name}</p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{user.primaryRole}</p>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Persistence Snapshot</h2>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(payload.persistence ?? {}, null, 2)}
            </pre>
          </section>
        </>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}
