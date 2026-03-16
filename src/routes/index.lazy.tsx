import { lazy, Suspense } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";

const LandingPage = lazy(() =>
  import("../components/LandingPage").then((module) => ({ default: module.LandingPage }))
);

export const Route = createLazyFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <Suspense fallback={<HomeRouteFallback />}>
      <LandingPage />
    </Suspense>
  );
}

function HomeRouteFallback() {
  return (
    <main className="min-h-screen bg-[var(--tenant-color-surface,#faf7f0)] text-[#3f332d]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-10 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-40 animate-pulse rounded-full bg-[#e7ddcf]" />
          <div className="flex items-center gap-2">
            <div className="h-11 w-28 animate-pulse rounded-full bg-[#e7ddcf]" />
            <div className="h-11 w-28 animate-pulse rounded-full bg-[#e7ddcf]" />
          </div>
        </div>
        <div className="grid flex-1 gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-5 pt-8">
            <div className="h-4 w-32 animate-pulse rounded-full bg-[#e7ddcf]" />
            <div className="space-y-3">
              <div className="h-14 w-full max-w-2xl animate-pulse rounded-3xl bg-[#ddd0c0]" />
              <div className="h-14 w-5/6 max-w-xl animate-pulse rounded-3xl bg-[#e7ddcf]" />
            </div>
            <div className="h-5 w-full max-w-xl animate-pulse rounded-full bg-[#efe7db]" />
            <div className="flex gap-3 pt-3">
              <div className="h-12 w-36 animate-pulse rounded-full bg-[#d8c4ae]" />
              <div className="h-12 w-32 animate-pulse rounded-full bg-[#e7ddcf]" />
            </div>
          </section>
          <aside className="rounded-[2rem] border border-[#eadfce] bg-[#fffaf2] p-6 shadow-sm">
            <div className="space-y-4">
              <div className="h-6 w-32 animate-pulse rounded-full bg-[#e7ddcf]" />
              <div className="space-y-3">
                <div className="h-20 animate-pulse rounded-3xl bg-[#f2e8da]" />
                <div className="h-20 animate-pulse rounded-3xl bg-[#f2e8da]" />
                <div className="h-20 animate-pulse rounded-3xl bg-[#f2e8da]" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
