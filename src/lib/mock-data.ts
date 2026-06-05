import type {
  User,
  Profile,
  Content,
  Company,
  JobDescription,
  Resume,
  Interview,
  ResumeVersion,
} from "@/lib/db.types";

export const mockUser: User = {
  id: "user_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YJ",
  name: "Alex Chen",
  email: "alex.chen@example.com",
  emailVerified: new Date("2026-01-15"),
  image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  password: "$2b$10$hashedpasswordplaceholder",
  isPro: true,
  stripeCustomerId: "cus_mock123",
  stripeSubscriptionId: "sub_mock456",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-05-20"),
};

export const mockProfile: Profile = {
  id: "profile_1",
  userId: "user_1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-05-20"),
};

export const mockProfileContents: Content[] = [
  {
    id: "content_profile_summary",
    sourceType: "profile",
    sourceId: "profile_1",
    contentType: "profile_summary",
    content:
      "Full-stack software engineer with 5 years of experience building scalable web applications. Passionate about developer experience and clean architecture.",
    sortOrder: 1,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-05-15"),
  },
  {
    id: "content_profile_skill",
    sourceType: "profile",
    sourceId: "profile_1",
    contentType: "profile_skill",
    content: JSON.stringify({
      technical: [
        "TypeScript",
        "React",
        "Next.js",
        "Node.js",
        "PostgreSQL",
        "GraphQL",
        "Docker",
        "AWS",
      ],
      soft: ["Leadership", "Communication", "Problem Solving"],
      languages: ["English", "Mandarin"],
    }),
    sortOrder: 2,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-05-15"),
  },
  {
    id: "content_job_exp_1",
    sourceType: "profile",
    sourceId: "profile_1",
    contentType: "job_experience",
    content: JSON.stringify({
      title: "Senior Software Engineer",
      company: "TechCorp Inc.",
      startDate: "2024-03",
      endDate: null,
      description:
        "Leading development of customer-facing dashboard serving 50k+ daily users.",
      achievements: [
        "Reduced page load time by 40% through code splitting and lazy loading",
        "Mentored 3 junior developers and established code review practices",
        "Architected real-time notification system handling 10k events/minute",
      ],
    }),
    sortOrder: 3,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-05-15"),
  },
  {
    id: "content_job_exp_2",
    sourceType: "profile",
    sourceId: "profile_1",
    contentType: "job_experience",
    content: JSON.stringify({
      title: "Software Engineer",
      company: "StartupXYZ",
      startDate: "2021-06",
      endDate: "2024-02",
      description:
        "Full-stack developer building and scaling the core product from prototype to production.",
      achievements: [
        "Built MVP that secured $2M seed funding",
        "Scaled database to handle 100k registered users",
        "Implemented CI/CD pipeline reducing deploy time from 1 hour to 5 minutes",
      ],
    }),
    sortOrder: 4,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-05-15"),
  },
  {
    id: "content_project_1",
    sourceType: "profile",
    sourceId: "profile_1",
    contentType: "project_experience",
    content: JSON.stringify({
      name: "OpenSource Dashboard",
      description:
        "A customizable admin dashboard template with 2k+ GitHub stars",
      technologies: ["React", "TypeScript", "Tailwind CSS"],
      url: "https://github.com/alexchen/dashboard",
      achievements: [
        "2,100+ stars on GitHub",
        "Featured in Next.js newsletter",
        "Used by 500+ developers worldwide",
      ],
    }),
    sortOrder: 5,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-05-15"),
  },
  {
    id: "content_education_1",
    sourceType: "profile",
    sourceId: "profile_1",
    contentType: "education",
    content: JSON.stringify({
      school: "Stanford University",
      degree: "Bachelor of Science",
      major: "Computer Science",
      graduationDate: "2021-05",
    }),
    sortOrder: 6,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-05-15"),
  },
  {
    id: "content_cert_1",
    sourceType: "profile",
    sourceId: "profile_1",
    contentType: "certification",
    content: JSON.stringify({
      name: "AWS Solutions Architect",
      issuer: "Amazon Web Services",
      date: "2025-08",
    }),
    sortOrder: 7,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-05-15"),
  },
];

