import { HeadContent, Link, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import type { ReactNode } from "react";

export const Route = createRootRouteWithContext<Record<string, never>>()({
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
  notFoundComponent: RootNotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[720px] items-center justify-center p-6">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Page Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">The page you requested does not exist in this workspace.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/app"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            Go to Workspace
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
