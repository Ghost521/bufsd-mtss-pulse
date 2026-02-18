import { createFileRoute, redirect } from "@tanstack/react-router";
import App from "../components/App";
import { buildLoginRedirectHref, getRouteAuthStatus } from "../lib/route-auth";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const auth = await getRouteAuthStatus();
    if (auth.signedIn) return;

    if (auth.workosEnabled) {
      throw redirect({
        href: buildLoginRedirectHref(location.href),
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