export const mockCompanies: Company[] = [
  {
    id: "company_1",
    userId: "user_1",
    name: "Stripe",
    description: "Online payment processing platform for internet businesses",
    website: "https://stripe.com",
    industry: "FinTech",
    size: "5000+",
    stage: "Public",
    headquarters: "San Francisco, CA",
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "company_2",
    userId: "user_1",
    name: "Figma",
    description: "Collaborative design platform for teams",
    website: "https://figma.com",
    industry: "Design Tools",
    size: "1000+",
    stage: "Public",
    headquarters: "San Francisco, CA",
    createdAt: new Date("2026-02-15"),
    updatedAt: new Date("2026-05-12"),
  },
  {
    id: "company_3",
    userId: "user_1",
    name: "Linear",
    description: "Streamlined issue tracking and project management for modern teams",
    website: "https://linear.app",
    industry: "Developer Tools",
    size: "50-200",
    stage: "Series B",
    headquarters: "San Francisco, CA",
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-05-14"),
  },
  {
    id: "company_4",
    userId: "user_1",
    name: "Vercel",
    description: "Frontend cloud platform for deploying and scaling web applications",
    website: "https://vercel.com",
    industry: "Cloud Infrastructure",
    size: "200-500",
    stage: "Series D",
    headquarters: "San Francisco, CA",
    createdAt: new Date("2026-03-10"),
    updatedAt: new Date("2026-05-15"),
  },
  {
    id: "company_5",
    userId: "user_1",
    name: "Notion",
    description: "All-in-one workspace for notes, tasks, and collaboration",
    website: "https://notion.so",
    industry: "Productivity",
    size: "500-1000",
    stage: "Series E",
    headquarters: "San Francisco, CA",
    createdAt: new Date("2026-03-20"),
    updatedAt: new Date("2026-05-18"),
  },
];

export const mockCompanyContents: Content[] = [
  {
    id: "content_company_1_culture",
    sourceType: "company",
    sourceId: "company_1",
    contentType: "company_culture",
    content:
      "Stripe values transparency, customer obsession, and building for the long term. Engineering culture emphasizes code review, documentation, and thoughtful API design.",
    sortOrder: 1,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "content_company_1_news",
    sourceType: "company",
    sourceId: "company_1",
    contentType: "company_news",
    content:
      "Stripe launched Stripe AI, a suite of AI-powered tools for fraud detection and payment optimization. Revenue hit $20B in 2025.",
    sortOrder: 2,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "content_company_1_hiring",
    sourceType: "company",
    sourceId: "company_1",
    contentType: "company_hiring_trends",
    content:
      "Actively hiring for backend engineers, particularly those with distributed systems experience. Focus on infrastructure and payments processing teams.",
    sortOrder: 3,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "content_company_2_culture",
    sourceType: "company",
    sourceId: "company_2",
    contentType: "company_culture",
    content:
      "Figma emphasizes collaboration, creativity, and design excellence. Team meetings are rare - async communication is preferred.",
    sortOrder: 4,
    createdAt: new Date("2026-02-15"),
    updatedAt: new Date("2026-05-12"),
  },
  {
    id: "content_company_3_culture",
    sourceType: "company",
    sourceId: "company_3",
    contentType: "company_culture",
    content:
      "Linear is known for its fast-paced, high-ownership culture. Small teams, big impact. Very engineering-focused with minimal meetings.",
    sortOrder: 5,
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-05-14"),
  },
  {
    id: "content_company_3_news",
    sourceType: "company",
    sourceId: "company_3",
    contentType: "company_news",
    content:
      "Linear launched Linear AI, their largest product update ever, featuring AI-powered sprint planning and issue triaging.",
    sortOrder: 6,
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-05-14"),
  },
];

