import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

// Configure Neon WebSocket for serverless connections
neonConfig.webSocketConstructor = ws;

// Create Prisma adapter with connection string
const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});

// Initialize Prisma Client with Neon adapter
const prisma = new PrismaClient({
  adapter,
});

// ============================================
// Seed Data (defined inline for independence)
// ============================================

const userData = {
  id: "user_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YJ",
  name: "Alex Chen",
  email: "alex.chen@example.com",
  emailVerified: new Date("2026-01-15T00:00:00.000Z"),
  image: "https://api.dicebear.com/7.x/avataaars/svg?seed=AlexChen2026",
  password: "$2b$12$EixZaYb4j3p5w1e5r7t9u1i3o5a7s9d1f3g5h7j9k1l3z5x7c9v", // bcrypt hash for "demo123"
  isPro: true,
  stripeCustomerId: "cus_PQrStUvWxYz1234567890AbCdEf",
  stripeSubscriptionId: "sub_1234567890AbCdEfGhIjKlMn",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

const profileData = {
  id: "profile_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YK",
  userId: userData.id,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

const profileContentsData = [
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YM",
    sourceType: "profile" as const,
    sourceId: profileData.id,
    contentType: "profile_summary" as const,
    content: "Full-stack software engineer with 5+ years of experience building scalable web applications for SaaS companies. Specialize in React, TypeScript, and distributed systems. Passionate about developer experience, clean architecture, and mentorship.",
    sortOrder: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YN",
    sourceType: "profile" as const,
    sourceId: profileData.id,
    contentType: "profile_skill" as const,
    content: JSON.stringify({
      technical: [
        "TypeScript",
        "React 18+",
        "Next.js 13+",
        "Node.js",
        "PostgreSQL",
        "GraphQL",
        "Docker",
        "AWS",
        "Kubernetes",
        "CI/CD",
      ],
      soft: [
        "Technical leadership",
        "Cross-team collaboration",
        "Mentorship",
        "Agile project management",
        "Technical documentation",
      ],
      languages: ["English (Native)", "Mandarin (Fluent)"],
    }),
    sortOrder: 2,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YP",
    sourceType: "profile" as const,
    sourceId: profileData.id,
    contentType: "job_experience" as const,
    content: JSON.stringify({
      title: "Senior Software Engineer",
      company: "TechCorp Inc.",
      startDate: "2024-03",
      endDate: null,
      description: "Lead the frontend engineering team building customer-facing SaaS products. Responsible for technical architecture, code review processes, and mentorship of junior engineers.",
      achievements: [
        "Reduced application load time by 45% through code splitting, lazy loading, and performance optimization",
        "Architected real-time notification system handling 15k+ events per minute with 99.99% uptime",
        "Established CI/CD pipelines that reduced deployment time from 90 minutes to 8 minutes",
        "Mentored 4 junior engineers, 2 of whom were promoted to mid-level within 18 months",
      ],
    }),
    sortOrder: 3,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YQ",
    sourceType: "profile" as const,
    sourceId: profileData.id,
    contentType: "job_experience" as const,
    content: JSON.stringify({
      title: "Software Engineer",
      company: "StartupXYZ",
      startDate: "2021-06",
      endDate: "2024-02",
      description: "Full-stack engineer responsible for building and scaling the core product from early prototype to production serving 100k+ users.",
      achievements: [
        "Built the MVP product that secured $2.7M in seed funding from leading VC firms",
        "Designed and implemented database architecture that scaled to support 150k+ registered users",
        "Led migration from monolithic architecture to microservices, improving system reliability by 30%",
        "Implemented automated testing framework that reduced production bugs by 40%",
      ],
    }),
    sortOrder: 4,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YR",
    sourceType: "profile" as const,
    sourceId: profileData.id,
    contentType: "project_experience" as const,
    content: JSON.stringify({
      name: "Open Source Admin Dashboard",
      description: "A highly customizable open-source admin dashboard template built with React and TypeScript.",
      technologies: ["React", "TypeScript", "Tailwind CSS", "Next.js"],
      url: "https://github.com/alexchen/react-admin-dashboard",
      achievements: [
        "2.4k+ GitHub stars and 500+ active forks",
        "Featured in Next.js Showcase and React Status newsletter",
        "Used by over 800 developers across 30+ countries for production applications",
      ],
    }),
    sortOrder: 5,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YS",
    sourceType: "profile" as const,
    sourceId: profileData.id,
    contentType: "education" as const,
    content: JSON.stringify({
      school: "Stanford University",
      degree: "Bachelor of Science",
      major: "Computer Science",
      graduationDate: "2021-06",
      gpa: "3.8/4.0",
    }),
    sortOrder: 6,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YT",
    sourceType: "profile" as const,
    sourceId: profileData.id,
    contentType: "certification" as const,
    content: JSON.stringify({
      name: "AWS Solutions Architect - Professional",
      issuer: "Amazon Web Services",
      date: "2025-08",
      expirationDate: "2028-08",
    }),
    sortOrder: 7,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
];

const companiesData = [
  {
    id: "company_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YU",
    userId: userData.id,
    name: "Stripe",
    website: "https://stripe.com",
    industry: "FinTech",
    size: "5000+",
    stage: "Public",
    headquarters: "San Francisco, CA",
    // New columns
    name_en: "Stripe",
    register_address: "510 Townsend Street, San Francisco, CA 94103",
    register_post_code: "94103",
    province: "California",
    city: "San Francisco",
    district: "SoMa",
    company_size: "5,000-10,000 employees",
    establishment_date: new Date("2010-07-25"),
    enterprise_type: "Corporation",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "company_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YV",
    userId: userData.id,
    name: "Figma",
    website: "https://figma.com",
    industry: "Design Tools",
    size: "1000+",
    stage: "Public",
    headquarters: "San Francisco, CA",
    // New columns
    name_en: "Figma",
    register_address: "760 Market Street, San Francisco, CA 94103",
    register_post_code: "94103",
    province: "California",
    city: "San Francisco",
    district: "Downtown",
    company_size: "1,000-5,000 employees",
    establishment_date: new Date("2012-01-01"),
    createdAt: new Date("2026-02-15T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "company_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YW",
    userId: userData.id,
    name: "Linear",
    website: "https://linear.app",
    industry: "Developer Tools",
    size: "50-200",
    stage: "Series B",
    headquarters: "San Francisco, CA",
    // New columns
    name_en: "Linear",
    register_address: "548 Market St, San Francisco, CA 94104",
    register_post_code: "94104",
    province: "California",
    city: "San Francisco",
    district: "Financial District",
    company_size: "50-200 employees",
    establishment_date: new Date("2019-03-15"),
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "company_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YX",
    userId: userData.id,
    name: "Vercel",
    website: "https://vercel.com",
    industry: "Cloud Infrastructure",
    size: "200-500",
    stage: "Series D",
    headquarters: "San Francisco, CA",
    // New columns
    name_en: "Vercel",
    register_address: "340 Pine St, San Francisco, CA 94104",
    register_post_code: "94104",
    province: "California",
    city: "San Francisco",
    district: "Financial District",
    company_size: "200-500 employees",
    establishment_date: new Date("2015-01-01"),
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "company_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YY",
    userId: userData.id,
    name: "Notion",
    website: "https://notion.so",
    industry: "Productivity Software",
    size: "500-1000",
    stage: "Series E",
    headquarters: "San Francisco, CA",
    // New columns
    name_en: "Notion",
    register_address: "595 Howard St, San Francisco, CA 94105",
    register_post_code: "94105",
    province: "California",
    city: "San Francisco",
    district: "SoMa",
    company_size: "500-1000 employees",
    establishment_date: new Date("2013-04-01"),
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
];

const companyContentsData = [
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7YZ",
    sourceType: "company" as const,
    sourceId: companiesData[0].id, // Stripe
    contentType: "company_culture" as const,
    content: "Stripe values radical transparency, customer obsession, and long-term thinking. Engineering culture emphasizes rigorous code review, comprehensive documentation, and thoughtful API design. Teams are autonomous and encouraged to take ownership of their products.",
    sortOrder: 1,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z0",
    sourceType: "company" as const,
    sourceId: companiesData[0].id, // Stripe
    contentType: "company_news" as const,
    content: "Stripe launched Stripe AI suite in 2026, including AI-powered fraud detection, payment optimization, and developer tools. 2025 revenue reached $20B, with 20% YoY growth. Recently expanded into Southeast Asia with new regional headquarters in Singapore.",
    sortOrder: 2,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z1",
    sourceType: "company" as const,
    sourceId: companiesData[0].id, // Stripe
    contentType: "company_hiring_trends" as const,
    content: "Actively hiring senior engineers for payments infrastructure and developer experience teams. Prioritize candidates with distributed systems experience and a track record of building scalable, reliable systems. Remote and hybrid options available.",
    sortOrder: 3,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z2",
    sourceType: "company" as const,
    sourceId: companiesData[1].id, // Figma
    contentType: "company_culture" as const,
    content: "Figma emphasizes collaboration, creativity, and user-centric design. Async communication is preferred with minimal meetings. Engineering teams focus on building performant, reliable tools that empower creative work. Strong open source community and contribution culture.",
    sortOrder: 4,
    createdAt: new Date("2026-02-15T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z3",
    sourceType: "company" as const,
    sourceId: companiesData[2].id, // Linear
    contentType: "company_culture" as const,
    content: "Linear is known for its fast-paced, high-ownership culture. Small, autonomous teams with minimal process. Engineering-focused with a strong emphasis on product quality and performance. Remote-first with flexible work arrangements.",
    sortOrder: 5,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z4",
    sourceType: "company" as const,
    sourceId: companiesData[2].id, // Linear
    contentType: "company_news" as const,
    content: "Launched Linear AI in 2026, featuring AI-powered sprint planning, issue triaging, and project forecasting. 2025 ARR reached $80M with 400% YoY growth. Recently raised $150M Series C funding at a $4B valuation.",
    sortOrder: 6,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
];

const jobDescriptionsData = [
  {
    id: "job_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z5",
    userId: userData.id,
    companyId: companiesData[0].id, // Stripe
    title: "Senior Full-Stack Engineer, Payments Infrastructure",
    url: "https://stripe.com/jobs/positions/senior-full-stack-engineer-payments",
    content: `We're looking for a Senior Full-Stack Engineer to join our Payments Infrastructure team, building the systems that process billions of dollars in transactions annually.

Responsibilities:
- Design and implement scalable backend services for payment processing with 99.999% uptime requirements
- Build user-facing features in React/TypeScript for the Stripe Dashboard used by millions of businesses
- Collaborate with product managers and designers to define feature requirements and technical roadmaps
- Mentor junior engineers and contribute to engineering best practices across the organization
- Conduct architecture reviews and ensure systems are built for scalability and reliability

Requirements:
- 5+ years of professional software engineering experience
- Strong proficiency in TypeScript, React, and Node.js
- Deep experience with PostgreSQL or similar relational databases
- Understanding of distributed systems and API design principles
- Excellent communication skills and ability to work cross-functionally

Nice to have:
- Experience with fintech or payment systems
- AWS or cloud infrastructure experience
- Open source contributions
- Experience with Rust or other systems languages`,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "job_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z6",
    userId: userData.id,
    companyId: companiesData[1].id, // Figma
    title: "Software Engineer, Design Infrastructure",
    url: "https://figma.com/careers/software-engineer-design-infrastructure",
    content: `Join Figma's Design Infrastructure team to build the core engine that powers creative work for millions of designers worldwide.

Responsibilities:
- Build and optimize Figma's vector graphics engine and rendering pipeline
- Develop new plugin APIs and developer platform features
- Improve performance for complex design files with thousands of layers
- Collaborate with design and product teams to build new creative tools

Requirements:
- 3+ years of software engineering experience
- Strong computer science fundamentals (data structures, algorithms, graphics)
- Proficiency in TypeScript or similar typed languages
- Passion for building high-performance, user-facing products

Nice to have:
- Experience with WebGL, Canvas, or graphics programming
- Prior work on design tools or creative software
- Experience with Rust or C++ for performance-critical code`,
    createdAt: new Date("2026-04-10T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "job_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z7",
    userId: userData.id,
    companyId: companiesData[2].id, // Linear
    title: "Senior Backend Engineer, Real-Time Systems",
    url: "https://linear.app/careers/senior-backend-engineer-real-time",
    content: `Linear is looking for a Senior Backend Engineer to help build the future of project management tools used by thousands of companies.

Responsibilities:
- Design and implement GraphQL APIs and backend services for real-time collaboration features
- Optimize database queries and improve system reliability at scale
- Work on performance improvements for our core issue tracking and sprint planning features
- Contribute to engineering best practices and architecture decisions

Requirements:
- 5+ years of backend engineering experience
- Strong TypeScript/Node.js skills with experience building scalable APIs
- Deep experience with PostgreSQL and Redis
- Understanding of real-time systems and WebSocket technologies
- Experience with GraphQL and API design

Nice to have:
- Experience with GraphQL subscriptions or real-time collaboration systems
- Background in developer tools or productivity software
- Experience with Elixir or other functional languages`,
    createdAt: new Date("2026-04-15T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "job_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z8",
    userId: userData.id,
    companyId: companiesData[3].id, // Vercel
    title: "Staff Software Engineer, Next.js Runtime",
    url: "https://vercel.com/careers/staff-software-engineer-nextjs-runtime",
    content: `Join Vercel's Next.js Runtime team to build the infrastructure that powers millions of websites and applications.

Responsibilities:
- Architect and implement core runtime features for Next.js, including Edge Functions and serverless compute
- Define technical direction for deployment infrastructure and runtime optimization
- Collaborate with the open source community to improve Next.js for all users
- Optimize performance and reliability for the Vercel platform serving billions of requests monthly

Requirements:
- 8+ years of software engineering experience
- Deep expertise in Node.js and JavaScript runtime internals
- Experience building distributed systems at scale
- Strong technical leadership skills and ability to drive cross-team initiatives

Nice to have:
- V8 engine internals knowledge
- Experience with WebAssembly or Rust
- Contributions to open source projects`,
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
];

const jobContentsData = [
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7Z9",
    sourceType: "job" as const,
    sourceId: jobDescriptionsData[0].id, // Stripe job
    contentType: "job_requirement" as const,
    content: "5+ years experience, TypeScript/React/Node.js, PostgreSQL, distributed systems, API design",
    sortOrder: 1,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZA",
    sourceType: "job" as const,
    sourceId: jobDescriptionsData[0].id, // Stripe job
    contentType: "job_salary" as const,
    content: "$180,000 - $250,000 base + 0.05% - 0.15% equity + bonus",
    sortOrder: 2,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZB",
    sourceType: "job" as const,
    sourceId: jobDescriptionsData[0].id, // Stripe job
    contentType: "job_location" as const,
    content: "San Francisco, CA (Hybrid - 2 days in office per week)",
    sortOrder: 3,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZC",
    sourceType: "job" as const,
    sourceId: jobDescriptionsData[0].id, // Stripe job
    contentType: "job_remote_policy" as const,
    content: "Hybrid work policy - 2 days in office, 3 days remote. Fully remote options considered for exceptional candidates.",
    sortOrder: 4,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZD",
    sourceType: "job" as const,
    sourceId: jobDescriptionsData[1].id, // Figma job
    contentType: "job_salary" as const,
    content: "$160,000 - $220,000 base + equity",
    sortOrder: 5,
    createdAt: new Date("2026-04-10T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZE",
    sourceType: "job" as const,
    sourceId: jobDescriptionsData[2].id, // Linear job
    contentType: "job_location" as const,
    content: "Remote (US only) or hybrid from San Francisco office",
    sortOrder: 6,
    createdAt: new Date("2026-04-15T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
];

const resumesData = [
  {
    id: "resume_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZF",
    userId: userData.id,
    jobDescriptionId: jobDescriptionsData[0].id, // Stripe job
    name: "Senior Full-Stack Engineer - Stripe Tailored",
    isPrimary: true,
    fitScore: 87,
    fitAnalysis: "Strong match in TypeScript/React/Node.js experience. Excellent distributed systems background aligns with payments infrastructure needs. Consider highlighting fintech-related experience and AWS certifications in the final version.",
    createdAt: new Date("2026-04-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "resume_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZG",
    userId: userData.id,
    jobDescriptionId: jobDescriptionsData[2].id, // Linear job
    name: "Senior Backend Engineer - Linear Tailored",
    isPrimary: false,
    fitScore: 82,
    fitAnalysis: "Good match for backend engineering role with strong PostgreSQL and Node.js experience. Emphasize real-time systems work and GraphQL API development to strengthen fit for the real-time systems position.",
    createdAt: new Date("2026-04-18T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
];

const resumeVersionsData = [
  {
    id: "res_version_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZH",
    resumeId: resumesData[0].id,
    content: `# Alex Chen
Senior Software Engineer
San Francisco, CA | alex.chen@example.com | linkedin.com/in/alexchen | github.com/alexchen

## Professional Summary
Full-stack engineer with 5+ years building scalable web applications for SaaS companies. Proven track record of leading teams, optimizing performance, and delivering high-impact features. Specialize in TypeScript, React, and distributed systems.

## Professional Experience

### Senior Software Engineer | TechCorp Inc. | 2024 - Present
Lead frontend engineering team building customer-facing SaaS platform serving 50k+ daily active users.
- Reduced application load time by 45% through code splitting, lazy loading, and performance optimization
- Architected real-time notification system handling 15k+ events per minute with 99.99% uptime
- Established CI/CD pipelines that reduced deployment time from 90 minutes to 8 minutes
- Mentored 4 junior engineers, 2 promoted to mid-level within 18 months
- Led migration from monolithic architecture to microservices, improving reliability by 30%

### Software Engineer | StartupXYZ | 2021 - 2024
Full-stack engineer building core product from prototype to production serving 100k+ users.
- Built MVP that secured $2.7M in seed funding from top-tier VC firms
- Designed and implemented database architecture scaling to 150k+ registered users
- Implemented automated testing framework reducing production bugs by 40%

## Technical Skills
Languages: TypeScript, JavaScript, Python, SQL
Frameworks: React, Next.js, Node.js, Express, GraphQL
Databases: PostgreSQL, Redis, MongoDB
Infrastructure: AWS, Docker, Kubernetes, CI/CD
Tools: Git, Jira, Figma, Notion

## Education
### Stanford University | Bachelor of Science in Computer Science | 2021
GPA: 3.8/4.0 | Relevant Coursework: Distributed Systems, Database Systems, Computer Graphics

## Certifications
AWS Solutions Architect - Professional (2025)

## Projects
### Open Source Admin Dashboard | 2023 - Present
Highly customizable admin dashboard template with 2.4k+ GitHub stars. Used by 800+ developers worldwide.
Built with React, TypeScript, Tailwind CSS, and Next.js.`,
    changeNotes: "Initial tailored version highlighting relevant experience for Stripe payments infrastructure role",
    fitScore: 87,
    createdAt: new Date("2026-04-05T00:00:00.000Z"),
  },
];

const interviewsData = [
  {
    id: "interview_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZI",
    userId: userData.id,
    jobDescriptionId: jobDescriptionsData[0].id, // Stripe job
    type: "behavioral",
    status: "completed",
    overallScore: 4.4,
    summary: "Strong behavioral interview performance. Excellent STAR method responses with clear metrics and outcomes. Areas for improvement: provide more specific examples of cross-functional collaboration in future interviews.",
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "interview_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZJ",
    userId: userData.id,
    jobDescriptionId: jobDescriptionsData[0].id, // Stripe job
    type: "technical",
    status: "in_progress",
    overallScore: null,
    summary: null,
    createdAt: new Date("2026-05-15T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
];

const interviewContentsData = [
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZK",
    sourceType: "interview" as const,
    sourceId: interviewsData[0].id, // Completed behavioral interview
    contentType: "interview_question" as const,
    content: "Tell me about a time when you had to make a difficult technical decision with incomplete information.",
    sortOrder: 1,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZL",
    sourceType: "interview" as const,
    sourceId: interviewsData[0].id,
    contentType: "interview_answer" as const,
    content: "At TechCorp, we needed to choose a frontend framework for our new customer dashboard. We had a tight deadline and couldn't do a full proof-of-concept for both React and Vue. I researched both thoroughly, talked to other engineering leaders, and made the decision to go with React based on TypeScript support, ecosystem maturity, and team familiarity. It turned out to be the right choice - we've been able to scale the team and product successfully with minimal issues.",
    sortOrder: 2,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZM",
    sourceType: "interview" as const,
    sourceId: interviewsData[0].id,
    contentType: "interview_polished_answer" as const,
    content: `**Situation**: At TechCorp, I was tasked with selecting the frontend framework for our new customer dashboard, which would be used by 50k+ daily users and maintained by a growing engineering team. We had a 3-month deadline to ship the first version, which didn't leave time for a full proof-of-concept of both React and Vue options we were considering.

**Task**: I needed to make a technology decision that would support our product roadmap for at least 3 years, accommodate our team's skill set, and minimize onboarding friction for new hires.

**Action**: I created a weighted decision matrix evaluating both frameworks across 8 criteria: TypeScript support, ecosystem maturity, hiring pool availability, team familiarity, performance, long-term roadmap, enterprise adoption, and open source community health. I also conducted interviews with 5 engineering leaders at companies of similar scale to understand their lessons learned from similar decisions.

**Result**: We chose React. Over the following 18 months:
- Our engineering team grew from 3 to 12 developers with minimal onboarding friction
- We shipped 40+ major features without significant framework-related refactoring
- Page load times improved by 45% through React-specific optimization techniques
- We were able to hire 3 senior React developers within 30 days when we needed to scale the team rapidly`,
    sortOrder: 3,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZN",
    sourceType: "interview" as const,
    sourceId: interviewsData[0].id,
    contentType: "interview_feedback" as const,
    content: "Excellent answer with clear STAR structure and strong quantitative metrics. The decision matrix approach demonstrates strong analytical thinking and due diligence. The quantified outcomes (team growth, feature velocity, performance improvements) are particularly compelling. Score: 4.6/5",
    sortOrder: 4,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZO",
    sourceType: "interview" as const,
    sourceId: interviewsData[0].id,
    contentType: "interview_question" as const,
    content: "Tell me about a time you led a major technical initiative that impacted multiple teams.",
    sortOrder: 5,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZP",
    sourceType: "interview" as const,
    sourceId: interviewsData[0].id,
    contentType: "interview_answer" as const,
    content: "I led the migration from our monolithic architecture to microservices at StartupXYZ. It involved coordinating with 3 different engineering teams over a 6-month period. We successfully completed the migration with zero downtime and improved system reliability by 30%.",
    sortOrder: 6,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
  {
    id: "content_01H8XQZ7YJZ8XQZ7YJZ8XQZ7ZQ",
    sourceType: "interview" as const,
    sourceId: interviewsData[0].id,
    contentType: "interview_feedback" as const,
    content: "Good high-level overview, but could benefit from more specific details about challenges faced, how you coordinated across teams, and specific metrics about the outcomes. Score: 4.2/5",
    sortOrder: 7,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  },
];

// ============================================
// Seed Script
// ============================================

/**
 * Seed the database with realistic development data
 * Fully self-contained with no external dependencies
 * Follows foreign key constraints and Prisma schema exactly
 */
async function main() {
  console.log("🌱 Starting database seed...");

  // Clear existing data (development only - always run in reverse dependency order)
  console.log("🧹 Clearing existing data...");
  await prisma.content.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.resumeVersion.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.jobDescription.deleteMany();
  await prisma.company.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();

  // Insert core user
  console.log("👤 Creating test user...");
  const user = await prisma.user.create({ data: userData });
  console.log(`✅ Created user: ${user.email} (ID: ${user.id})`);

  // Insert user profile
  console.log("📝 Creating user profile...");
  const profile = await prisma.profile.create({ data: profileData });
  console.log(`✅ Created profile (ID: ${profile.id})`);

  // Insert profile content
  console.log("📚 Inserting profile content...");
  await prisma.content.createMany({ data: profileContentsData });
  console.log(`✅ Inserted ${profileContentsData.length} profile content entries`);

  // Insert companies
  console.log("🏢 Inserting companies...");
  await prisma.company.createMany({ data: companiesData });
  console.log(`✅ Inserted ${companiesData.length} companies`);

  // Insert company content
  console.log("📰 Inserting company content...");
  await prisma.content.createMany({ data: companyContentsData });
  console.log(`✅ Inserted ${companyContentsData.length} company content entries`);

  // Insert job descriptions
  console.log("💼 Inserting job descriptions...");
  await prisma.jobDescription.createMany({ data: jobDescriptionsData });
  console.log(`✅ Inserted ${jobDescriptionsData.length} job descriptions`);

  // Insert job content
  console.log("📋 Inserting job content...");
  await prisma.content.createMany({ data: jobContentsData });
  console.log(`✅ Inserted ${jobContentsData.length} job content entries`);

  // Insert resumes
  console.log("📄 Inserting resumes...");
  await prisma.resume.createMany({ data: resumesData });
  console.log(`✅ Inserted ${resumesData.length} resumes`);

  // Insert resume versions
  console.log("📑 Inserting resume versions...");
  await prisma.resumeVersion.createMany({ data: resumeVersionsData });
  console.log(`✅ Inserted ${resumeVersionsData.length} resume versions`);

  // Insert interviews
  console.log("🎤 Inserting interviews...");
  await prisma.interview.createMany({ data: interviewsData });
  console.log(`✅ Inserted ${interviewsData.length} interviews`);

  // Insert interview content
  console.log("💬 Inserting interview content...");
  await prisma.content.createMany({ data: interviewContentsData });
  console.log(`✅ Inserted ${interviewContentsData.length} interview content entries`);

  // Validate seed data integrity
  console.log("🔍 Running seed validation...");
  await validateSeed();

  // Print completion summary
  console.log("\n🎉 Database seed completed successfully!");
  console.log("\n📊 Seed Data Summary:");
  console.log(`- 1 User (${userData.email} / password: "demo123")`);
  console.log(`- 1 User Profile`);
  console.log(`- ${profileContentsData.length} Profile Content entries`);
  console.log(`- ${companiesData.length} Companies (Stripe, Figma, Linear, Vercel, Notion)`);
  console.log(`- ${companyContentsData.length} Company Content entries`);
  console.log(`- ${jobDescriptionsData.length} Job Descriptions`);
  console.log(`- ${jobContentsData.length} Job Content entries`);
  console.log(`- ${resumesData.length} Tailored Resumes`);
  console.log(`- ${resumeVersionsData.length} Resume Versions`);
  console.log(`- ${interviewsData.length} Interview Sessions`);
  console.log(`- ${interviewContentsData.length} Interview Content entries`);
  console.log("\n💡 Login credentials for demo:");
  console.log(`  Email: ${userData.email}`);
  console.log(`  Password: demo123`);
}

/**
 * Validate seed data integrity and relational consistency
 * Ensures all data was inserted correctly and matches schema requirements
 */
async function validateSeed() {
  // Count validation
  const counts = {
    user: await prisma.user.count(),
    profile: await prisma.profile.count(),
    company: await prisma.company.count(),
    jobDescription: await prisma.jobDescription.count(),
    resume: await prisma.resume.count(),
    resumeVersion: await prisma.resumeVersion.count(),
    interview: await prisma.interview.count(),
    content: await prisma.content.count(),
  };

  // Verify counts match expected values
  if (counts.user !== 1) throw new Error(`Seed validation failed: Expected 1 user, found ${counts.user}`);
  if (counts.profile !== 1) throw new Error(`Seed validation failed: Expected 1 profile, found ${counts.profile}`);
  if (counts.company !== companiesData.length) throw new Error(`Seed validation failed: Expected ${companiesData.length} companies, found ${counts.company}`);
  if (counts.jobDescription !== jobDescriptionsData.length) throw new Error(`Seed validation failed: Expected ${jobDescriptionsData.length} jobs, found ${counts.jobDescription}`);
  if (counts.resume !== resumesData.length) throw new Error(`Seed validation failed: Expected ${resumesData.length} resumes, found ${counts.resume}`);
  if (counts.resumeVersion !== resumeVersionsData.length) throw new Error(`Seed validation failed: Expected ${resumeVersionsData.length} resume versions, found ${counts.resumeVersion}`);
  if (counts.interview !== interviewsData.length) throw new Error(`Seed validation failed: Expected ${interviewsData.length} interviews, found ${counts.interview}`);

  const expectedContentCount = profileContentsData.length + companyContentsData.length + jobContentsData.length + interviewContentsData.length;
  if (counts.content !== expectedContentCount) throw new Error(`Seed validation failed: Expected ${expectedContentCount} content entries, found ${counts.content}`);

  // Relational integrity validation
  const userWithRelations = await prisma.user.findFirst({
    include: {
      profile: true,
      companies: true,
      jobDescriptions: true,
      resumes: true,
      interviews: true,
    },
  });

  if (!userWithRelations) throw new Error("Seed validation failed: User not found after seed");
  if (!userWithRelations.profile) throw new Error("Seed validation failed: User profile not found after seed");
  if (userWithRelations.companies.length !== companiesData.length) throw new Error(`Seed validation failed: User should have ${companiesData.length} companies, found ${userWithRelations.companies.length}`);
  if (userWithRelations.jobDescriptions.length !== jobDescriptionsData.length) throw new Error(`Seed validation failed: User should have ${jobDescriptionsData.length} jobs, found ${userWithRelations.jobDescriptions.length}`);
  if (userWithRelations.resumes.length !== resumesData.length) throw new Error(`Seed validation failed: User should have ${resumesData.length} resumes, found ${userWithRelations.resumes.length}`);
  if (userWithRelations.interviews.length !== interviewsData.length) throw new Error(`Seed validation failed: User should have ${interviewsData.length} interviews, found ${userWithRelations.interviews.length}`);

  // Content association validation
  const profileContentCount = await prisma.content.count({
    where: { sourceType: "profile", sourceId: profileData.id },
  });
  if (profileContentCount !== profileContentsData.length) throw new Error(`Seed validation failed: Profile should have ${profileContentsData.length} content entries, found ${profileContentCount}`);

  console.log("✅ All seed validation checks passed!");
}

// Execute seed process
main()
  .catch((error) => {
    console.error("❌ Seed failed with error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
