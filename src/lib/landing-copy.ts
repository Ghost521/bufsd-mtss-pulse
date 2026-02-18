import type { LandingCopyVariant } from "./landing-experiment";

export type LandingCopyContent = {
  brandName: string;
  nav: {
    home: string;
    features: string;
    support: string;
    howItWorks: string;
  };
  header: {
    demoCta: string;
    demoHref: string;
    loginCta: string;
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  };
  socialProof: {
    quote: string;
    context: string;
  };
  visibility: {
    label: string;
    title: string;
    body: string;
    bullets: [string, string, string];
    cardLabel: string;
    cardTitle: string;
    cardBody: string;
  };
  collaboration: {
    label: string;
    title: string;
    body: string;
    noteLabel: string;
    noteText: string;
    cardLabel: string;
    cardTitle: string;
    cardBody: string;
  };
  capabilities: {
    label: string;
    title: string;
    body: string;
    cards: [
      { title: string; body: string },
      { title: string; body: string },
      { title: string; body: string },
    ];
  };
  finalCta: {
    label: string;
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
  };
  footer: {
    body: string;
    productTitle: string;
    productLinks: [string, string, string];
    resourcesTitle: string;
    resourcesLinks: [string, string, string];
    conversionTitle: string;
    conversionBody: string;
    emailPlaceholder: string;
    submitCta: string;
  };
};

