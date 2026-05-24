# WhyJob — Project Overview

> **One AI-powered hub to manage your job search: company research, resume tailoring, and mock interviews.**

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Target Users](#target-users)
3. [Tech Stack](#tech-stack)
4. [Core Features](#core-features)
   - [Company Research](#a-company-research)
   - [Resume Management](#b-resume-management)
   - [Mock Interviews](#c-mock-interviews)
5. [Data Models & Prisma Schema](#data-models--prisma-schema)
6. [URL Structure](#url-structure)
7. [UI/UX Guidelines](#uiux-guidelines)
8. [App Architecture](#app-architecture)
9. [Monetization](#monetization)
10. [AI Agent Architecture](#ai-agent-architecture)

---

## The Problem

Job hunting is fragmented and overwhelming:

| Challenge                | Typical Solution                    |
| ------------------------ | ----------------------------------- |
| Finding company info     | Google search, LinkedIn, Glassdoor  |
| Tracking job listings    | Spreadsheets, sticky notes          |
| Resume tailoring         | Manual editing, generic templates   |
| Interview prep           | Random questions from the internet  |
| Company culture research | Word-of-mouth, Reddit, limited data |

JobHunter solves this with a unified, AI-enhanced workspace for the entire job search lifecycle.

---

## Target Users

| User Type                    | Primary Need                                                       |
| ---------------------------- | ------------------------------------------------------------------ |
| **Job Seeker (New Grad)**    | Guide through the process, resume templates, common interview prep |
| **Career Switcher**          | Translate existing skills, highlight relevant experience           |
| **Experienced Professional** | Efficiently manage multiple applications, target high-value roles  |
| **Tech Job Hunter**          | Code interviews, system design prep, technical role focus          |

---

## Tech Stack

| Layer        | Choice                          | Notes                                                                                                                  |
| ------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Framework    | **Next.js 16 / React 19**       | SSR + API routes in one repo                                                                                           |
| Language     | **TypeScript**                  | End-to-end type safety                                                                                                 |
| Database     | **Neon (PostgreSQL)**           | Cloud-hosted Postgres                                                                                                  |
| ORM          | **Prisma 7**                    | Fetch latest docs before use                                                                                           |
| Cache        | **Upstash Redis**               | Sliding-window rate limiting                                                                                           |
| File Storage | **Cloudflare R2**               | File & Excel uploads                                                                                                   |
| Auth         | **NextAuth v5**                 | Email/password + GitHub OAuth                                                                                          |
| AI           | **Claude (Anthropic)**          | Primary AI model for all AI features                                                                                   |
| Styling      | **Tailwind CSS v4 + ShadCN UI** | Dark mode first                                                                                                        |
| Web Scraping | **Playwright + OpenCLI**        | Playwright for structured page automation; OpenCLI for AI-driven browsing, content extraction, and multi-site research |
| Spreadsheet  | **xlsx**                        | Excel file parsing                                                                                                     |

> **DB Rule:** Never use `db push`. Always create and run migrations (`prisma migrate dev` → `prisma migrate deploy`).

---

## Core Features

### A. Company Research

#### A1. Company Data Collection

| Method           | Description                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manual Entry** | Add company with just a name                                                                                                                            |
| **Excel Import** | Upload `.xlsx` / `.xls` files, then use a **flexible column-mapping UI** to match spreadsheet columns to our fields (drag-and-drop or dropdown mapping) |
| **Web Scraping** | Configurable depth per company — leverage Playwright + OpenCLI:                                                                                         |
|                  | - Quick: Name + website only                                                                                                                            |
|                  | - Medium: + Careers page, culture info                                                                                                                  |
|                  | - Deep: + Recent news, hiring trends, WeChat accounts                                                                                                   |

#### A2. Company Profile Fields

| Field           | Description                                                     |
| --------------- | --------------------------------------------------------------- | ------- | --------- |
| `name`          | Company name                                                    |
| `website`       | Official website URL                                            |
| `industry`      | e.g., "Tech", "Finance", "Healthcare"                           |
| `size`          | e.g., "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+" |
| `stage`         | e.g., "Startup", "Series A", "Series B", "Public"               |
| `headquarters`  | Location                                                        |
| `culture`       | AI-generated or manual notes                                    |
| `recentNews`    | Recent news/updates                                             |
| `wechatAccount` | WeChat official account (if applicable)                         |
| `hiringTrends`  | Current hiring status                                           |
| `sourceType`    | "manual"                                                        | "excel" | "scraped" |
| `sourceFile`    | Original filename (for imported data)                           |

#### A3. Scraping Agent (Configurable Depth)

| Depth      | What's Scraped                                                       |
| ---------- | -------------------------------------------------------------------- |
| **Quick**  | Name + website, basic metadata                                       |
| **Medium** | + Careers/jobs page, "About" / "Culture" / "Team" pages              |
| **Deep**   | + Recent news via web search, hiring trends, WeChat official account |

A dedicated sub-agent will use both tools:

1. **Playwright** — Structured, reliable automation for navigating to known pages, clicking elements, and capturing page snapshots
2. **OpenCLI** — AI-driven browsing for exploring unfamiliar sites, discovering career/culture pages, and extracting unstructured content
3. Together, they navigate to company website at the chosen depth level
4. Extract careers page links and open positions
5. Gather culture info from "About", "Culture", "Team" pages
6. Look for WeChat QR codes or mentions (Deep)
7. Search for recent news (Deep)
8. Compile into structured data

---

### B. Resume Management

#### B1. User Profile (Full Resume Data)

Maintain comprehensive user data via **two input paths**:

**Path 1 — Structured Forms:** User fills in form fields for each section:
| Section | Fields |
| ------- | ------ |
| **Job Experience** | title, company, startDate, endDate, description, achievements[] |
| **Project Experience** | name, description, technologies[], url, achievements[] |
| **Education** | school, degree, major, graduationDate |
| **Skills** | technical[], soft[], languages[] |
| **Achievements** | title, description, date |
| **Certifications** | name, issuer, date |
| **Summary** | Professional summary / headline |

**Path 2 — Resume File Upload:** User uploads an existing resume (PDF, DOCX, TXT). The AI parses it and either:

- Initializes a new blank profile from the parsed resume data, OR
- Supplements/syncs specific sections into an existing profile

The user can freely switch between paths — structured forms for granular control, or upload for bulk initialization.

#### B2. Resume Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│  User Profile (Master Data)                             │
│  ├── Job Experiences                                    │
│  ├── Project Experiences                                │
│  ├── Education                                          │
│  ├── Skills                                             │
│  └── ...                                                │
└──────────────────────┬──────────────────────────────────┘
                       │ Tailor for Job
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Tailored Resume (per Job Description)                  │
│  ├── Generated content                                  │
│  ├── Fit score + analysis                               │
│  ├── Key advantages highlighted                         │
│  └── Version history                                    │
└─────────────────────────────────────────────────────────┘
```

#### B3. AI Resume Generation

| Feature                  | Description                                         |
| ------------------------ | --------------------------------------------------- |
| **Fit Analysis**         | Compare resume against job description, score 0-100 |
| **Match Highlighting**   | Identify which experiences/skills match             |
| **Tailored Content**     | Rewrite summary, highlight relevant achievements    |
| **Advantage Summary**    | List key differentiators                            |
| **Keyword Optimization** | Include relevant keywords from job posting          |

#### B4. Resume Sub-Agent

A dedicated sub-agent will:

1. Analyze job description requirements
2. Score current resume fit (0-100)
3. Identify gaps and matching points
4. Generate optimized resume content
5. Provide improvement suggestions

---

### C. Mock Interviews

#### C1. Interview Types

| Type              | Focus                                                      |
| ----------------- | ---------------------------------------------------------- |
| **Behavioral**    | Past experiences, STAR method, culture fit                 |
| **Technical**     | Job-specific technical questions, coding, domain knowledge |
| **System Design** | Architecture design, distributed systems, scalability      |
| **Case Study**    | Problem-solving scenarios _(planned)_                      |

#### C2. Interview Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. Select Job Description + Interview Type            │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  2. AI Generates Questions                              │
│      Based on: resume + job description + interview type │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  3. User Answers Questions (one at a time)              │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  4. AI Polishes Answer                                  │
│      - Improve clarity, STAR format                      │
│      - Highlight relevant experiences                  │
│      - Score the answer                                 │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  5. Final Q&A List for Review                           │
│      - All questions                                    │
│      - Polished answers                                 │
│      - Overall interview summary                        │
└─────────────────────────────────────────────────────────┘
```

#### C3. Answer Polishing

For each user answer, AI will:

1. Evaluate relevance to the question
2. Restructure using STAR method (Situation, Task, Action, Result)
3. Strengthen with quantifiable metrics where applicable
4. Remove fluff and improve clarity
5. Provide a score and feedback

---

## Data Models & Prisma Schema

The WhyJob data model uses a **Content table pattern** for scalable, flexible content storage. Core entity tables focus on their primary purpose, while detailed content is stored in the Content table with `contentType` identifiers and corresponding parsers.

### Design Principles

1. **Separation of Concerns**: Core entity tables (Profile, Company, JobDescription, etc.) focus on their primary purpose. Detailed content is stored in the Content table.
2. **Content Extensibility**: New content types can be added without schema migrations. Each `contentType` has a corresponding parser.
3. **Ordering**: Content entries support `sortOrder` for flexible ordering of items within a category.
4. **Audit Trail**: All content entries have `createdAt` and `updatedAt` timestamps.

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// User & Auth
// ============================================

model User {
  id                   String       @id @default(cuid())
  name                 String?
  email                String?      @unique
  emailVerified        DateTime?
  image                String?
  password             String?      // bcrypt hash; null for OAuth-only accounts
  isPro                Boolean      @default(false)
  stripeCustomerId     String?      @unique
  stripeSubscriptionId String?      @unique
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  accounts        Account[]
  sessions        Session[]

  // JobHunter specific
  profile         Profile?
  companies       Company[]
  jobDescriptions JobDescription[]
  resumes         Resume[]
  interviews      Interview[]
}

// NextAuth required models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================
// JobHunter Core Models
// ============================================

// User's full profile / master resume data
// All detailed content (job experiences, education, skills, etc.) stored in Content table
model Profile {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  contents  Content[]
}

// Companies the user is researching
// Core metadata only; detailed content stored in Content table
model Company {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name         String
  website      String?
  industry     String?
  size         String?   // "1-10", "11-50", etc.
  stage        String?   // "Startup", "Series A", etc.
  headquarters String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  jobDescriptions JobDescription[]
  contents        Content[]
}

// Job descriptions user has saved/applied to
// Core fields only; detailed content stored in Content table
model JobDescription {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  companyId   String?
  company     Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  title   String
  url     String?
  content String   // Full job description text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  resumes    Resume[]
  interviews Interview[]
  contents   Content[]
}

// Generated resumes tailored for specific jobs
// Resume content stored as Content entries
model Resume {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  jobDescriptionId String?
  jobDescription   JobDescription? @relation(fields: [jobDescriptionId], references: [id], onDelete: SetNull)

  name         String
  isPrimary    Boolean @default(false)

  fitScore    Float?
  fitAnalysis String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  versions ResumeVersion[]
  contents  Content[]
}

model ResumeVersion {
  id         String   @id @default(cuid())
  resumeId   String
  resume     Resume   @relation(fields: [resumeId], references: [id], onDelete: Cascade)

  content     String
  changeNotes String?
  fitScore    Float?

  createdAt DateTime @default(now())
}

// Interview sessions
// Questions stored as Content entries
model Interview {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  jobDescriptionId String?
  jobDescription   JobDescription? @relation(fields: [jobDescriptionId], references: [id], onDelete: SetNull)

  type   String @default("behavioral")  // "behavioral" | "technical" | "system-design" | "case-study"
  status String @default("in_progress")  // "in_progress" | "completed"

  overallScore Float?
  summary      String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  contents Content[]
}

// ============================================
// Content Table (Flexible Key-Value Store)
// ============================================

model Content {
  id         String   @id @default(cuid())

  sourceType  String   // "profile" | "company" | "job" | "resume" | "interview"
  sourceId    String
  contentType String   // Content template type (determines which parser to use)

  content   String
  sortOrder Int      @default(1)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([sourceType, sourceId])
}
```

### Content Types Reference

| sourceType | contentType | Description | Parser |
|------------|-------------|-------------|--------|
| **Profile** | | | |
| | `profile_summary` | Professional summary | TextParser |
| | `profile_skill` | Skills (technical, soft, languages) | JsonParser |
| | `job_experience` | Work history entry | JobExperienceParser |
| | `project_experience` | Project entry | ProjectExperienceParser |
| | `education` | Education entry | EducationParser |
| | `achievement` | Achievement entry | AchievementParser |
| | `certification` | Certification entry | CertificationParser |
| **Company** | | | |
| | `company_culture` | Culture notes | TextParser |
| | `company_news` | Recent news | TextParser |
| | `company_wechat` | WeChat account | TextParser |
| | `company_hiring_trends` | Hiring trends | TextParser |
| **Job** | | | |
| | `job_requirement` | Job requirement | TextParser |
| | `job_responsibility` | Job responsibility | TextParser |
| | `job_salary` | Salary range | TextParser |
| | `job_location` | Job location | TextParser |
| | `job_remote_policy` | Remote work policy | TextParser |
| **Resume** | | | |
| | `resume_summary` | Resume summary section | TextParser |
| | `resume_experience` | Experience section | ResumeExperienceParser |
| | `resume_skills` | Skills section | JsonParser |
| | `resume_education` | Education section | ResumeEducationParser |
| **Interview** | | | |
| | `interview_question` | Interview question | QuestionParser |
| | `interview_answer` | User's answer | TextParser |
| | `interview_polished_answer` | AI-polished answer | TextParser |
| | `interview_feedback` | AI feedback on answer | TextParser |

---

---

## URL Structure

| Route              | Description                                                             |
| ------------------ | ----------------------------------------------------------------------- |
| `/`                | Landing page                                                            |
| `/dashboard`       | Main dashboard (auth-gated)                                             |
| `/sign-in`         | Sign in (credentials + GitHub)                                          |
| `/register`        | Account registration                                                    |
| `/forgot-password` | Request password reset                                                  |
| `/reset-password`  | Set new password                                                        |
| `/profile`         | User profile & master resume data (structured forms + file upload init) |
| `/settings`        | Settings, billing                                                       |

### Company Routes

| Route                    | Description          |
| ------------------------ | -------------------- |
| `/companies`             | Company list         |
| `/companies/new`         | Add company (manual) |
| `/companies/import`      | Import from Excel    |
| `/companies/[id]`        | Company detail       |
| `/companies/[id]/scrape` | Scrape company data  |

### Job Routes

| Route        | Description            |
| ------------ | ---------------------- |
| `/jobs`      | Job descriptions list  |
| `/jobs/new`  | Add job description    |
| `/jobs/[id]` | Job description detail |

### Resume Routes

| Route           | Description              |
| --------------- | ------------------------ |
| `/resumes`      | Resume list              |
| `/resumes/new`  | Create tailored resume   |
| `/resumes/[id]` | Resume detail & versions |

### Interview Routes

| Route              | Description             |
| ------------------ | ----------------------- |
| `/interviews`      | Interview sessions list |
| `/interviews/new`  | Start new interview     |
| `/interviews/[id]` | Interview Q&A           |

---

## UI/UX Guidelines

### General Principles

- Modern, minimal, professional aesthetic
- Dark mode by default; light mode available
- Clean typography, generous whitespace
- Subtle borders and shadows
- Reference apps: [Notion](https://notion.so), [Linear](https://linear.app), [Raycast](https://raycast.com)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Top Bar: Logo | Search | User                         │
├────────────┬────────────────────────────────────────────┤
│            │                                            │
│  Sidebar   │  Main Content Area                         │
│            │                                            │
│  Dashboard │  Context-specific content                 │
│  Companies │  Tables, Cards, Forms                     │
│  Jobs      │                                            │
│  Resumes   │                                            │
│  Interviews│                                            │
│            │                                            │
│  ───────   │                                            │
│  Settings  │                                            │
└────────────┴────────────────────────────────────────────┘
```

### Key UI Patterns

| Pattern               | Description                        |
| --------------------- | ---------------------------------- |
| **Slide-over Drawer** | For quick views, editing           |
| **Full Dialogs**      | For complex forms (create/edit)    |
| **Tables**            | List views with sorting, filtering |
| **Cards**             | Grid views for companies, resumes  |
| **Markdown Editor**   | For resume content, notes          |

### Micro-interactions

- Smooth slide/fade transitions
- Hover states on all interactive elements
- Toast notifications for all actions
- Loading skeletons while data fetches
- Progress indicators for long operations (scraping)

---

## App Architecture

```
jobhunter/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── layout.tsx                  # Root layout + Toaster
│   │   ├── globals.css                 # Tailwind v4 + theme tokens
│   │   ├── dashboard/                  # Dashboard home (auth-gated)
│   │   ├── companies/
│   │   │   ├── page.tsx                # Company list
│   │   │   ├── new/page.tsx            # Add company
│   │   │   ├── import/page.tsx         # Import from Excel
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Company detail
│   │   │       └── scrape/page.tsx     # Scrape company
│   │   ├── jobs/
│   │   ├── resumes/
│   │   ├── interviews/
│   │   ├── profile/
│   │   ├── settings/
│   │   ├── sign-in/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       ├── scrape/                  # Company scraping endpoint
│   │       ├── upload/                  # File upload endpoint (Excel, resume)
│   │       └── resume-parse/            # AI resume file parsing endpoint
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components
│   │   ├── layout/                     # Shell, Sidebar, TopBar
│   │   ├── companies/                  # Company-related components
│   │   ├── jobs/                       # Job-related components
│   │   ├── resumes/                    # Resume components
│   │   │   └── ResumeUpload.tsx        #    Upload + AI parse initialization
│   │   ├── interviews/                # Interview components
│   │   └── profile/                   # Profile components
│   │       └── ExcelColumnMapper.tsx   #    Column mapping UI for imports
│   ├── lib/
│   │   ├── prisma.ts                   # Prisma client singleton
│   │   ├── auth.ts                     # NextAuth config
│   │   ├── anthropic.ts                # Anthropic AI client
│   │   ├── scraper.ts                  # Playwright scraping utilities
│   │   ├── opencli.ts                  # OpenCLI AI-driven browsing utilities
│   │   ├── excel.ts                    # xlsx parsing + column mapping utilities
│   │   ├── resume-parser.ts            # AI resume (PDF/DOCX/TXT) parsing
│   │   ├── rate-limit.ts               # Upstash rate limiter
│   │   ├── email.ts                    # Resend client
│   │   ├── r2.ts                       # Cloudflare R2 client
│   │   └── utils.ts                    # General utilities
│   ├── actions/                        # Server Actions
│   │   ├── companies.ts                # Company CRUD
│   │   ├── jobs.ts                     # Job CRUD
│   │   ├── resumes.ts                  # Resume CRUD
│   │   └── interviews.ts              # Interview CRUD
│   ├── agents/                         # AI Sub-agents
│   │   ├── company-research-agent.ts  # Scrapes company data
│   │   ├── resume-fit-agent.ts         # Analyzes resume fit
│   │   ├── resume-generation-agent.ts  # Generates tailored resume
│   │   └── interview-agent.ts          # Generates & reviews answers
│   └── types/                          # TypeScript types
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── context/                            # Project documentation
│   ├── coding-standards.md
│   ├── ai-interaction.md
│   ├── current-feature.md
│   └── features/
└── docs/                               # Additional documentation
```

---

## AI Agent Architecture

### Agent Overview

| Agent                       | Purpose                     | Input                           | Output                      |
| --------------------------- | --------------------------- | ------------------------------- | --------------------------- |
| **Company Research Agent**  | Scrape company data         | Company URL                     | Structured company data     |
| **Resume Fit Agent**        | Score resume fit            | Resume + Job Description        | Fit score (0-100), analysis |
| **Resume Generation Agent** | Generate tailored resume    | User Profile + Job Description  | Tailored resume content     |
| **Interview Agent**         | Generate & review questions | Resume + Job Description + Type | Questions + answer polish   |

### Agent Interaction Flow

```
User Action
    │
    ▼
Server Action (Route Handler)
    │
    ▼
AI Agent (Sub-agent)
    │
    ├──► Tool Use (Scrape, Search, etc.)
    │
    ▼
Response to User
```

### Sub-Agent Detailed Design

#### 1. Company Research Agent

```typescript
// Input
{ companyUrl: string, depth: 'quick' | 'medium' | 'deep' }

// Tools
// Playwright (structured automation)
- playwright_navigate(url)           // Navigate to a known page
- playwright_snapshot()              // Get page accessibility tree
- playwright_click(selector)         // Click elements (e.g., "Careers" link)

// OpenCLI (AI-driven browsing)
- opencli_navigate(url)              // AI-guided navigation to discover pages
- opencli_extract(prompt)            // Extract specific info from page content
- web_search(query)                  // Search for news/info/WeChat account

// Output
{
  website: string,
  careersUrl: string | null,
  culture: string,
  recentNews: string[],
  hiringTrends: string,
  wechatAccount: string | null
}
```

#### 2. Resume Fit Agent

```typescript
// Input
{
  userProfile: Profile,           // Master resume data
  jobDescription: JobDescription  // Target job
}

// Output
{
  fitScore: number,               // 0-100
  matchingSkills: string[],
  missingSkills: string[],
  matchingExperiences: string[],
  gaps: string[],
  suggestions: string[]
}
```

#### 3. Resume Generation Agent

```typescript
// Input
{
  userProfile: Profile,
  jobDescription: JobDescription,
  fitAnalysis: ResumeFitOutput
}

// Output
{
  content: string,                 // Markdown resume
  fitScore: number,
  advantages: string[],            // Key differentiators
  changes: string[]                 // What was emphasized
}
```

#### 4. Interview Agent

```typescript
// Input
{
  userProfile: Profile,
  jobDescription: JobDescription,
  interviewType: 'behavioral' | 'technical' | 'system-design' | 'case-study'
}

// For question generation
// Output: { questions: Question[] }

// For answer polishing
// Input: { question: string, userAnswer: string }
// Output: { polishedAnswer: string, score: number, feedback: string }
```

---

## Monetization

### Free Plan

- 3 companies
- 5 job descriptions
- 3 resumes
- 3 interviews
- Basic AI features (limited usage)

### Pro Plan — $8/month or $72/year

- Unlimited companies, jobs, resumes, interviews
- Full AI features
- Excel import
- Advanced scraping
- Priority support

Payments via **Stripe**.

---

_Last updated: May 2026_
