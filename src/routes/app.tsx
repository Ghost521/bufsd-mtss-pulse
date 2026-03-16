import { createFileRoute } from "@tanstack/react-router";
import { loadWorkspaceRouteAuth } from "../lib/route-module-loaders";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const { requireWorkspaceRouteAuth } = await loadWorkspaceRouteAuth();
    await requireWorkspaceRouteAuth(location.href);
  },
  loader: async ({ location }) => {
    const { requireWorkspaceRouteAuth } = await loadWorkspaceRouteAuth();
    return requireWorkspaceRouteAuth(location.href);
  },
});
