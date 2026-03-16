import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_DISTRICT_BRANDING,
  parseDistrictBrandingEditable,
  parseDistrictBrandingRecord,
  parseDistrictBrandingSnapshot,
  type DistrictBrandingEditable,
} from "../lib/branding";
import { applyTenantBrandingTheme, resolveBrandingTheme } from "../lib/branding-theme";
import { queryKeys } from "../lib/query-keys";

const BRANDING_SNAPSHOT_KEY = "mtss_branding_snapshot";

type BrandingApiPayload = {
  ok?: boolean;
  rows?: unknown[];
  row?: unknown;
  error?: string;
};

const parseBrandingFromPayload = (payload: BrandingApiPayload): DistrictBrandingEditable | null => {
  const fromRows = parseDistrictBrandingRecord(payload.rows?.[0]);
  if (fromRows) return resolveBrandingTheme(fromRows);

  const fromRow = parseDistrictBrandingRecord(payload.row);
  if (fromRow) return resolveBrandingTheme(fromRow);

  const editable = parseDistrictBrandingEditable(payload.row);
  if (editable) return resolveBrandingTheme(editable);

  return null;
};

const readBrandingSnapshot = (): DistrictBrandingEditable => {
  if (typeof window === "undefined") return DEFAULT_DISTRICT_BRANDING;
  const snapshot = parseDistrictBrandingSnapshot(window.localStorage.getItem(BRANDING_SNAPSHOT_KEY));
  return snapshot ? resolveBrandingTheme(snapshot) : DEFAULT_DISTRICT_BRANDING;
};

const writeBrandingSnapshot = (branding: DistrictBrandingEditable): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BRANDING_SNAPSHOT_KEY, JSON.stringify(branding));
  } catch {
    // Ignore browser storage failures.
  }
};

const fetchTenantBranding = async (): Promise<DistrictBrandingEditable> => {
  const response = await fetch("/api/data/branding", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as BrandingApiPayload | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? `Branding request failed (${response.status}).`);
  }

  const parsed = parseBrandingFromPayload(payload);
  if (!parsed) throw new Error("Branding payload was invalid.");
  return parsed;
};

export const useTenantBranding = (options?: { enabled?: boolean; applyTheme?: boolean }) => {
  const snapshot = useMemo(() => readBrandingSnapshot(), []);

  const query = useQuery({
    queryKey: queryKeys.branding,
    queryFn: fetchTenantBranding,
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
    retry: false,
    initialData: snapshot,
  });

  const branding = query.data ?? snapshot;

  useEffect(() => {
    if (options?.applyTheme === false) return;
    applyTenantBrandingTheme(branding);
  }, [branding, options?.applyTheme]);

  useEffect(() => {
    writeBrandingSnapshot(branding);
  }, [branding]);

  return {
    branding,
    query,
  };
};

export const getDefaultTenantBranding = (): DistrictBrandingEditable => DEFAULT_DISTRICT_BRANDING;
