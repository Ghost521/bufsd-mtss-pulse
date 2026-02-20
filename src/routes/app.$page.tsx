import { createFileRoute, redirect } from "@tanstack/react-router";
import App from "../components/App";
import {
  buildLoginRedirectHref,
  getDevRoleOverrideFromStorage,
  getRouteAuthStatus,
  resolveRouteUserRole,
  shouldBypassRouteAuth,
} from "../lib/route-auth";
import { buildWorkspacePath, normalizePageForRole, slugToPage } from "../lib/workspaceRoutes";

export const Route = createFileRoute("/app/$page")({
  beforeLoad: async ({ location, params }) => {
    const page = slugToPage(params.page);
    if (!page) {
      throw redirect({
        to: "/app",
      });
    }

    if (shouldBypassRouteAuth(location.href)) return;

    const auth = await getRouteAuthStatus();
    if (!auth.signedIn) {
      if (auth.workosEnabled) {
        const forceReauth = auth.reason === "IDLE_TIMEOUT";
        throw redirect({
          href: buildLoginRedirectHref(location.href, forceReauth),
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
        to: "/app",
      });
    }

    const normalizedPage = normalizePageForRole(activeRole, page);
    if (normalizedPage !== page) {
      throw redirect({
        to: buildWorkspacePath(normalizedPage),
      });
    }
  },
  component: WorkspacePageRoute,
});

function WorkspacePageRoute() {
  return <App />;
}
