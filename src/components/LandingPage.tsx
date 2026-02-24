import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, Loader2, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { applyTenantBrandingTheme } from "../lib/branding-theme";
import { LANDING_COPY } from "../lib/landing-copy";
import { DEFAULT_DISTRICT_BRANDING, districtBrandingEditableSchema } from "../lib/schemas/branding";
import {
  LANDING_COPY_EXPERIMENT_ID,
  getVariantFromSearch,
  isLandingCopyVariant,
  type LandingCopyVariant,
} from "../lib/landing-experiment";
import type { LandingExperimentEventName, LandingExperimentSection } from "../lib/schemas/landing-experiments";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

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
  const [mascotName, setMascotName] = useState(DEFAULT_DISTRICT_BRANDING.mascotName);
  const impressionTrackedRef = useRef(false);
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    // High-end Hero Entry Sequence
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    
    tl.fromTo(".hero-eyebrow", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 1.2, delay: 0.2 })
      .fromTo(".hero-title", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.5 }, "-=0.8")
      .fromTo(".hero-desc", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2 }, "-=1.0")
      .fromTo(".hero-actions", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2 }, "-=1.0")
      .fromTo(".hero-image", { opacity: 0, scale: 0.95, filter: "blur(4px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 2, ease: "power2.out" }, "-=1.2");

    // Scroll triggered exhibition reveals
    gsap.utils.toArray('.gsap-reveal').forEach((elem: any) => {
      gsap.fromTo(elem, 
        { autoAlpha: 0, y: 40 }, 
        { 
          autoAlpha: 1, 
          y: 0, 
          duration: 1.2, 
          ease: "expo.out",
          scrollTrigger: {
            trigger: elem,
            start: "top 85%",
            toggleActions: "play none none reverse"
          }
        }
      );
    });
  }, { scope: containerRef });

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    let next = DEFAULT_DISTRICT_BRANDING;
    try {
      const raw = window.localStorage.getItem("mtss_branding_snapshot");
      if (raw) {
        const parsed = districtBrandingEditableSchema.safeParse(JSON.parse(raw) as unknown);
        if (parsed.success) {
          next = parsed.data;
        }
      }
    } catch {
      // Ignore malformed snapshot payloads.
    }

    const applied = applyTenantBrandingTheme(next);
    setMascotName(applied.mascotName);
  }, []);

  const primaryHref = useMemo(
    () => (workosEnabled ? "/api/auth/login?returnTo=/app" : "/app"),
    [workosEnabled]
  );

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
    <main ref={containerRef} className="luxury-main overflow-x-hidden">
      {/* Avant-Garde Navigation */}
      <header className="fixed top-0 left-0 w-full z-[101] mix-blend-difference py-8">
        <div className="luxury-container flex items-center justify-between">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3">
              <span className="h-[1px] w-8 bg-white" />
              <p className="luxury-eyebrow !text-white !text-[9px] !tracking-[0.5em]">{copy.brandName}</p>
            </div>
            <nav className="hidden lg:flex items-center gap-12">
              <a href="/" className="luxury-nav-link !text-white !text-[10px] opacity-60 hover:opacity-100 transition-opacity">{copy.nav.home}</a>
              <a href="#features" className="luxury-nav-link !text-white !text-[10px] opacity-60 hover:opacity-100 transition-opacity">{copy.nav.features}</a>
              <a href="#how-it-works" className="luxury-nav-link !text-white !text-[10px] opacity-60 hover:opacity-100 transition-opacity">{copy.nav.howItWorks}</a>
            </nav>
          </div>
          <a
            href={buttonDisabled ? undefined : primaryHref}
            className="group flex items-center gap-4 text-white !text-[10px] font-bold uppercase tracking-[0.3em]"
          >
            <span className="opacity-60 group-hover:opacity-100 transition-opacity">{copy.header.loginCta}</span>
            <div className="h-10 w-10 flex items-center justify-center border border-white/20 rounded-full group-hover:bg-white group-hover:text-black transition-all">
               {buttonDisabled ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            </div>
          </a>
        </div>
      </header>

      {/* The Cover Spread */}
      <section className="relative min-h-screen flex flex-col justify-center pt-32 pb-20">
        <div className="luxury-container grid lg:grid-cols-[1.5fr_1fr] gap-20 items-end relative z-10">
          <div>
            <div className="hero-eyebrow">
              <p className="luxury-eyebrow mb-12 flex items-center gap-4">
                 <span className="opacity-30">SECTION 01</span>
                 <span className="h-px w-12 bg-[var(--luxury-accent)]" />
                 {copy.hero.eyebrow}
              </p>
            </div>
            <h1 className="luxury-h1 text-[#121212] uppercase hero-title">
              {copy.hero.titleLine1}
              <span className="block italic text-[var(--luxury-accent)] mt-4 font-light">{copy.hero.titleLine2}</span>
            </h1>
            
            <div className="mt-16 hero-desc">
              <p className="luxury-body-large max-w-xl text-[#444]">
                {copy.hero.description}
              </p>
            </div>
            <div className="mt-16 flex items-center gap-10 hero-actions">
              <a
                href={buttonDisabled ? undefined : primaryHref}
                className="luxury-btn luxury-btn-ink"
                onClick={() => !buttonDisabled && trackLandingEvent("cta_primary_click", "hero", primaryHref)}
              >
                {copy.hero.primaryCta}
              </a>
              <a
                href="#support"
                className="group flex items-center gap-3 luxury-nav-link !text-[11px] !text-black"
                onClick={() => trackLandingEvent("cta_secondary_click", "hero", "#support")}
              >
                {copy.hero.secondaryCta}
                <div className="h-px w-6 bg-black group-hover:w-12 transition-all" />
              </a>
            </div>
          </div>

          <div className="hidden lg:block relative hero-image">
             <div className="aspect-[3/4] bg-[var(--luxury-ivy)] overflow-hidden relative group">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center grayscale opacity-40 mix-blend-luminosity group-hover:scale-105 transition-transform duration-[2s]" />
                <div className="absolute inset-0 p-12 flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                      <div className="luxury-h3 text-white leading-none">IVY<br/>PRISM</div>
                      <div className="luxury-sidenote !text-white/40 !mt-0">EST. 2026</div>
                   </div>
                   <div className="text-[120px] font-black text-white/5 leading-none select-none">PULSE</div>
                </div>
             </div>
             {/* Float Markings */}
             <div className="absolute -left-12 bottom-12 luxury-sidenote text-[9px] !tracking-[0.8em]">MTSS OPERATIONS</div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-[5vw] flex items-center gap-4 gsap-reveal">
           <div className="h-12 w-px bg-[var(--luxury-border-strong)]" />
           <p className="luxury-sidenote !writing-mode-horizontal-tb !tracking-widest !text-[8px]">SCROLL TO EXPLORE</p>
        </div>
      </section>

      {/* The Manifesto Spread */}
      <section className="bg-[var(--luxury-ink)] py-40 overflow-hidden relative">
        <div className="luxury-container relative z-10">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-8 lg:col-start-3 text-center gsap-reveal">
               <div className="h-px w-24 bg-[var(--luxury-accent)] mx-auto mb-16 opacity-50" />
               <p className="luxury-quote !text-white !text-4xl lg:!text-6xl !not-italic !font-extralight !leading-[1.1] !tracking-tight">
                  {copy.socialProof.quote}
               </p>
               <p className="luxury-eyebrow !text-white/40 mt-16 max-w-xl mx-auto !leading-loose">
                  {copy.socialProof.context}
               </p>
            </div>
          </div>
        </div>
        {/* Large Decorative Text */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 text-[30vw] font-black text-white/[0.02] pointer-events-none select-none leading-none">
           EXCELLENCE
        </div>
      </section>

      {/* Feature Exhibition */}
      <section id="features" className="py-40 space-y-64">
        {/* Spread 01 */}
        <div className="luxury-container">
          <div className="grid lg:grid-cols-2 gap-32 items-center">
            <div className="relative gsap-reveal">
               <div className="aspect-[4/5] bg-neutral-100 border border-[var(--luxury-border)] p-16 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,142,79,0.05),transparent_70%)]" />
                  <div className="relative text-center">
                     <Users size={80} strokeWidth={0.5} className="mx-auto mb-12 text-[var(--luxury-accent)]" />
                     <p className="luxury-h3 mb-6 uppercase tracking-[0.2em]">{copy.visibility.cardTitle}</p>
                     <p className="luxury-body max-w-xs mx-auto opacity-60">{copy.visibility.cardBody}</p>
                  </div>
               </div>
               <div className="absolute -right-8 top-1/2 -translate-y-1/2 luxury-sidenote">PLATE NO. 01</div>
            </div>
            <div className="gsap-reveal">
              <p className="luxury-eyebrow mb-8 flex items-center gap-4">
                 <span className="opacity-30">01</span>
                 {copy.visibility.label}
              </p>
              <h2 className="luxury-h2 mb-12">{copy.visibility.title}</h2>
              <p className="luxury-body-large mb-12 !text-[#666]">
                {copy.visibility.body}
              </p>
              <ul className="space-y-8">
                {copy.visibility.bullets.map((bullet, idx) => (
                  <li key={bullet} className="flex items-center gap-6 group">
                    <span className="text-[10px] font-bold opacity-20 group-hover:opacity-100 transition-opacity">0{idx + 1}</span>
                    <span className="h-[1px] w-8 bg-[var(--luxury-border-strong)]" />
                    <span className="luxury-nav-link !text-black !tracking-widest">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Spread 02 - Asymmetrical Shift */}
        <div className="luxury-container">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 lg:col-start-2 order-2 lg:order-1 gsap-reveal">
              <p className="luxury-eyebrow mb-8 flex items-center gap-4">
                 <span className="opacity-30">02</span>
                 {copy.collaboration.label}
              </p>
              <h2 className="luxury-h2 mb-12">{copy.collaboration.title}</h2>
              <p className="luxury-body-large mb-16 !text-[#666]">
                {copy.collaboration.body}
              </p>
              <div className="p-10 border border-[var(--luxury-border-strong)] relative">
                <div className="absolute -top-3 -left-3 h-6 w-6 border-t border-l border-[var(--luxury-accent)]" />
                <p className="luxury-subheading text-[9px] mb-4 opacity-40 uppercase tracking-[0.3em]">{copy.collaboration.noteLabel}</p>
                <p className="luxury-quote !text-2xl !leading-tight !not-italic !font-light">{copy.collaboration.noteText}</p>
              </div>
            </div>
            <div className="lg:col-span-5 lg:col-start-8 order-1 lg:order-2 gsap-reveal">
               <div className="aspect-square bg-[var(--luxury-ivy)] flex items-center justify-center relative p-20">
                  <div className="h-full w-full border border-white/10 flex items-center justify-center">
                     <div className="text-center text-white/90">
                        <p className="luxury-h3 mb-4">{copy.collaboration.cardTitle}</p>
                        <div className="h-px w-12 bg-[var(--luxury-accent)] mx-auto mb-6" />
                        <p className="luxury-body !text-white/40 !text-[11px] max-w-[200px] uppercase tracking-widest">{copy.collaboration.cardBody}</p>
                     </div>
                  </div>
                  <div className="absolute -left-8 bottom-0 luxury-sidenote !text-[8px]">ARCHITECTURE OF COLLABORATION</div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid of Precision */}
      <div className="luxury-section-divider" />
      <section id="support" className="py-40">
        <div className="luxury-container">
          <div className="flex flex-col lg:flex-row justify-between items-end mb-32 gap-10 gsap-reveal">
            <div className="max-w-2xl">
              <p className="luxury-eyebrow mb-8">{copy.capabilities.label}</p>
              <h2 className="luxury-h2">{copy.capabilities.title}</h2>
            </div>
            <p className="luxury-body max-w-xs opacity-50 uppercase tracking-[0.2em] !text-[10px] !leading-loose">
               {copy.capabilities.body}
            </p>
          </div>

          <div className="grid md:grid-cols-3 border-t border-[var(--luxury-border-strong)]">
            {copy.capabilities.cards.map((card, idx) => (
              <article key={card.title} className={`p-16 border-b border-[var(--luxury-border-strong)] ${idx < 2 ? 'md:border-r' : ''} group hover:bg-[var(--luxury-ink)] transition-colors duration-700 gsap-reveal`}>
                <p className="text-[10px] font-bold opacity-20 group-hover:opacity-100 transition-opacity mb-20 text-[var(--luxury-accent)]">0{idx + 1}</p>
                <h3 className="luxury-h3 mb-8 group-hover:text-white transition-colors">{card.title}</h3>
                <p className="luxury-body !text-[11px] uppercase tracking-widest !leading-loose group-hover:text-white/50 transition-colors">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Excellence */}
      <section id="how-it-works" className="py-64 relative bg-[#0a0a0a]">
        <div className="luxury-container relative z-10 text-center gsap-reveal">
          <p className="luxury-eyebrow !text-[var(--luxury-accent)] mb-12">{copy.finalCta.label}</p>
          <h2 className="luxury-h1 !text-white mb-20 uppercase">
             {copy.finalCta.title.split(' ').map((word, i) => (
                <span key={i} className={i % 2 === 1 ? 'italic font-light' : ''}>{word} </span>
             ))}
          </h2>
          <div className="flex flex-wrap justify-center gap-12 items-center">
            <a
              href={buttonDisabled ? undefined : primaryHref}
              className="luxury-btn luxury-btn-ink !bg-[var(--luxury-accent)] !border-[var(--luxury-accent)]"
              onClick={() => !buttonDisabled && trackLandingEvent("cta_primary_click", "final", primaryHref)}
            >
              {copy.finalCta.primaryCta}
            </a>
            <a
              href="#support"
              className="luxury-nav-link !text-white/60 hover:!text-white !tracking-[0.4em]"
              onClick={() => trackLandingEvent("cta_secondary_click", "final", "#support")}
            >
              {copy.finalCta.secondaryCta}
            </a>
          </div>
        </div>
        {/* Abstract Background Visual */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
           <div className="h-full w-full bg-[radial-gradient(circle_at_50%_50%,#B88E4F_0%,transparent_70%)]" />
        </div>
      </section>

      {/* Editorial Footer */}
      <footer className="py-32 bg-[var(--luxury-ivory)] border-t border-[var(--luxury-border-strong)] relative overflow-hidden">
        <div className="luxury-container gsap-reveal">
          <div className="grid lg:grid-cols-4 gap-20">
            <div>
               <div className="flex items-center gap-4 mb-12">
                  <div className="h-2 w-2 bg-[var(--luxury-accent)] rounded-full" />
                  <p className="luxury-eyebrow !text-black !text-[10px] !tracking-[0.6em]">{copy.brandName}</p>
               </div>
               <p className="luxury-body !text-[10px] uppercase tracking-[0.25em] !leading-loose opacity-60">
                  {copy.footer.body}
               </p>
            </div>
            
            <div className="lg:pl-20">
               <p className="luxury-sidenote !writing-mode-horizontal-tb mb-10">COLLECTIONS</p>
               <ul className="space-y-6">
                 {copy.footer.productLinks.map((link, idx) => (
                   <li key={link}><a href={`#${link.toLowerCase()}`} className="luxury-nav-link !text-[9px] hover:!text-[var(--luxury-accent)]">{link}</a></li>
                 ))}
               </ul>
            </div>

            <div>
               <p className="luxury-sidenote !writing-mode-horizontal-tb mb-10">ARCHIVE</p>
               <ul className="space-y-6">
                 {copy.footer.resourcesLinks.map((link) => (
                   <li key={link}><a href="#" className="luxury-nav-link !text-[9px] hover:!text-[var(--luxury-accent)]">{link}</a></li>
                 ))}
               </ul>
            </div>

            <div className="relative">
               <div className="absolute -top-10 -right-10 text-[120px] font-black text-black/[0.03] select-none">PULSE</div>
               <p className="luxury-sidenote !writing-mode-horizontal-tb mb-8">CORRESPONDENCE</p>
               <div className="flex items-center gap-4 border-b border-[var(--luxury-border-strong)] py-4">
                  <input
                    type="email"
                    readOnly
                    placeholder={copy.footer.emailPlaceholder}
                    className="bg-transparent text-[10px] uppercase tracking-widest outline-none w-full luxury-body !text-black placeholder:opacity-30"
                  />
                  <button 
                    className="luxury-nav-link !text-[10px] !text-[var(--luxury-accent)]"
                    onClick={() => trackLandingEvent("cta_footer_submit_click", "footer", primaryHref)}
                  >
                    SUBMIT
                  </button>
               </div>
            </div>
          </div>
          
          <div className="mt-32 pt-12 border-t border-[var(--luxury-border-strong)] flex justify-between items-center luxury-sidenote !writing-mode-horizontal-tb !text-[7px]">
             <p>© 2026 BUFSD MTSS PULSE. OPERATIONAL EXCELLENCE.</p>
             <p>A DIGITAL PUBLICATION OF MTSS OPERATIONS.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
