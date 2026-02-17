import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import type { DashboardData, UserRole } from "../types";

type DashboardResponse = {
  ok: boolean;
  data: DashboardData;
  requestId: string;
};

const parseError = async (response: Response): Promise<Error> => {
  const json = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(json?.error || `Request failed (${response.status})`);
};

const fetchDashboard = async (role: UserRole): Promise<DashboardResponse> => {
  const response = await fetch(`/api/dashboard?role=${encodeURIComponent(role)}`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as DashboardResponse;
};

export const useDashboardData = (role: UserRole) =>
  useQuery({
    queryKey: queryKeys.dashboard.byRole(role),
    queryFn: () => fetchDashboard(role),
  });