export const LANDING_COPY: Record<LandingCopyVariant, LandingCopyContent> = {
  control: {
    brandName: "MTSS Pulse",
    nav: {
      home: "Home",
      features: "Features",
      support: "Results",
      howItWorks: "How It Works",
    },
    header: {
      demoCta: "Book a Demo",
      demoHref: "#how-it-works",
      loginCta: "Login",
    },
    hero: {
      eyebrow: "Built for MTSS Teams",
      titleLine1: "Turn MTSS data into faster,",
      titleLine2: "coordinated student support.",
      description: "Unify attendance, interventions, family communication, and progress signals in one shared workflow your team can act on this week.",
      primaryCta: "Book a Demo",
      secondaryCta: "See How Schools Use Pulse",
    },
    socialProof: {
      quote: "\"We knew which students needed support, but our data lived in too many places. Pulse gave us one clear system for action.\" - Principal, K-8 Campus",
      context: "Pulse replaces spreadsheet handoffs with a shared intervention timeline your MTSS team can trust.",
    },
    visibility: {
      label: "Unified MTSS visibility",
      title: "Get a complete view of each student without switching systems.",
      body: "Bring attendance, academics, interventions, and communication into one timeline so teams can make faster, better support decisions.",
      bullets: [
        "Evidence-based student snapshots",
        "Tier-aware intervention progress",
        "District, school, and classroom context in one place",
      ],
      cardLabel: "Student Profile",
      cardTitle: "Pulse",
      cardBody: "One profile with attendance, interventions, fidelity, and family communication in context.",
    },
    collaboration: {
      label: "Collaboration built in",
      title: "Keep teams aligned from referral to follow-through.",
      body: "Move from insight to action with shared plans, role-based access, and audit-ready documentation for every intervention decision.",
      noteLabel: "Staff feedback",
      noteText: "\"Pulse became our single source of truth for MTSS meetings and follow-up.\"",
      cardLabel: "Team Alignment",
      cardTitle: "Collaborate",
      cardBody: "Keep principals, teachers, and specialists coordinated without duplicating notes and decisions.",
    },
    capabilities: {
      label: "Platform capabilities",
      title: "Everything your MTSS team needs to move faster.",
      body: "Built for educators who need clarity, speed, and accountability.",
      cards: [
        {
          title: "Live Student Progress",
          body: "Track intervention momentum in real time and respond before students fall further behind.",
        },
        {
          title: "AI Drafts for Communication",
          body: "Generate first drafts for family and staff communication, then tailor the message to each student context.",
        },
        {
          title: "Family Visibility by Default",
          body: "Keep families informed with timely updates, clear plans, and transparent next steps.",
        },
      ],
    },
    finalCta: {
      label: "Start your next cycle",
      title: "See how Pulse fits your MTSS model.",
      body: "We'll walk through referral-to-intervention workflows mapped to your team structure.",
      primaryCta: "Book a Demo",
      secondaryCta: "View MTSS Workflow",
    },
    footer: {
      body: "A modern MTSS operations workspace for schools and districts.",
      productTitle: "Product",
      productLinks: ["Features", "Results", "Workspace"],
      resourcesTitle: "Resources",
      resourcesLinks: ["System Health", "Roster Table", "Reports"],
      conversionTitle: "Ready to evaluate Pulse?",
      conversionBody: "Request a demo follow-up.",
      emailPlaceholder: "Work email",
      submitCta: "Request Invite",
    },
  },
  district: {
    brandName: "MTSS Pulse",
    nav: {
      home: "Home",
      features: "Capabilities",
      support: "District Results",
      howItWorks: "How It Works",
    },
    header: {
      demoCta: "Schedule District Demo",
      demoHref: "#how-it-works",
      loginCta: "Login",
    },
    hero: {
      eyebrow: "Built for District MTSS Leadership",
      titleLine1: "Standardize MTSS decisions across schools with one operational system.",
      titleLine2: "Keep teams aligned from referral to follow-through.",
      description: "Give district and school teams a shared source of truth for student risk, interventions, communication, and progress monitoring.",
      primaryCta: "Schedule District Demo",
      secondaryCta: "View District Outcomes",
    },
    socialProof: {
      quote: "\"Pulse helped us replace inconsistent school-level processes with one district MTSS workflow.\" - Director of Student Services",
      context: "District teams use Pulse to improve intervention consistency, reduce reporting friction, and increase accountability.",
    },
    visibility: {
      label: "District-wide visibility",
      title: "See what is happening across schools in real time.",
      body: "Track intervention execution, student progress, and team follow-through across every campus without waiting for manual rollups.",
      bullets: [
        "Cross-school student risk and intervention visibility",
        "Consistent tiered support workflows by campus",
        "District-to-school alignment with role-based access",
      ],
      cardLabel: "District Profile",
      cardTitle: "Pulse",
      cardBody: "One operational view for referrals, interventions, progress signals, and family communication across schools.",
    },
    collaboration: {
      label: "Governance and accountability",
      title: "Move from fragmented documentation to audit-ready MTSS operations.",
      body: "Capture decisions, ownership, timelines, and outcomes in one system so district leaders can monitor fidelity and support schools proactively.",
      noteLabel: "District feedback",
      noteText: "\"Pulse gave us confidence that school teams were executing plans consistently and documenting outcomes clearly.\"",
      cardLabel: "Operational Consistency",
      cardTitle: "Align",
      cardBody: "Keep district, principal, and specialist workflows coordinated without duplicating handoffs.",
    },
    capabilities: {
      label: "Platform capabilities",
      title: "What district MTSS teams need to scale support effectively.",
      body: "Designed for district leaders balancing consistency, compliance, and student outcomes.",
      cards: [
        {
          title: "District Progress Monitoring",
          body: "Track intervention effectiveness and student movement by tier, school, and subgroup.",
        },
        {
          title: "Operational AI Assistance",
          body: "Accelerate reporting and communication with AI-assisted drafts grounded in current student and intervention context.",
        },
        {
          title: "Family Communication Consistency",
          body: "Improve trust with timely, clear, and coordinated communication standards across schools.",
        },
      ],
    },
    finalCta: {
      label: "Next step",
      title: "See how Pulse fits your district MTSS model.",
      body: "In 20 minutes, we'll map your current workflow to Pulse and identify high-impact rollout opportunities.",
      primaryCta: "Schedule District Demo",
      secondaryCta: "Review Implementation Flow",
    },
    footer: {
      body: "A district-ready MTSS operations platform for consistent, accountable student support.",
      productTitle: "Product",
      productLinks: ["Capabilities", "District Results", "Workspace"],
      resourcesTitle: "Resources",
      resourcesLinks: ["System Health", "Roster Table", "Reports"],
      conversionTitle: "Planning district rollout?",
      conversionBody: "Request a leadership walkthrough.",
      emailPlaceholder: "District work email",
      submitCta: "Request Walkthrough",
    },
  },
};
