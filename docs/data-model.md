# Data Model Design

## Overview

This document describes the redesigned data models for WhyJob, introducing a flexible **Content** table pattern for scalable content storage.

## Design Principles

1. **Separation of Concerns**: Core entity tables (Profile, Company, JobDescription, etc.) focus on their primary purpose. Detailed content is stored in the Content table.

2. **Content Extensibility**: New content types can be added without schema migrations. Each content_type has a corresponding parser.

3. **Ordering**: Content entries support `sort_order` for flexible ordering of items within a category.

4. **Audit Trail**: All content entries have `createdAt` and `updatedAt` timestamps.

---

## Data Models

### User

```prisma
model User {
  id                   String       @id @default(cuid())
  name                 String?
  email                String?      @unique
  emailVerified        DateTime?
  image                String?
  password             String?
  isPro                Boolean      @default(false)
  stripeCustomerId     String?      @unique
  stripeSubscriptionId String?      @unique
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  accounts        Account[]
  sessions        Session[]
  profile         Profile?
  companies       Company[]
  jobDescriptions JobDescription[]
  resumes         Resume[]
  interviews      Interview[]
}
```

### Profile

Stores user resume/master data. The profile itself contains only the user relation and metadata. All resume-related content (job experiences, project experiences, education, skills, etc.) is stored in the Content table.

```prisma
model Profile {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  contents  Content[]
}
```

### Company

Stores company information. Core metadata (name, website, industry, size, stage, headquarters) stays on the Company record. Extended content (culture, recent news, wechat account) moves to Content.

```prisma
model Company {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name         String
  website      String?
  industry     String?
  size         String?
  stage        String?
  headquarters String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  jobDescriptions JobDescription[]
  contents        Content[]
}
```

### JobDescription

Stores job postings. The job record keeps title, URL, and the full text content. Structured fields (requirements, responsibilities, salary, location) move to Content.

```prisma
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
```

### Resume

Stores generated resumes tailored for specific jobs. The main resume record tracks metadata; resume content sections are stored in Content.

```prisma
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
```

### ResumeVersion

Stores versions of a resume for tracking changes.

```prisma
model ResumeVersion {
  id         String   @id @default(cuid())
  resumeId   String
  resume     Resume   @relation(fields: [resumeId], references: [id], onDelete: Cascade)

  content     String
  changeNotes String?
  fitScore    Float?

  createdAt DateTime @default(now())
}
```

### Interview

Stores interview sessions. Questions are stored as individual Content entries.

```prisma
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
```

### Content

The Content table is a flexible key-value store for all detailed content. Each entry has:

- `sourceType`: The category of the parent entity (profile, company, job, resume, interview)
- `sourceId`: The ID of the parent entity
- `contentType`: The type of content (determines which parser to use)
- `content`: The actual content (string)
- `sortOrder`: Position within the parent (default 1)

```prisma
model Content {
  id         String   @id @default(cuid())

  sourceType String  // "profile" | "company" | "job" | "resume" | "interview"
  sourceId   String
  contentType String // Content template type

  content   String
  sortOrder Int      @default(1)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([sourceType, sourceId])
}
```

---

## Content Types Reference

### Profile Content Types

| contentType | Description | Example Parser |
|------------|-------------|---------------|
| `profile_summary` | Professional summary | TextParser |
| `profile_skill` | Skills (technical, soft, languages) | JsonParser |
| `job_experience` | Work history entry | JobExperienceParser |
| `project_experience` | Project entry | ProjectExperienceParser |
| `education` | Education entry | EducationParser |
| `achievement` | Achievement entry | AchievementParser |
| `certification` | Certification entry | CertificationParser |

### Company Content Types

| contentType | Description | Example Parser |
|------------|-------------|---------------|
| `company_culture` | Culture notes | TextParser |
| `company_news` | Recent news | TextParser |
| `company_wechat` | WeChat account | TextParser |
| `company_hiring_trends` | Hiring trends | TextParser |

### Job Content Types

| contentType | Description | Example Parser |
|------------|-------------|---------------|
| `job_requirement` | Job requirement | TextParser |
| `job_responsibility` | Job responsibility | TextParser |
| `job_salary` | Salary range | TextParser |
| `job_location` | Job location | TextParser |
| `job_remote_policy` | Remote work policy | TextParser |

### Resume Content Types

| contentType | Description | Example Parser |
|------------|-------------|---------------|
| `resume_summary` | Resume summary section | TextParser |
| `resume_experience` | Experience section | ResumeExperienceParser |
| `resume_skills` | Skills section | JsonParser |
| `resume_education` | Education section | ResumeEducationParser |

### Interview Content Types

| contentType | Description | Example Parser |
|------------|-------------|---------------|
| `interview_question` | Interview question | QuestionParser |
| `interview_answer` | User's answer | TextParser |
| `interview_polished_answer` | AI-polished answer | TextParser |
| `interview_feedback` | AI feedback on answer | TextParser |

---

## Content Parser Interface

Each `contentType` has a corresponding parser that handles serialization/deserialization:

```typescript
interface ContentParser<T> {
  parse(content: string): T;
  serialize(data: T): string;
}

// Example implementations
class JobExperienceParser implements ContentParser<JobExperience> {
  parse(content: string): JobExperience {
    return JSON.parse(content);
  }
  serialize(data: JobExperience): string {
    return JSON.stringify(data);
  }
}

class TextParser implements ContentParser<string> {
  parse(content: string): string {
    return content;
  }
  serialize(data: string): string {
    return data;
  }
}
```

---

## Migration Strategy

To migrate from the current schema:

1. **Create new tables** with the new schema (Profile without JSON fields, Company without content fields, etc.)

2. **Create Content table** with indexes on (sourceType, sourceId)

3. **Migrate data** by converting JSON fields to Content entries:
   - Profile.jobExperiences → Content entries with contentType="job_experience"
   - Company.culture → Content with contentType="company_culture"
   - etc.

4. **Deploy parsers** for each contentType

5. **Update application code** to use Content table via helper methods

---

## API Patterns

### Fetching Content

```typescript
// Helper to get all content for a parent entity
async function getProfileContents(profileId: string) {
  return prisma.content.findMany({
    where: {
      sourceType: 'profile',
      sourceId: profileId
    },
    orderBy: { sortOrder: 'asc' }
  });
}

// Helper to get content by type
async function getProfileSkills(profileId: string) {
  const skillContent = await prisma.content.findFirst({
    where: {
      sourceType: 'profile',
      sourceId: profileId,
      contentType: 'profile_skill'
    }
  });
  return skillContent ? JSON.parse(skillContent.content) : null;
}
```

### Creating Content

```typescript
async function addJobExperience(
  profileId: string,
  experience: JobExperience,
  sortOrder: number
) {
  return prisma.content.create({
    data: {
      sourceType: 'profile',
      sourceId: profileId,
      contentType: 'job_experience',
      content: JSON.stringify(experience),
      sortOrder
    }
  });
}
```

---

## Benefits of This Design

1. **Scalability**: Each content type can grow independently without schema changes.

2. **Flexibility**: New content types can be added by simply creating new `contentType` values and a corresponding parser.

3. **Ordering**: `sortOrder` allows fine-grained control over content sequence.

4. **Query Performance**: Indexed (sourceType, sourceId) enables fast lookups.

5. **Parser Pattern**: Each content type has a dedicated parser that handles validation and transformation.

6. **Auditability**: All content changes are tracked via `updatedAt`.

---

_Last updated: May 2026_