import { createFileRoute, redirect } from "@tanstack/react-router";
import App from "../components/App";
import { slugToRole } from "../lib/workspaceRoutes";

export const Route = createFileRoute("/app/$role")({
  beforeLoad: ({ params }) => {
    const role = slugToRole(params.role);
    if (!role) {
      throw redirect({
        to: "/app/$role",
        params: { role: "principal" },
      });
    }
  },
  component: WorkspaceRoleRoute,
});

function WorkspaceRoleRoute() {
  return <App />;
}
