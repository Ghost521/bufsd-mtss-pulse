import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";

export type CollectionDomain = "calendar" | "messages" | "documents" | "interventions" | "lesson-plans" | "imports";

export type CollectionResponse<TRow> = {
  ok: boolean;
  rows: TRow[];
  total: number;
  requestId: string;
};

const parseError = async (response: Response): Promise<Error> => {
  const json = (await response.json().catch(() => null)) as { error?: string } | null;
  const message = json?.error || `Request failed (${response.status})`;
  return new Error(message);
};

const fetchRows = async <TRow>(domain: CollectionDomain): Promise<CollectionResponse<TRow>> => {
  const response = await fetch(`/api/data/${domain}`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as CollectionResponse<TRow>;
};

const replaceRows = async <TRow>(domain: CollectionDomain, rows: TRow[]): Promise<CollectionResponse<TRow>> => {
  const response = await fetch(`/api/data/${domain}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as CollectionResponse<TRow>;
};

const createRow = async <TRow extends object>(domain: CollectionDomain, row: TRow): Promise<TRow> => {
  const response = await fetch(`/api/data/${domain}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row }),
  });
  if (!response.ok) throw await parseError(response);
  const data = (await response.json()) as { row: TRow };
  return data.row;
};

const updateRow = async <TRow extends object>(domain: CollectionDomain, id: string, patch: Partial<TRow>): Promise<TRow> => {
  const response = await fetch(`/api/data/${domain}?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch }),
  });
  if (!response.ok) throw await parseError(response);
  const data = (await response.json()) as { row: TRow };
  return data.row;
};

const deleteRow = async <TRow>(domain: CollectionDomain, id: string): Promise<TRow> => {
  const response = await fetch(`/api/data/${domain}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw await parseError(response);
  const data = (await response.json()) as { row: TRow };
  return data.row;
};

export const useTenantCollection = <TRow extends { id: string }>(domain: CollectionDomain) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.data.byDomain(domain);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchRows<TRow>(domain),
  });

  const replaceMutation = useMutation({
    mutationFn: (rows: TRow[]) => replaceRows(domain, rows),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const createMutation = useMutation({
    mutationFn: (row: TRow) => createRow(domain, row),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TRow> }) => updateRow(domain, id, patch),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteRow<TRow>(domain, id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    query,
    replaceMutation,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
