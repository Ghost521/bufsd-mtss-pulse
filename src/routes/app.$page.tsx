import { createFileRoute, redirect } from "@tanstack/react-router";
import { loadWorkspaceRouteAuth, loadWorkspaceRoutes } from "../lib/route-module-loaders";

export const Route = createFileRoute("/app/$page")({
  beforeLoad: async ({ location, params }) => {
    const { slugToPage } = await loadWorkspaceRoutes();
    const page = slugToPage(params.page);
    if (!page) {
      throw redirect({
        to: "/app",
      });
    }

    const { enforceWorkspacePageAccess, requireWorkspaceRouteAuth } = await loadWorkspaceRouteAuth();
    const routeAuth = await requireWorkspaceRouteAuth(location.href);
    if (routeAuth) {
      enforceWorkspacePageAccess(routeAuth.activeRole, page);
    }
  },
  loader: async ({ location }) => {
    const { requireWorkspaceRouteAuth } = await loadWorkspaceRouteAuth();
    return requireWorkspaceRouteAuth(location.href);
  },
});
