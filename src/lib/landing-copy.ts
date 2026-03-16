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
    steps: [
      { title: string; body: string },
      { title: string; body: string },
      { title: string; body: string },
    ];
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
    submitCta: string;
  };
};

export const LANDING_COPY: Record<LandingCopyVariant, LandingCopyContent> = {
  control: {
    brandName: "MTSS Pulse",
    nav: {
      home: "Home",
      features: "Overview",
      support: "Capabilities",
      howItWorks: "How It Works",
    },
    header: {
      demoCta: "See the Workflow",
      demoHref: "#how-it-works",
      loginCta: "Login",
    },
    hero: {
      eyebrow: "MTSS operations for school and district teams",
      titleLine1: "Move students from referral to support ",
      titleLine2: "without losing the thread.",
      description: "Pulse brings interventions, progress monitoring, meeting notes, and family communication into one shared workflow your team can use this week.",
      primaryCta: "Open Workspace",
      secondaryCta: "Explore Capabilities",
    },
    socialProof: {
      quote: "\"Teams stop chasing spreadsheets and start working from one live intervention record.\"",
      context: "Pulse helps MTSS teams move faster on referrals, keep ownership visible, and show progress without assembling updates by hand.",
    },
    visibility: {
      label: "Shared student visibility",
      title: "See the full student story before the meeting starts.",
      body: "Bring attendance, academics, interventions, and communication into one timeline so teams can make support decisions from current information.",
      bullets: [
        "Student timelines with current context",
        "Progress signals attached to active supports",
        "District, school, and classroom views in one place",
      ],
      cardLabel: "Student Profile",
      cardTitle: "Pulse",
      cardBody: "One view for attendance, interventions, notes, next steps, and family communication.",
    },
    collaboration: {
      label: "Execution, not handoffs",
      title: "Keep owners, decisions, and follow-through in the same workflow.",
      body: "Track who is responsible, what changed, and what still needs action without copying notes between meetings, inboxes, and spreadsheets.",
      noteLabel: "What improves",
      noteText: "Faster follow-through, clearer accountability, and fewer gaps between referral, assignment, and intervention start.",
      cardLabel: "Team Alignment",
      cardTitle: "Collaborate",
      cardBody: "Keep principals, teachers, specialists, and support staff aligned without duplicating documentation.",
    },
    capabilities: {
      label: "Day-to-day capabilities",
      title: "Built for MTSS execution, not just reporting.",
      body: "Use Pulse to review students, coordinate next steps, and keep support work moving between meetings.",
      cards: [
        {
          title: "Student Timelines",
          body: "See interventions, progress updates, meeting context, and communication history in one place.",
        },
        {
          title: "Team Coordination",
          body: "Track owners, deadlines, and decision history across roles without losing the next step.",
        },
        {
          title: "Family Communication",
          body: "Draft clearer updates with current student context so families know the plan and what comes next.",
        },
      ],
    },
    finalCta: {
      label: "How it works",
      title: "Keep the MTSS cycle moving from referral to follow-through.",
      body: "Pulse gives teams one shared workflow to review student needs, assign supports, document decisions, and monitor progress over time.",
      steps: [
        {
          title: "Identify students needing support",
          body: "Review attendance, academics, intervention history, and team context in one student timeline before decisions are made.",
        },
        {
          title: "Assign supports and owners",
          body: "Capture intervention decisions, next steps, and responsibilities so follow-through is visible after the meeting ends.",
        },
        {
          title: "Monitor progress and communicate",
          body: "Track active supports, update outcomes, and keep staff and families aligned on what changed and what comes next.",
        },
      ],
      primaryCta: "Open Workspace",
      secondaryCta: "Review Capabilities",
    },
    footer: {
      body: "An MTSS operations workspace for schools and districts that need clearer follow-through.",
      productTitle: "Product",
      productLinks: ["Overview", "Capabilities", "Workspace"],
      resourcesTitle: "Resources",
      resourcesLinks: ["System Health", "Roster Table", "Reports"],
      conversionTitle: "Ready to explore Pulse?",
      conversionBody: "Open the workspace to review the product experience.",
      submitCta: "Open Workspace",
    },
  },
  district: {
    brandName: "MTSS Pulse",
    nav: {
      home: "Home",
      features: "Overview",
      support: "Capabilities",
      howItWorks: "How It Works",
    },
    header: {
      demoCta: "See the Workflow",
      demoHref: "#how-it-works",
      loginCta: "Login",
    },
    hero: {
      eyebrow: "MTSS operations for district leadership",
      titleLine1: "Standardize referral-to-support workflows across schools ",
      titleLine2: "without adding reporting overhead.",
      description: "Give district and school teams one operational system for student risk, interventions, meeting decisions, and communication follow-through.",
      primaryCta: "Open Workspace",
      secondaryCta: "Explore Capabilities",
    },
    socialProof: {
      quote: "\"District teams gain one live operating view instead of waiting for campus-by-campus rollups.\"",
      context: "Pulse helps leaders improve intervention consistency, see execution across campuses, and reduce reporting friction.",
    },
    visibility: {
      label: "District-wide visibility",
      title: "See what is happening across schools without waiting for manual rollups.",
      body: "Track intervention execution, student progress, and campus follow-through from one operational view.",
      bullets: [
        "Cross-school views of student need and active support",
        "Consistent tiered support workflows by campus",
        "Role-based access for district and school teams",
      ],
      cardLabel: "District Profile",
      cardTitle: "Pulse",
      cardBody: "One operational view for referrals, interventions, progress signals, and family communication across schools.",
    },
    collaboration: {
      label: "Governance and accountability",
      title: "Keep campus execution visible without chasing updates.",
      body: "Capture decisions, owners, timelines, and outcomes in one system so district leaders can support schools proactively and document what happened.",
      noteLabel: "What improves",
      noteText: "Clearer accountability, stronger implementation consistency, and fewer gaps between district expectations and school-level follow-through.",
      cardLabel: "Operational Consistency",
      cardTitle: "Align",
      cardBody: "Keep district, principal, and specialist workflows coordinated without duplicating handoffs.",
    },
    capabilities: {
      label: "Day-to-day capabilities",
      title: "Built for district MTSS execution, oversight, and support.",
      body: "Use Pulse to standardize workflows, surface follow-through risk, and keep campus teams moving with shared context.",
      cards: [
        {
          title: "District Monitoring",
          body: "Track intervention execution and student movement by school, tier, and subgroup.",
        },
        {
          title: "Operational Coordination",
          body: "Keep timelines, owners, and decision history visible across district and campus teams.",
        },
        {
          title: "Communication Consistency",
          body: "Support clearer family and staff communication with current student and intervention context.",
        },
      ],
    },
    finalCta: {
      label: "How it works",
      title: "Move from district expectations to campus execution in one workflow.",
      body: "Pulse helps district teams review need, align interventions, document decisions, and monitor follow-through across schools.",
      steps: [
        {
          title: "Surface need across schools",
          body: "Review student risk, intervention history, and school context from one district-ready operating view.",
        },
        {
          title: "Align supports and campus ownership",
          body: "Standardize intervention decisions, assign owners, and make next steps visible across district and school teams.",
        },
        {
          title: "Monitor execution and communicate consistently",
          body: "Track follow-through, update outcomes, and support clearer staff and family communication across campuses.",
        },
      ],
      primaryCta: "Open Workspace",
      secondaryCta: "Review Capabilities",
    },
    footer: {
      body: "A district-ready MTSS operations platform for consistent, accountable student support.",
      productTitle: "Product",
      productLinks: ["Overview", "Capabilities", "Workspace"],
      resourcesTitle: "Resources",
      resourcesLinks: ["System Health", "Roster Table", "Reports"],
      conversionTitle: "Ready to review the district view?",
      conversionBody: "Open the workspace to explore the district-ready experience.",
      submitCta: "Open Workspace",
    },
  },
};
