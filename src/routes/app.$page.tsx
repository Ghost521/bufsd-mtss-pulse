import { createFileRoute, redirect } from "@tanstack/react-router";
import App from "../components/App";
import { slugToPage } from "../lib/workspaceRoutes";

export const Route = createFileRoute("/app/$page")({
  beforeLoad: ({ params }) => {
    const page = slugToPage(params.page);
    if (!page) {
      throw redirect({
        to: "/app",
      });
    }
  },
  component: WorkspacePageRoute,
});

function WorkspacePageRoute() {
  return <App />;
}