export const mockJobDescriptions: JobDescription[] = [
  {
    id: "job_1",
    userId: "user_1",
    companyId: "company_1",
    title: "Senior Full-Stack Engineer",
    url: "https://stripe.com/jobs/senior-full-stack",
    content: `We're looking for a Senior Full-Stack Engineer to join our Payments team.

Responsibilities:
- Design and implement scalable backend services handling billions of transactions
- Build user-facing features in React/TypeScript for the Stripe Dashboard
- Collaborate with product and design to define feature requirements
- Mentor junior engineers and contribute to technical decisions

Requirements:
- 5+ years of experience in software engineering
- Strong proficiency in TypeScript, React, and Node.js
- Experience with PostgreSQL or similar relational databases
- Familiarity with distributed systems and API design
- Excellent communication skills

Nice to have:
- Experience with fintech or payments
- AWS or GCP experience
- Open source contributions`,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "job_2",
    userId: "user_1",
    companyId: "company_2",
    title: "Software Engineer, Design Infrastructure",
    url: "https://figma.com/jobs/software-engineer-design",
    content: `Join Figma's Design Infrastructure team to build the tools that power creative work for millions of designers.

Responsibilities:
- Build core features of Figma's vector graphics engine
- Optimize rendering performance for complex design files
- Develop new plugin APIs and developer tools

Requirements:
- 3+ years of experience in software engineering
- Strong CS fundamentals (data structures, algorithms)
- Experience with TypeScript or similar typed languages
- Passion for building performant, user-facing products

Nice to have:
- Experience with WebGL, Canvas, or graphics programming
- Prior work on design tools or creative software`,
    createdAt: new Date("2026-04-10"),
    updatedAt: new Date("2026-05-12"),
  },
  {
    id: "job_3",
    userId: "user_1",
    companyId: "company_3",
    title: "Senior Backend Engineer",
    url: "https://linear.app/jobs/senior-backend",
    content: `Linear is looking for a Senior Backend Engineer to help build the future of project management.

Responsibilities:
- Design and implement GraphQL APIs and backend services
- Work on real-time collaboration features
- Improve system reliability and performance

Requirements:
- 5+ years of backend engineering experience
- Strong TypeScript/Node.js skills
- Experience with PostgreSQL and Redis
- Understanding of real-time systems

Nice to have:
- Experience with GraphQL subscriptions
- Background in developer tools`,
    createdAt: new Date("2026-04-15"),
    updatedAt: new Date("2026-05-14"),
  },
  {
    id: "job_4",
    userId: "user_1",
    companyId: "company_4",
    title: "Staff Software Engineer, Runtime",
    url: "https://vercel.com/jobs/staff-runtime",
    content: `Join Vercel's Runtime team to build the infrastructure that powers millions of websites.

Responsibilities:
- Architect and implement core runtime features for Next.js
- Work on Edge Functions and serverless compute
- Define technical direction for deployment infrastructure

Requirements:
- 8+ years of software engineering experience
- Deep expertise in Node.js and JavaScript runtimes
- Experience with distributed systems at scale
- Strong technical leadership skills

Nice to have:
- V8 engine internals knowledge
- Experience with Wasm or Rust`,
    createdAt: new Date("2026-04-20"),
    updatedAt: new Date("2026-05-15"),
  },
];

export const mockJobContents: Content[] = [
  {
    id: "content_job_1_req",
    sourceType: "job",
    sourceId: "job_1",
    contentType: "job_requirement",
    content:
      "5+ years experience, TypeScript/React/Node.js, PostgreSQL, distributed systems",
    sortOrder: 1,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "content_job_1_salary",
    sourceType: "job",
    sourceId: "job_1",
    contentType: "job_salary",
    content: "$180,000 - $250,000 + equity",
    sortOrder: 2,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "content_job_1_location",
    sourceType: "job",
    sourceId: "job_1",
    contentType: "job_location",
    content: "San Francisco, CA (Hybrid)",
    sortOrder: 3,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "content_job_1_remote",
    sourceType: "job",
    sourceId: "job_1",
    contentType: "job_remote_policy",
    content: "Hybrid - 2 days in office",
    sortOrder: 4,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "content_job_2_salary",
    sourceType: "job",
    sourceId: "job_2",
    contentType: "job_salary",
    content: "$160,000 - $220,000 + equity",
    sortOrder: 5,
    createdAt: new Date("2026-04-10"),
    updatedAt: new Date("2026-05-12"),
  },
  {
    id: "content_job_3_location",
    sourceType: "job",
    sourceId: "job_3",
    contentType: "job_location",
    content: "Remote (US)",
    sortOrder: 6,
    createdAt: new Date("2026-04-15"),
    updatedAt: new Date("2026-05-14"),
  },
];

export const mockResumes: Resume[] = [
  {
    id: "resume_1",
    userId: "user_1",
    jobDescriptionId: "job_1",
    name: "Stripe Senior Engineer - Tailored",
    isPrimary: true,
    fitScore: 85,
    fitAnalysis:
      "Strong match in TypeScript/React/Node.js. Consider highlighting fintech experience and distributed systems work.",
    createdAt: new Date("2026-04-05"),
    updatedAt: new Date("2026-05-10"),
  },
  {
    id: "resume_2",
    userId: "user_1",
    jobDescriptionId: "job_3",
    name: "Linear Backend - Tailored",
    isPrimary: false,
    fitScore: 78,
    fitAnalysis:
      "Good GraphQL base. Emphasize real-time systems experience and backend scaling work.",
    createdAt: new Date("2026-04-18"),
    updatedAt: new Date("2026-05-14"),
  },
];

