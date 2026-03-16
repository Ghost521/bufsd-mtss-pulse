import { createLazyFileRoute } from "@tanstack/react-router";
import { AppRoute } from "../components/AppRoute";

export const Route = createLazyFileRoute("/app")({
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const initialRouteAuth = Route.useLoaderData();
  return <AppRoute initialRouteAuth={initialRouteAuth} />;
}
