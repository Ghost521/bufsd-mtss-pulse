import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "../lib/query-client";
import type { WorkspaceRouteAuth } from "../lib/workspace-route-auth";

type AppRouteProps = {
  initialRouteAuth?: WorkspaceRouteAuth | null;
};

export function AppRoute({ initialRouteAuth = null }: AppRouteProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <App initialRouteAuth={initialRouteAuth} />
    </QueryClientProvider>
  );
}
