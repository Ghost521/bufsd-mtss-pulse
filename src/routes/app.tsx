import { createFileRoute, redirect } from "@tanstack/react-router";
import App from "../components/App";
import {
  buildLoginRedirectHref,
  getDevRoleOverrideFromStorage,
  getRouteAuthStatus,
  resolveRouteUserRole,
  shouldBypassRouteAuth,
} from "../lib/route-auth";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    if (shouldBypassRouteAuth(location.href)) return;

    const auth = await getRouteAuthStatus();
    if (auth.signedIn) {
      const activeRole = resolveRouteUserRole(auth, {
        devRoleOverride: getDevRoleOverrideFromStorage(),
      });
      if (activeRole) return;

      throw redirect({
        to: "/",
      });
    }

    if (auth.workosEnabled) {
      const forceReauth = auth.reason === "IDLE_TIMEOUT";
      throw redirect({
        href: buildLoginRedirectHref(location.href, forceReauth),
      });
    }

    throw redirect({
      to: "/",
    });
  },
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  return <App />;
}
