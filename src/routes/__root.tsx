import { HeadContent, Link, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import appCss from "../styles.css?url";
import type { AppRouterContext } from "../lib/query-client";
import type { ReactNode } from "react";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BUFSD MTSS Pulse" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Platform</p>
                <p className="text-xs font-semibold text-slate-600">Navigation</p>
              </div>
              <div className="flex items-center gap-2">
                <NavLink to="/app/principal">MTSS Workspace</NavLink>
                <NavLink to="/query-health">Platform Health</NavLink>
                <NavLink to="/roster-table">Student Roster</NavLink>
              </div>
            </div>
          </div>
        </nav>
        {children}
        <TanStackRouterDevtools />
        <Scripts />
      </body>
    </html>
  );
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      activeProps={{
        className: "rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700",
      }}
    >
      {children}
    </Link>
  );
}

