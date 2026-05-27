# JobHunter — Project Overview

> **One AI-powered hub to manage your job search: company research, resume tailoring, and mock interviews.**

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Target Users](#target-users)
3. [Tech Stack](#tech-stack)
4. [Data Models & Prisma Schema](#data-models--prisma-schema)
5. [Features](#features)
6. [Resume Fit Scoring](#resume-fit-scoring)
7. [Interview System](#interview-system)
8. [URL Structure](#url-structure)
9. [App Architecture](#app-architecture)

---

## The Problem

Job hunting is fragmented and overwhelming:

| Task | Typical Approach |
| ---- | ---------------- |
| Company research | Manual Google searches, visiting multiple sites |
| Resume tailoring | Copy-paste between documents, guess what fits |
| Interview prep | Random Google searches, no personalized feedback |
| Tracking progress | Spreadsheets, sticky notes, memory |

JobHunter solves this with a unified, AI-enhanced workspace.

---

## Target Users

| User Type | Primary Need |
| --------- | ------------ |
| **Active Job Seeker** | Tailor resumes fast, prepare interviews efficiently |
| **Career Switcher** | Reframe experience for new roles |
| **Fresh Graduate** | Build resume from scratch, learn interview basics |
| **Senior Professional** | Polish executive presence, prep for leadership roles |

---

## Tech Stack

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| Framework | **Next.js 16 / React 19** | SSR + API routes in one repo |
| Language | **TypeScript** | End-to-end type safety |
| Database | **Neon (PostgreSQL)** | Cloud-hosted Postgres |
| ORM | **Prisma 7** | Always use migrations, never `db push` |
| AI | **Claude (Anthropic)** | Resume analysis, generation, interview prep |
| Web Scraping | **Playwright** | Company research from official websites |
| Auth | **NextAuth v5** | Email/password + OAuth |
| Styling | **Tailwind CSS v4 + ShadCN UI** | Modern, accessible components |

---

## Data Models & Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  password      String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts        Account[]
  sessions        Session[]
  profile         Profile?
  companies       Company[]
  resumes         Resume[]
  jobDescriptions JobDescription[]
  interviews      Interview[]
}

model Profile {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Work history
  jobExperiences    Json?  // Array of { company, title, startDate, endDate, description, achievements }
  projectExperiences Json? // Array of { name, description, technologies, url?, achievements }

  // Personal details
  summary         String?  // Professional summary/bio
  skills          String[] // Technical skills array
  education       Json?    // Array of { school, degree, field, graduationDate }

  // Additional
  achievements    String?  // Awards, certifications, notable accomplishments
  languages       String[] // Programming languages
  certifications  String[] // Certificates, badges

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Company {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name            String
  website         String?
  industry        String?
  size            String?  // e.g., "51-200 employees"
  stage           String?  // e.g., "Series B", "Public", "Startup"
  headquarters    String?

  // Research data
  culture         String?  // Company culture notes
  recentNews      String?  // Recent news/s developments
  wechatAccount   String?  // WeChat official account name
  hiringTrends    String?  // Current hiring status

  // Source tracking
  sourceType      String?  // "excel" | "manual" | "scraped"
  sourceFile      String?  // Original filename if imported

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  jobDescriptions  JobDescription[]
}

model JobDescription {
  id              String   @id @default(cuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  title           String
  url             String?
  content         String   // Full job description text
  requirements    String[] // Extracted requirements
  responsibilities String[] // Extracted responsibilities
  salaryRange     String?
  location        String?
  remotePolicy    String?  // "Remote", "Hybrid", "On-site"

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  resumes         Resume[]
  interviews      Interview[]
}

model Resume {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  jobDescriptionId String?
  jobDescription   JobDescription? @relation(fields: [jobDescriptionId], references: [id])

  name            String   // e.g., "Software Engineer - Google"
  content         String   // Full resume content (Markdown)

  // AI-generated metadata
  fitScore        Float?   // 0-100 score from AI analysis
  fitAnalysis     String?  // AI feedback on fit
  advantages      String[] // Key advantages identified by AI

  isPrimary       Boolean  @default(false) // Primary/general resume
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  versions        ResumeVersion[]
}

model ResumeVersion {
  id              String   @id @default(cuid())
  resumeId        String
  resume          Resume   @relation(fields: [resumeId], references: [id], onDelete: Cascade)

  content         String   // Snapshot of resume content
  changeNotes     String?  // What was changed and why
  fitScore        Float?
  createdAt       DateTime @default(now())
}

model Interview {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  jobDescriptionId String?
  jobDescription   JobDescription? @relation(fields: [jobDescriptionId], references: [id])

  type            String   // "behavioral" | "technical" | "system-design" | "case-study"

  // Session data
  questions       Json?    // Array of { question, userAnswer, suggestedAnswer, score, feedback }
  status          String   @default("in_progress") // "in_progress" | "completed"

  // Summary
  overallScore    Float?
  summary         String?  // AI-generated interview summary

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
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
```

---

## Features

### A — Company Research

- **Import companies** from Excel files (.xlsx, .xls) or manual entry
- **Web scraping** via Playwright to gather:
  - Company website information
  - Official careers pages
  - Company culture and values
  - Recent news and developments
  - WeChat official account (if applicable)
- **Company profiles** with all gathered information in one place

### B — User Profile

Comprehensive profile management:

- **Job Experiences** — Company, title, dates, description, achievements
- **Project Experiences** — Name, description, technologies, URL, achievements
- **Skills** — Technical skills array
- **Education** — School, degree, field, graduation date
- **Achievements** — Awards, certifications, notable accomplishments
- **Languages & Certifications** — Programming languages, certificates

### C — Resume Management

1. **Resume Analysis**
   - AI analyzes existing resume against job description
   - Identifies strengths and gaps
   - Suggests missing keywords/experiences

2. **Tailored Resume Generation**
   - Generate perfectly fit version for specific job description
   - Highlights relevant experience and achievements
   - Maintains authenticity while maximizing relevance

3. **AI Fit Score**
   - Sub-agent evaluates resume against job requirements
   - Scores 0-100 with detailed breakdown
   - Identifies key advantages

4. **Resume Versions**
   - Track all generated versions
   - Compare changes between versions
   - User can request specific or general modifications

### D — Interview Preparation

1. **Interview Type Selection**
   - Behavioral interviews
   - Technical interviews
   - System design interviews
   - Case study interviews

2. **Question Generation**
   - AI generates relevant questions based on resume + job description
   - Tailored to company and role

3. **Answer Polishing**
   - User provides initial answer
   - AI helps polish to high-score response
   - Based on resume experiences, achievements, and job requirements

4. **Q&A Organization**
   - Organized list of questions and polished answers
   - Exportable for review
   - Track preparation progress

---

## Resume Fit Scoring

The fit score system uses a sub-agent approach:

1. **Extract Requirements** — Parse job description for key requirements
2. **Analyze Resume** — Match against user profile and existing resume
3. **Calculate Score** — 0-100 based on:
   - Skills match percentage
   - Experience relevance
   - Achievement alignment
   - Keyword presence
4. **Generate Feedback** — Detailed breakdown of strengths and gaps

---

## Interview System

### Workflow

```
Select Job Description → Choose Interview Type → Generate Questions
                                                       ↓
                                              User Answers Questions
                                                       ↓
                                              AI Polishes Answers
                                                       ↓
                                              Organized Q&A List
```

### Answer Polishing Criteria

- **STAR Method** — Situation, Task, Action, Result structure
- **Achievement Focus** — Quantifiable results and impact
- **Job Relevance** — Directly addresses role requirements
- **Clarity** — Concise, confident, professional language

---

## URL Structure

| Route | Description |
| ----- | ----------- |
| `/` | Landing page |
| `/dashboard` | Main dashboard (auth-gated) |
| `/companies` | Company list and management |
| `/companies/[id]` | Company detail with research data |
| `/profile` | User profile management |
| `/resumes` | Resume list |
| `/resumes/[id]` | Resume detail and versions |
| `/jobs` | Job descriptions list |
| `/jobs/[id]` | Job description detail |
| `/interviews` | Interview sessions |
| `/interviews/[id]` | Interview detail and Q&A |
| `/settings` | User settings |

---

## App Architecture

```
jobhunter/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── layout.tsx                  # Root layout + providers
│   │   ├── globals.css                 # Tailwind + theme
│   │   ├── dashboard/                  # Main dashboard
│   │   ├── companies/                  # Company management
│   │   │   ├── page.tsx                # Company list
│   │   │   └── [id]/page.tsx           # Company detail
│   │   ├── profile/                    # User profile
│   │   ├── resumes/                    # Resume management
│   │   │   ├── page.tsx                # Resume list
│   │   │   └── [id]/page.tsx           # Resume detail
│   │   ├── jobs/                       # Job descriptions
│   │   │   ├── page.tsx                # Job list
│   │   │   └── [id]/page.tsx           # Job detail
│   │   ├── interviews/                 # Interview preparation
│   │   │   ├── page.tsx                # Interview sessions
│   │   │   └── [id]/page.tsx           # Interview detail
│   │   ├── settings/                   # User settings
│   │   └── api/
│   │       ├── auth/[...nextauth]/    # NextAuth handlers
│   │       ├── companies/              # Company CRUD
│   │       ├── scrape/                 # Playwright scraping endpoint
│   │       ├── resumes/                # Resume operations
│   │       └── ai/                     # AI analysis endpoints
│   ├── components/
│   │   ├── ui/                         # ShadCN components
│   │   ├── layout/                     # Shell, Sidebar, Header
│   │   ├── companies/                  # CompanyCard, ImportDialog
│   │   ├── profile/                    # ProfileForm, ExperienceList
│   │   ├── resumes/                    # ResumeCard, VersionHistory
│   │   ├── jobs/                       # JobCard, RequirementsList
│   │   └── interviews/                 # QuestionCard, AnswerEditor
│   ├── lib/
│   │   ├── prisma.ts                   # Prisma client singleton
│   │   ├── anthropic.ts                # Claude AI client
│   │   ├── scraper.ts                  # Playwright utilities
│   │   ├── excel.ts                    # Excel import/export
│   │   └── fit-score.ts                # Resume fit calculation
│   ├── actions/
│   │   ├── companies.ts                # Company operations
│   │   ├── resumes.ts                  # Resume operations
│   │   └── interviews.ts               # Interview operations
│   ├── agents/
│   │   └── fit-score-agent.ts          # Sub-agent for fit scoring
│   └── types/
│       └── index.ts                    # TypeScript types
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   └── scrape-company.ts               # Standalone scraping script
├── context/                            # Project documentation
│   ├── project-overview.md
│   ├── coding-standards.md
│   ├── ai-interaction.md
│   ├── current-feature.md
│   └── features/
└── docs/                               # Generated documentation
```

---

_Last updated: May 2026_