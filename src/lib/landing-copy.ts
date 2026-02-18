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
    brandName: "MTSS Genius",
    nav: {
      home: "Home",
      features: "Features",
      support: "Testimonials",
      howItWorks: "Pricing",
    },
    header: {
      demoCta: "Request A Demo",
      demoHref: "#support",
      loginCta: "Login",
    },
    hero: {
      eyebrow: "Built for Hearts & Minds",
      titleLine1: "Every student has a story.",
      titleLine2: "Help them write the best version.",
      description: "Bring intervention data, progress tracking, and collaboration into one clear flow designed for schools and districts.",
      primaryCta: "Start Your Journey",
      secondaryCta: "Check Out Success Stories",
    },
    socialProof: {
      quote: "\"I knew they were struggling, but the data was scattered everywhere.\"",
      context: "We built Pulse to unify fragmented support data so teams can spend less time chasing systems and more time helping students.",
    },
    visibility: {
      label: "Unified MTSS visibility",
      title: "Gain a 360-degree view of every student.",
      body: "Pull attendance, interventions, fidelity, and communication signals into one timeline your support team can act on quickly.",
      bullets: [
        "Evidence-based student snapshots",
        "Tier-aware intervention progress",
        "Context switching across district and school",
      ],
      cardLabel: "Student Profile",
      cardTitle: "Pulse",
      cardBody: "One profile with attendance, interventions, fidelity, and family communication in context.",
    },
    collaboration: {
      label: "Collaboration built in",
      title: "Seamless collaboration for whole-child support.",
      body: "Move from insight to action with shared plans, role-based access, and an audit-friendly workflow for every intervention decision.",
      noteLabel: "Staff note",
      noteText: "\"Pulse gave us one source of truth for meetings and follow-up actions.\"",
      cardLabel: "Team Alignment",
      cardTitle: "Collaborate",
      cardBody: "Keep principals, teachers, and specialists coordinated without duplicating notes and decisions.",
    },
    capabilities: {
      label: "Platform capabilities",
      title: "The Support You Need to Support Them",
      body: "Built for MTSS teams who need clarity, speed, and accountability.",
      cards: [
        {
          title: "Real-time Progress",
          body: "View current intervention momentum and respond before students fall behind.",
        },
        {
          title: "Smart Suggestions",
          body: "Use AI-assisted prompts to draft communication and next-step recommendations.",
        },
        {
          title: "Parent First",
          body: "Keep families informed with consistent, contextual updates and transparent plans.",
        },
      ],
    },
    finalCta: {
      label: "Start your next cycle",
      title: "Start a new chapter in student success today.",
      body: "Join teams using structured data and coordinated workflows to move support plans forward faster.",
      primaryCta: "Start Your Journey",
      secondaryCta: "Check Out Success Stories",
    },
    footer: {
      body: "A modern MTSS operations workspace for schools and districts.",
      productTitle: "Product",
      productLinks: ["Features", "Support", "Workspace"],
      resourcesTitle: "Resources",
      resourcesLinks: ["Health", "Roster Table", "Reports"],
      conversionTitle: "Ready to start?",
      conversionBody: "Sign up for updates",
      emailPlaceholder: "Email Address",
      submitCta: "Submit",
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
      quote: "\"Pulse helped us replace inconsistent school-level processes with one district MTSS workflow.\"",
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
      title: "Book a 20-minute demo and see Pulse in action.",
      body: "We will map your current workflow to Pulse and identify high-impact rollout opportunities.",
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

