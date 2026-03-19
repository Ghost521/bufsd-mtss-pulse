import { redirect } from "@tanstack/react-router";
import {
  buildLoginRedirectHref,
  getDevRoleOverrideFromStorage,
  getRouteAuthStatus,
  resolveRouteUserRole,
  shouldBypassRouteAuth,
  type RouteAuthStatus,
} from "./route-auth";
import type { UserRole } from "./user-role";
import { buildWorkspacePath, normalizePageForRole, type WorkspacePageId } from "./workspaceRoutes";

export type WorkspaceRouteAuth = {
  auth: RouteAuthStatus;
  activeRole: UserRole;
};

export async function requireWorkspaceRouteAuth(
  locationHref: string,
): Promise<WorkspaceRouteAuth | null> {
  if (shouldBypassRouteAuth(locationHref)) return null;

  const auth = await getRouteAuthStatus();
  if (!auth.signedIn) {
    if (auth.workosEnabled) {
      const forceReauth = auth.reason === "IDLE_TIMEOUT";
      throw redirect({
        href: buildLoginRedirectHref(locationHref, forceReauth),
      });
    }

    throw redirect({
      to: "/",
    });
  }

  const activeRole = resolveRouteUserRole(auth, {
    devRoleOverride: getDevRoleOverrideFromStorage(),
  });

  if (!activeRole) {
    throw redirect({
      to: "/",
    });
  }

  return {
    auth,
    activeRole,
  };
}

export function enforceWorkspacePageAccess(activeRole: UserRole, page: WorkspacePageId): void {
  const normalizedPage = normalizePageForRole(activeRole, page);
  if (normalizedPage !== page) {
    throw redirect({
      href: buildWorkspacePath(normalizedPage),
    });
  }
}
