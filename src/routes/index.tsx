import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/app",
    });
  },
  component: HomeRoute,
});

function HomeRoute() {
  return null;
}
