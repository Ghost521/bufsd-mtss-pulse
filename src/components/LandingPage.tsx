import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, Loader2, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { LANDING_COPY } from "../lib/landing-copy";
import {
  LANDING_COPY_EXPERIMENT_ID,
  getVariantFromSearch,
  isLandingCopyVariant,
  type LandingCopyVariant,
} from "../lib/landing-experiment";
import type { LandingExperimentEventName, LandingExperimentSection } from "../lib/schemas/landing-experiments";

type HealthResponse = {
  ok?: boolean;
  auth?: {
    workosEnabled?: boolean;
    signedIn?: boolean;
  };
};

type LandingExperimentResponse = {
  ok?: boolean;
  experimentId?: string;
  variant?: string;
  source?: "cookie" | "random" | "query_override";
};

type ViewState = "loading" | "ready" | "error";

export function LandingPage() {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [workosEnabled, setWorkosEnabled] = useState<boolean>(true);
  const [variant, setVariant] = useState<LandingCopyVariant>("control");
  const [experimentId, setExperimentId] = useState<string>(LANDING_COPY_EXPERIMENT_ID);
  const [experimentReady, setExperimentReady] = useState(false);
  const impressionTrackedRef = useRef(false);

  const loadHealth = useCallback(async () => {
    setViewState("loading");
    try {
      const response = await fetch("/api/health");
      if (!response.ok) throw new Error("Health check failed.");
      const payload = (await response.json()) as HealthResponse;
      const nextWorkosEnabled = Boolean(payload.auth?.workosEnabled);
      const signedIn = Boolean(payload.auth?.signedIn);
      setWorkosEnabled(nextWorkosEnabled);

      if (signedIn) {
        setViewState("ready");
        void navigate({ to: "/app", replace: true });
        return;
      }

      setViewState("ready");
    } catch {
      setWorkosEnabled(false);
      setViewState("error");
    }
  }, [navigate]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    let isMounted = true;

    const loadExperiment = async () => {
      const search = typeof window === "undefined" ? "" : window.location.search;
      const forcedVariant = getVariantFromSearch(search);
      try {
        const response = await fetch(`/api/experiments/landing${search}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Experiment route failed");
        const payload = (await response.json()) as LandingExperimentResponse;
        if (!isMounted) return;

        const serverVariant = isLandingCopyVariant(payload.variant) ? payload.variant : null;
        setVariant(forcedVariant ?? serverVariant ?? "control");
        if (typeof payload.experimentId === "string" && payload.experimentId.trim().length > 0) {
          setExperimentId(payload.experimentId);
        }
      } catch {
        if (!isMounted) return;
        setVariant(forcedVariant ?? "control");
      } finally {
        if (isMounted) setExperimentReady(true);
      }
    };

    void loadExperiment();
    return () => {
      isMounted = false;
    };
  }, []);

  const primaryHref = useMemo(
    () => (workosEnabled ? "/api/auth/login?returnTo=/app" : "/app"),
    [workosEnabled]
  );

  const helperText = workosEnabled ? "Secure authentication is managed by WorkOS." : "WorkOS is not configured. Local mode is active.";
  const buttonDisabled = viewState === "loading";
  const copy = LANDING_COPY[variant];

  const trackLandingEvent = useCallback(
    (event: LandingExperimentEventName, section: LandingExperimentSection, href?: string) => {
      if (!experimentReady) return;
      const payload = JSON.stringify({
        experimentId,
        variant,
        event,
        section,
        href,
        timestamp: new Date().toISOString(),
      });

      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/experiments/landing-events", blob);
        return;
      }

      void fetch("/api/experiments/landing-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Ignore telemetry failures.
      });
    },
    [experimentId, experimentReady, variant]
  );

  useEffect(() => {
    if (!experimentReady || impressionTrackedRef.current) return;
    impressionTrackedRef.current = true;
    trackLandingEvent("impression", "hero");
  }, [experimentReady, trackLandingEvent]);

  return (
    <main className="min-h-screen bg-[#f6f2e9] text-[#3f332d]">
      <header className="border-b border-[#ede4d5] bg-[#faf7f0]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b5e]" />
            <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[#6f6358]">{copy.brandName}</p>
          </div>
          <nav className="hidden items-center gap-8 text-xs font-semibold text-[#988b7e] md:flex">
            <a href="/" className="transition-colors hover:text-[#6b5b4e]">{copy.nav.home}</a>
            <a href="#features" className="transition-colors hover:text-[#6b5b4e]">{copy.nav.features}</a>
            <a href="#support" className="transition-colors hover:text-[#6b5b4e]">{copy.nav.support}</a>
            <a href="#how-it-works" className="transition-colors hover:text-[#6b5b4e]">{copy.nav.howItWorks}</a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href={copy.header.demoHref}
              onClick={() => trackLandingEvent("cta_header_demo_click", "header", copy.header.demoHref)}
              className="inline-flex items-center gap-2 rounded-full bg-[#79533f] px-4 py-2 text-xs font-bold text-[#fffaf3] transition-colors hover:bg-[#644432]"
            >
              {copy.header.demoCta}
            </a>
            <a
              href={buttonDisabled ? undefined : primaryHref}
              aria-disabled={buttonDisabled}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${
                buttonDisabled
                  ? "cursor-not-allowed border-[#d9cdbd] bg-[#f2e7d8] text-[#aa9886]"
                  : "border-[#cabaa7] bg-[#fffaf2] text-[#725744] transition-colors hover:bg-[#f2e7d9]"
              }`}
              onClick={() => {
                if (!buttonDisabled) trackLandingEvent("cta_primary_click", "header", primaryHref);
              }}
            >
              {buttonDisabled ? <Loader2 size={14} className="animate-spin" /> : null}
              {copy.header.loginCta}
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 pb-12 pt-10 md:px-8 md:pt-14">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.35fr]">
          <div>
            <p className="inline-flex rounded-full bg-[#f5e8c6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5a4720]">
              {copy.hero.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.03] text-[#58473b] md:text-6xl">
              {copy.hero.titleLine1}
              <span className="mt-1 block text-[#db6c4d]">{copy.hero.titleLine2}</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[#8a7c70]">
              {copy.hero.description}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href={buttonDisabled ? undefined : primaryHref}
                aria-disabled={buttonDisabled}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold ${
                  buttonDisabled
                    ? "cursor-not-allowed bg-[#e6d7c3] text-[#8c7a68]"
                    : "bg-[#ff8e73] text-[#fffaf3] transition hover:bg-[#f97657]"
                }`}
                onClick={() => {
                  if (!buttonDisabled) trackLandingEvent("cta_primary_click", "hero", primaryHref);
                }}
              >
                {buttonDisabled ? <Loader2 size={15} className="animate-spin" /> : null}
                {copy.hero.primaryCta}
                {buttonDisabled ? null : <ArrowRight size={15} />}
              </a>
              <a
                href="#support"
                className="rounded-full border border-[#d9c9b5] bg-[#f7ede0] px-5 py-2.5 text-sm font-semibold text-[#735744] transition hover:bg-[#f1e4d2]"
                onClick={() => trackLandingEvent("cta_secondary_click", "hero", "#support")}
              >
                {copy.hero.secondaryCta}
              </a>
            </div>
            <p className="mt-3 text-xs font-medium text-[#9d8f82]">{helperText}</p>
            {viewState === "error" ? (
              <button
                type="button"
                onClick={() => void loadHealth()}
                className="mt-4 rounded-full border border-[#d8cab7] px-4 py-2 text-xs font-semibold text-[#7f6f62] transition-colors hover:bg-[#efe4d3]"
              >
                Retry connection
              </button>
            ) : null}
          </div>

          <div className="relative">
            <div className="mx-auto w-full max-w-[760px] rounded-[26px] border border-[#d7cec1] bg-[#f0ebe2] p-4 shadow-[0_30px_60px_-28px_rgba(90,70,50,0.55)]">
              <div className="rounded-[20px] border border-[#3e3a37] bg-[#262321] p-3">
                <div className="rounded-[12px] border border-[#4f4a46] bg-[#1d1a19] p-3">
                  <div className="h-[260px] rounded-[8px] bg-[linear-gradient(160deg,#89a8bb_0%,#c7dbe6_40%,#a6c4b2_100%)] p-4 md:h-[300px]">
                    <div className="h-full rounded-md border border-white/35 bg-[radial-gradient(circle_at_75%_18%,rgba(255,255,255,0.6),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.03))]">
                      <div className="flex h-7 items-center gap-1.5 border-b border-white/30 px-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/75" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/55" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
                      </div>
                      <div className="grid h-[calc(100%-1.75rem)] grid-cols-[200px_1fr] gap-3 p-3">
                        <div className="rounded-md bg-white/30" />
                        <div className="grid gap-3">
                          <div className="rounded-md bg-white/35" />
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-md bg-white/28" />
                            <div className="rounded-md bg-white/23" />
                          </div>
                          <div className="rounded-md bg-white/32" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-auto h-3 w-[62%] rounded-full bg-[#dcd2c3] blur-sm" />
          </div>
        </div>
      </section>

      <section className="border-y border-[#ebe1d2] bg-[#f0e9dc] px-6 py-14 text-center">
        <p className="mx-auto max-w-3xl text-xl font-semibold italic text-[#8b7c70] md:text-2xl">
          {copy.socialProof.quote}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#9f9183]">
          {copy.socialProof.context}
        </p>
        <div className="mx-auto mt-5 h-0.5 w-12 bg-[#f29b84]" />
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#d19d8f]">{copy.visibility.label}</p>
            <h2 className="mt-3 text-3xl font-bold text-[#5b4a3d]">{copy.visibility.title}</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#8f7f72]">
              {copy.visibility.body}
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-[#7f7064]">
              {copy.visibility.bullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f0937c]" /> {bullet}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">
            <div className="relative h-[280px] w-[230px] rotate-[4deg] rounded-xl bg-[#3f6659] p-5 shadow-[0_20px_35px_-18px_rgba(36,51,45,0.65)]">
              <div className="absolute left-5 top-5 h-6 w-6 rounded-full border border-[#89aea1]" />
              <p className="mt-12 text-xs uppercase tracking-[0.14em] text-[#95b2a7]">{copy.visibility.cardLabel}</p>
              <p className="mt-2 text-3xl font-bold text-[#dcebe5]">{copy.visibility.cardTitle}</p>
              <p className="mt-8 text-xs leading-relaxed text-[#bdd1c9]">{copy.visibility.cardBody}</p>
            </div>
          </div>
        </div>

        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="order-2 flex justify-center lg:order-1">
            <div className="relative h-[280px] w-[230px] -rotate-[5deg] rounded-xl bg-[#1f6d6a] p-5 shadow-[0_20px_35px_-18px_rgba(19,58,56,0.65)]">
              <div className="absolute right-5 top-5 h-6 w-6 rounded-full border border-[#88c0be]" />
              <p className="mt-12 text-xs uppercase tracking-[0.14em] text-[#9ed2cf]">{copy.collaboration.cardLabel}</p>
              <p className="mt-2 text-3xl font-bold text-[#d7f0ef]">{copy.collaboration.cardTitle}</p>
              <p className="mt-8 text-xs leading-relaxed text-[#bae2e0]">{copy.collaboration.cardBody}</p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#d19d8f]">{copy.collaboration.label}</p>
            <h3 className="mt-3 text-3xl font-bold text-[#5b4a3d]">{copy.collaboration.title}</h3>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#8f7f72]">
              {copy.collaboration.body}
            </p>
            <div className="mt-5 rounded-xl border border-[#eadfce] bg-[#f9f4ea] p-4">
              <p className="text-xs text-[#968679]">{copy.collaboration.noteLabel}</p>
              <p className="mt-1 text-sm text-[#6d5f53]">{copy.collaboration.noteText}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="support" className="border-y border-[#ece2d4] bg-[#faf7f0] px-5 py-16 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.11em] text-[#c4b2a5]">{copy.capabilities.label}</p>
          <h2 className="mt-2 text-center text-3xl font-bold text-[#56463a]">{copy.capabilities.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-[#8f7f72]">
            {copy.capabilities.body}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-[#efdccc] bg-[#fff8ee] p-5">
              <Activity className="text-[#f08b6f]" size={18} />
              <h3 className="mt-3 text-lg font-bold text-[#5a4a3f]">{copy.capabilities.cards[0].title}</h3>
              <p className="mt-2 text-sm text-[#8e7d6f]">{copy.capabilities.cards[0].body}</p>
            </article>
            <article className="rounded-2xl border border-[#efe1cd] bg-[#fff9ef] p-5">
              <MessageSquare className="text-[#d8a24f]" size={18} />
              <h3 className="mt-3 text-lg font-bold text-[#5a4a3f]">{copy.capabilities.cards[1].title}</h3>
              <p className="mt-2 text-sm text-[#8e7d6f]">{copy.capabilities.cards[1].body}</p>
            </article>
            <article className="rounded-2xl border border-[#e8e8d4] bg-[#fcfbf1] p-5">
              <Users className="text-[#8fad61]" size={18} />
              <h3 className="mt-3 text-lg font-bold text-[#5a4a3f]">{copy.capabilities.cards[2].title}</h3>
              <p className="mt-2 text-sm text-[#8e7d6f]">{copy.capabilities.cards[2].body}</p>
            </article>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-5 py-14 md:px-8">
        <div className="mx-auto w-full max-w-6xl rounded-[22px] bg-[#76523f] px-6 py-9 text-center text-[#fff8f2] md:px-10">
          <p className="text-xs uppercase tracking-[0.11em] text-[#f3d8c8]">{copy.finalCta.label}</p>
          <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{copy.finalCta.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[#f0e1d6]">{copy.finalCta.body}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href={buttonDisabled ? undefined : primaryHref}
              aria-disabled={buttonDisabled}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold ${
                buttonDisabled
                  ? "cursor-not-allowed bg-[#b99784] text-[#f8ece4]"
                  : "bg-[#ff8b6f] text-white transition hover:bg-[#ff7a5c]"
              }`}
              onClick={() => {
                if (!buttonDisabled) trackLandingEvent("cta_primary_click", "final", primaryHref);
              }}
            >
              {buttonDisabled ? <Loader2 size={15} className="animate-spin" /> : null}
              {copy.finalCta.primaryCta}
              {buttonDisabled ? null : <ArrowRight size={15} />}
            </a>
            <a
              href="#support"
              className="rounded-full border border-[#f0d4c4] bg-[#f5e3d8] px-5 py-2.5 text-sm font-semibold text-[#6a4835] hover:bg-[#f0d5c5]"
              onClick={() => trackLandingEvent("cta_secondary_click", "final", "#support")}
            >
              {copy.finalCta.secondaryCta}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#ebe1d2] bg-[#faf7f0] px-5 py-10 text-[#7f7063] md:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b5e]" />
              <p className="text-xs font-semibold uppercase tracking-[0.11em]">{copy.brandName}</p>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#9a8b7f]">{copy.footer.body}</p>
            <p className="mt-4 text-xs text-[#b4a79b]">{helperText}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#a19285]">{copy.footer.productTitle}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#features" className="hover:text-[#66574b]">{copy.footer.productLinks[0]}</a></li>
              <li><a href="#support" className="hover:text-[#66574b]">{copy.footer.productLinks[1]}</a></li>
              <li><a href="/app" className="hover:text-[#66574b]">{copy.footer.productLinks[2]}</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#a19285]">{copy.footer.resourcesTitle}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="/query-health" className="hover:text-[#66574b]">{copy.footer.resourcesLinks[0]}</a></li>
              <li><a href="/roster-table" className="hover:text-[#66574b]">{copy.footer.resourcesLinks[1]}</a></li>
              <li><a href="/app/reports" className="hover:text-[#66574b]">{copy.footer.resourcesLinks[2]}</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#a19285]">{copy.footer.conversionTitle}</p>
            <p className="mt-3 text-sm text-[#988a7f]">{copy.footer.conversionBody}</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="email"
                value=""
                readOnly
                placeholder={copy.footer.emailPlaceholder}
                className="w-full rounded-full border border-[#dfd3c2] bg-[#fffaf2] px-3 py-2 text-xs text-[#6f6258] placeholder:text-[#ac9f93]"
              />
              <a
                href={buttonDisabled ? undefined : primaryHref}
                aria-disabled={buttonDisabled}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-xs font-bold ${
                  buttonDisabled
                    ? "cursor-not-allowed bg-[#d4c3ae] text-[#8f7e6f]"
                    : "bg-[#7a553f] text-[#fff9f3] hover:bg-[#644432]"
                }`}
                onClick={() => {
                  if (!buttonDisabled) trackLandingEvent("cta_footer_submit_click", "footer", primaryHref);
                }}
              >
                {buttonDisabled ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                {copy.footer.submitCta}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
