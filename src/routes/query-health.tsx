import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

type HealthResponse = {
  ok: boolean;
  timestamp: string;
  environment: "start-server-route";
};

export const Route = createFileRoute("/query-health")({
  component: QueryHealthRoute,
});

function QueryHealthRoute() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await fetch("/api/health");
      if (!response.ok) {
        throw new Error(`Health endpoint failed (${response.status})`);
      }
      return (await response.json()) as HealthResponse;
    },
    refetchInterval: 30_000,
  });

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">TanStack Query Health Check</h1>
      <p className="mb-6 text-sm text-slate-500">
        This page uses <code>@tanstack/react-query</code> to poll the Start server route <code>/api/health</code>.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {healthQuery.isPending ? <p className="text-slate-600">Loading health status…</p> : null}
        {healthQuery.isError ? (
          <p className="text-rose-600">Error: {healthQuery.error instanceof Error ? healthQuery.error.message : "Unknown error"}</p>
        ) : null}
        {healthQuery.data ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-semibold text-slate-700">Status:</span>{" "}
              <span className={healthQuery.data.ok ? "text-emerald-600" : "text-rose-600"}>
                {healthQuery.data.ok ? "OK" : "NOT OK"}
              </span>
            </p>
            <p>
              <span className="font-semibold text-slate-700">Timestamp:</span> {new Date(healthQuery.data.timestamp).toLocaleString()}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Source:</span> {healthQuery.data.environment}
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
