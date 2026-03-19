import type { SessionContext, TenantContext } from "./tenant-types";

type ApiLogLevel = "info" | "warn" | "error";

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

type ApiLogDetails = Record<string, JsonLike | undefined>;

type ApiRequestLogInput = {
  request: Request;
  requestId: string;
  route: string;
  startedAt: number;
  response: Response;
  session?: SessionContext | null;
  details?: ApiLogDetails;
};

const toTenantLabel = (context: TenantContext | null | undefined): string | null => {
  if (!context) return null;
  return `${context.organizationId}:${context.districtId ?? ""}:${context.schoolId ?? ""}`;
};

const sanitizeDetails = (details: ApiLogDetails | undefined): Record<string, JsonLike> => {
  if (!details) return {};
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  ) as Record<string, JsonLike>;
};

const levelForStatus = (status: number): ApiLogLevel => {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
};

export const logApiResponse = (input: ApiRequestLogInput): Response => {
  const url = new URL(input.request.url);
  const durationMs = Date.now() - input.startedAt;
  const status = input.response.status;
  const level = levelForStatus(status);
  const payload = {
    timestamp: new Date().toISOString(),
    event: "api_request",
    level,
    method: input.request.method,
    route: input.route,
    path: url.pathname,
    status,
    durationMs,
    requestId: input.requestId,
    userId: input.session?.user.id ?? null,
    roles: input.session?.effectiveRoles ?? [],
    tenant: toTenantLabel(input.session?.activeContext),
    ...sanitizeDetails(input.details),
  };

  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }

  return input.response;
};
