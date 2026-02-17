import { createFileRoute, redirect } from "@tanstack/react-router";
import App from "../components/App";
import { isPageAllowedForRole, roleToSlug, slugToPage, slugToRole } from "../lib/workspaceRoutes";

export const Route = createFileRoute("/app/$role/$page")({
  beforeLoad: ({ params }) => {
    const role = slugToRole(params.role);
    if (!role) {
      throw redirect({
        to: "/app/$role",
        params: { role: "principal" },
      });
    }

    const page = slugToPage(params.page);
    if (!page || !isPageAllowedForRole(role, page)) {
      throw redirect({
        to: "/app/$role",
        params: { role: roleToSlug(role) },
      });
    }
  },
  component: WorkspaceRolePageRoute,
});

function WorkspaceRolePageRoute() {
  return <App />;
}