export const mockResumeVersions: ResumeVersion[] = [
  {
    id: "resume_version_1",
    resumeId: "resume_1",
    content: `# Alex Chen\nSenior Software Engineer\n\n## Summary\nFull-stack engineer with 5+ years building scalable web applications. At TechCorp, I led development of a dashboard serving 50k+ daily users.\n\n## Experience\n**Senior Software Engineer** | TechCorp Inc. | 2024-Present\n- Led development of customer-facing dashboard (50k+ DAU)\n- Reduced page load time by 40% via code splitting\n- Architected real-time notification system (10k events/min)\n\n**Software Engineer** | StartupXYZ | 2021-2024\n- Built MVP that secured $2M seed funding\n- Scaled database to 100k registered users\n\n## Skills\nTypeScript, React, Next.js, Node.js, PostgreSQL, GraphQL, Docker, AWS\n\n## Education\nStanford University | BS Computer Science | 2021`,
    changeNotes: "Initial tailored version",
    fitScore: 85,
    createdAt: new Date("2026-04-05"),
  },
];

export const mockInterviews: Interview[] = [
  {
    id: "interview_1",
    userId: "user_1",
    jobDescriptionId: "job_1",
    type: "behavioral",
    status: "completed",
    overallScore: 4.2,
    summary:
      "Good STAR responses. Strong leadership examples. Consider more specific metrics in future answers.",
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-05"),
  },
  {
    id: "interview_2",
    userId: "user_1",
    jobDescriptionId: "job_1",
    type: "technical",
    status: "in_progress",
    overallScore: null,
    summary: null,
    createdAt: new Date("2026-05-15"),
    updatedAt: new Date("2026-05-15"),
  },
];

export const mockInterviewContents: Content[] = [
  {
    id: "content_interview_1_q1",
    sourceType: "interview",
    sourceId: "interview_1",
    contentType: "interview_question",
    content:
      "Tell me about a time when you had to make a difficult technical decision with incomplete information.",
    sortOrder: 1,
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
  },
  {
    id: "content_interview_1_a1",
    sourceType: "interview",
    sourceId: "interview_1",
    contentType: "interview_answer",
    content:
      "When I joined TechCorp, we needed to choose between React and Vue for our new dashboard. We had limited time and couldn't do a full proof-of-concept. I researched both thoroughly, talked to other teams, and made a call based on TypeScript support and ecosystem maturity. We went with React and it's been the right call for our scale.",
    sortOrder: 2,
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
  },
  {
    id: "content_interview_1_pa1",
    sourceType: "interview",
    sourceId: "interview_1",
    contentType: "interview_polished_answer",
    content:
      "**Situation**: At TechCorp, I was tasked with choosing the frontend framework for our new customer dashboard with a tight deadline.\n\n**Task**: I needed to make a technology decision that would impact 10+ developers for years, with only 2 weeks to evaluate options.\n\n**Action**: I created a weighted decision matrix considering TypeScript support, ecosystem maturity, hiring pool, and team familiarity. I also reached out to 5 other engineering leaders at companies of similar scale for their lessons learned.\n\n**Result**: We chose React. 18 months later, our team has grown from 3 to 12 developers with minimal onboarding friction, and we've shipped 40+ features without major refactoring.",
    sortOrder: 3,
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
  },
  {
    id: "content_interview_1_fb1",
    sourceType: "interview",
    sourceId: "interview_1",
    contentType: "interview_feedback",
    content:
      "Strong answer with clear structure. The quantified result (18 months, 12 developers, 40+ features) is compelling. Consider leading with the most impressive outcome next time.",
    sortOrder: 4,
    createdAt: new Date("2026-05-01"),
    updatedAt: new Date("2026-05-01"),
  },
];

export const mockData = {
  user: mockUser,
  profile: mockProfile,
  profileContents: mockProfileContents,
  companies: mockCompanies,
  companyContents: mockCompanyContents,
  jobDescriptions: mockJobDescriptions,
  jobContents: mockJobContents,
  resumes: mockResumes,
  resumeVersions: mockResumeVersions,
  interviews: mockInterviews,
  interviewContents: mockInterviewContents,
};