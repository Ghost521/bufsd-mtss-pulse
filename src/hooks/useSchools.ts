import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";

export type SchoolDirectoryRow = {
  id: string;
  districtId: string;
  name: string;
  type: "Elementary" | "Middle" | "High";
  principalName: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

type SchoolsResponse = {
  ok: boolean;
  rows: SchoolDirectoryRow[];
  total: number;
  requestId: string;
};

const parseError = async (response: Response): Promise<Error> => {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(payload?.error || `Request failed (${response.status})`);
};

const fetchSchools = async (): Promise<SchoolsResponse> => {
  const response = await fetch("/api/schools");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as SchoolsResponse;
};

export const useSchools = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: queryKeys.schools.all,
    queryFn: fetchSchools,
    enabled: options?.enabled ?? true,
  });
