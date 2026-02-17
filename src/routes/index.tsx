import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/app/$role",
      params: { role: "principal" },
    });
  },
  component: HomeRoute,
});

function HomeRoute() {
  return null;
}
