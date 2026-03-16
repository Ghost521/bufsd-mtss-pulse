import { createLazyFileRoute } from "@tanstack/react-router";
import { AppRoute } from "../components/AppRoute";

export const Route = createLazyFileRoute("/app/$page")({
  component: WorkspacePageRoute,
});

function WorkspacePageRoute() {
  const initialRouteAuth = Route.useLoaderData();
  return <AppRoute initialRouteAuth={initialRouteAuth} />;
}
