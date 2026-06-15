# Fetch Information Research

> **Research Date:** 2026-06-08
> **Project:** WhyJob - Company Information Fetching
> **Goal:** Investigate best practices for fetching company_culture, company_wechat, and job information

---

## Executive Summary

This research explores methods to fetch company information for WhyJob, focusing on three content types defined in our data model:
- **company_culture** - Culture notes about the company
- **company_wechat** - WeChat official account information
- **company_hiring_trends** - Current hiring status and trends

The research addresses technical approaches, AI integration needs, data reuse strategies for multi-user scenarios, and update frequency considerations.

**Key Finding:** The codebase currently has NO scraping infrastructure. The recommended approach is a **tiered hybrid strategy** combining:
1. **Global shared data** for company_culture, company_wechat, company_news (fetch once, reuse globally)
2. **User-private data** for job listings (frequently changing, user-specific)

---

## 1. Current Architecture Analysis

### 1.1 Data Model

The project uses a **Content Table Pattern** for flexible key-value storage:

```prisma
model Content {
  id         String @id @default(cuid())
  sourceType  String  // "profile" | "company" | "job" | "resume" | "interview"
  sourceId    String
  contentType String  // e.g., "company_culture", "company_wechat", "company_news", "company_hiring_trends"
  content     String
  sortOrder   Int     @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Current Company content types** (from project-overview.md):
| contentType | Description |
|-------------|-------------|
| `company_culture` | Culture notes |
| `company_news` | Recent news |
| `company_wechat` | WeChat official account |
| `company_hiring_trends` | Hiring trends |

### 1.2 Current State

**Files Scanned:**
- `prisma/schema.prisma` - Company model with basic fields only (detailed content in Content table)
- `src/actions/companies.ts` - Company CRUD actions (no scraping)
- `src/lib/db/company.ts` - Database helper functions
- `src/lib/` - No scraper or opencli files exist

**Dependencies Found:**
- `xlsx` - Excel parsing (for import)
- `@prisma/client`, `@prisma/adapter-neon` - Database
- **No Playwright or OpenCLI packages installed**

---

## 2. Information Types & Fetching Strategies

### 2.1 Company Culture Information

**Sources:**
- Company "About" page
- Company "Culture" page
- Company "Team" page
- LinkedIn company page

**Characteristics:**
- Static content (changes rarely, maybe quarterly)
- Well-structured on most company websites
- Can be fetched with targeted Playwright navigation

**Fetching Approach:**

| Depth | Method | Tools | Use Case |
|-------|--------|-------|----------|
| Quick | Navigate to `/about` | Playwright | Basic culture info |
| Medium | Navigate to `/about`, `/culture`, `/team` | Playwright | Full culture picture |
| Deep | All of above + LinkedIn + Glassdoor | Playwright + LinkedIn API | Comprehensive |

**Lightweight Solution (No AI):**
```typescript
// Example: Playwright script for culture extraction
async function fetchCompanyCulture(url: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to About page
  await page.goto(`${url}/about`);
  const aboutContent = await page.textContent('main');

  // Navigate to Culture page (if exists)
  await page.goto(`${url}/culture`).catch(() => null);
  const cultureContent = await page.textContent('main').catch(() => '');

  await browser.close();
  return { aboutContent, cultureContent };
}
```

**AI-Assisted Solution:**
```typescript
// Example: Playwright + AI analysis
import { anthropic } from '@/lib/anthropic';

async function fetchAndAnalyzeCulture(url: string) {
  const page = await browser.newPage();
  await page.goto(`${url}/about`);
  const html = await page.content();

  // Use AI to extract and summarize
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Analyze this company about page and extract key culture information:\n\n${html}`
    }]
  });

  return response.content[0].text;
}
```

### 2.2 Company WeChat Information

**Sources:**
- Company website footer (WeChat QR code images)
- Company careers page
- WeChat search (for account verification)

**Characteristics:**
- Often displayed as QR code images (requires OCR or manual entry)
- Some companies mention WeChat ID as text
- Chinese companies commonly have WeChat official accounts

**Fetching Approach:**

| Method | Complexity | Accuracy | Notes |
|--------|------------|----------|-------|
| Text search on page | Low | Medium | Look for "微信", "WeChat", QR code alt text |
| Image OCR | High | High | Use AI vision to read QR code |
| Manual user entry | N/A | High | User scans QR with their phone |

**Lightweight Solution:**
```typescript
async function extractWeChatText(page: Page) {
  // Search for WeChat-related text
  const wechatText = await page.evaluate(() => {
    const body = document.body.innerText;
    const wechatPattern = /微信|WeChat|微信号|wx[a-zA-Z0-9]+/gi;
    return body.match(wechatPattern);
  });
  return wechatText;
}
```

**AI-Assisted Solution (for QR code images):**
```typescript
async function extractWeChatFromQR(page: Page, qrImageUrl: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [{
        type: 'image',
        source: { type: 'url', url: qrImageUrl }
      }, {
        type: 'text',
        text: 'Extract any WeChat ID or account name from this QR code image'
      }]
    }]
  });
  return response.content[0].text;
}
```

### 2.3 Job Information (Hiring Trends)

**Sources:**
- Company careers page (most important)
- LinkedIn Jobs
- Company job posting pages
- Third-party job boards (Indeed, Glassdoor, etc.)

**Characteristics:**
- **Highly dynamic** - changes daily/weeklys
- **User-specific** - different users may want different jobs
- Can include: open positions, hiring velocity, role types

**Fetching Approach:**

| Method | Update Frequency | Complexity | Notes |
|--------|-----------------|------------|-------|
| Initial scrape on add | One-time | Medium | Capture current openings |
| Scheduled re-scrape | Daily/Weekly | High | Need job change detection |
| User-triggered refresh | On-demand | Low | User clicks "Refresh" |

**Important Consideration:**
Unlike culture/wechat (same for all users), job listings are:
1. User-specific (different users track different companies)
2. Highly dynamic (changes frequently)
3. Potentially large volume (100+ job listings per company)

---

## 3. Technical Approaches

### 3.1 Playwright (Structured Automation)

**Best For:**
- Known site structures (careers.company.com, company.com/about)
- Reliable, repeatable extraction
- Form interactions and navigation

**Limitations:**
- CSS selectors can break with site redesigns
- Limited discovery capability
- No AI understanding of content

**Setup:**
```bash
npm install playwright @playwright/test
npx playwright install chromium
```

**Example Structure:**
```typescript
// src/lib/scraper/playwright.ts
import { chromium, Browser, Page } from 'playwright';

export class CompanyScraper {
  private browser: Browser | null = null;

  async init() {
    this.browser = await chromium.launch({ headless: true });
  }

  async scrapeCulturePage(url: string): Promise<string> {
    const page = await this.browser!.newPage();
    await page.goto(`${url}/about`, { timeout: 10000 });
    const content = await page.textContent('body');
    await page.close();
    return content || '';
  }

  async scrapeCareersPage(url: string): Promise<JobListing[]> {
    const page = await this.browser!.newPage();
    // Try common careers paths
    const careersPaths = ['/careers', '/jobs', '/career', '/join-us'];
    // ... scrape logic
  }

  async close() {
    await this.browser?.close();
  }
}
```

### 3.2 OpenCLI (AI-Driven Browsing)

**Best For:**
- Unfamiliar site structures
- Discovery of content not in obvious locations
- Handling complex, dynamic content
- Natural language extraction

**Concept:**
OpenCLI uses AI to navigate websites, find relevant content, and extract information based on natural language prompts.

**Comparison with Playwright:**

| Aspect | Playwright | OpenCLI |
|--------|------------|---------|
| Speed | Fast | Slower (AI processing) |
| Reliability | High (deterministic) | Variable |
| Discovery | Manual path finding | AI-guided |
| Cost | Compute only | API calls |
| Setup | More code | Natural language prompts |

**Note:** OpenCLI is a product from Context7 (context7.com). It provides an SDK for AI-driven web browsing.

### 3.3 Recommended: Tiered Hybrid Approach

Given the different characteristics of the three content types, recommend a **tiered approach**:

```typescript
// Architecture Overview
interface FetchStrategy {
  contentType: 'company_culture' | 'company_wechat' | 'company_hiring_trends' | 'job_listing';
  fetchMethod: 'playwright' | 'opencli' | 'manual' | 'hybrid';
  updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'on-demand';
  sharedGlobal: boolean;  // Same data for all users?
}
```

**Recommended Configuration:**

| Content Type | Method | Update Frequency | Shared Global |
|--------------|--------|------------------|---------------|
| company_culture | Playwright (scoped paths) | Weekly | **Yes** |
| company_wechat | Manual entry + Playwright OCR | Monthly | **Yes** |
| company_news | OpenCLI web search | Daily | **Yes** |
| company_hiring_trends | Playwright careers page | Daily | Per-company |
| job_listings | Playwright + user trigger | On-demand | No (user-private) |

---

## 4. AI Integration Analysis

### 4.1 When AI Is Needed

| Task | AI Required? | Reason |
|------|--------------|--------|
| Navigate to `/about` page | No | Simple URL construction |
| Extract text from page | No | Playwright can textContent() |
| Find "About" link on unknown page | Yes | Requires page analysis |
| Parse QR code image | Yes | Requires vision model |
| Summarize culture from 10 pages | Yes | Requires understanding |
| Extract job listings from dynamic JS | Maybe | Depends on structure |
| Find WeChat on page with 100 elements | Yes | Requires visual/AI analysis |

### 4.2 AI Models Available

**In This Project:**
- **Claude (Anthropic)** - Already in stack per project-overview.md

**Use Cases for Claude:**
1. **Page summarization** - Convert long about pages to culture notes
2. **Structure extraction** - Parse unstructured text into JSON
3. **Image analysis** - Read QR codes from images
4. **Discovery** - Find relevant pages on unknown sites

### 4.3 Lightweight Enterprise Solution

For a lightweight approach without heavy AI costs:

**Option A: Pure Playwright (No AI)**
```
Pros: Fast, cheap, reliable
Cons: Limited discovery, brittle selectors
Best For: company_culture on well-known sites
```

**Option B: Playwright + Claude API (On-demand)**
```
Pros: AI when needed, fallback to pure scraping
Cons: API costs per scrape
Best For: Complex sites requiring discovery
```

**Option C: OpenCLI (Full AI Browsing)**
```
Pros: Most flexible, handles any site
Cons: Most expensive, slower
Best For: Unknown site structures, research mode
```

**Recommendation:** Start with **Option B** - use Playwright for structured scraping, invoke Claude only when:
- Page structure is unknown (AI discovery needed)
- Content requires summarization (culture pages)
- Image analysis required (QR codes)

This balances cost and capability.

---

## 5. Multi-User Data Reuse Strategy

### 5.1 The Problem

When multiple users add the **same company**:
- Culture information is **identical** for all users → should fetch once, share globally
- WeChat information is **identical** for all users → should fetch once, share globally
- Job listings are **user-specific** (different users track different jobs)

### 5.2 Solution: Global vs User-Private Data Model

**Option A: Content Table with `isGlobal` Flag**

```prisma
model Content {
  id         String @id @default(cuid())
  sourceType  String
  sourceId    String  // If null, this is global content
  contentType String
  content     String
  isGlobal    Boolean @default(false)  // NEW: Global vs user-private
  userId      String? // If set, user-private; if null, global
  // ... other fields
}
```

**Option B: Separate GlobalCompany Table**

```prisma
model GlobalCompany {
  id         String @id @default(cuid())
  name       String @unique
  website    String?
  // Global content stored in GlobalContent table
  createdAt  DateTime @default(now())
  lastScraped DateTime?
}

model GlobalContent {
  id           String @id @default(cuid())
  globalCompanyId String
  contentType  String
  content      String
  lastUpdated  DateTime @default(now())
}
```

**Option C: User-Private with Cache (Simplest)**

```prisma
model Content {
  // Current model - just add cached/expires fields
  cachedAt    DateTime?
  expiresAt   DateTime?
}
```

### 5.3 Recommended Approach

**Recommendation: Hybrid Caching with Global Fetch Queue**

```
1. User adds company "Example Corp"
2. Check if "Example Corp" has global scraped data (by website domain)
3. If YES: Copy global content to user's Content entries
4. If NO:
   a. Queue "Example Corp" for global scraping
   b. User sees "Scraping in progress..."
   c. Background job scrapes (once, shared)
   d. All users with "Example Corp" get updated
```

**Implementation:**
```typescript
// src/lib/scraper/global-queue.ts
interface ScrapeJob {
  companyId: string;
  companyName: string;
  website: string;
  contentTypes: string[];
  priority: 'high' | 'low';
  status: 'pending' | 'scraping' | 'completed' | 'failed';
}

// Global scrape queue (could use Redis or database table)
// Scrape once, populate global data
// Users copy from global to their private content
```

### 5.4 Job Listing Special Case

Job listings are **user-private** and **highly dynamic**:

```typescript
// Jobs are NOT shared globally - each user has their own view
model UserJobListing {
  id            String @id @default(cuid())
  userId        String
  companyId     String
  title         String
  url           String?
  scrapedAt     DateTime @default(now())
  isActive      Boolean @default(true)  // Detect if job was removed
}

// Scheduled job detects changes:
// - New job appeared → notify user
// - Old job no longer appears → mark isActive=false
```

**Update Strategy:**
| Data Type | Update Trigger | Method |
|-----------|---------------|--------|
| company_culture | Weekly cron | Playwright → store globally |
| company_wechat | Monthly cron | Playwright + OCR → store globally |
| company_news | Daily cron | OpenCLI web search → store globally |
| job_listings | Daily cron + user refresh | Playwright careers page → user-private |

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Start Here)
- [ ] Install Playwright (`npm install playwright`)
- [ ] Create `src/lib/scraper/company-scraper.ts`
- [ ] Implement basic page navigation
- [ ] Add content extraction helpers

### Phase 2: AI Integration
- [ ] Connect Claude API for page summarization
- [ ] Implement culture extraction with AI summarization
- [ ] Add QR code image analysis for WeChat

### Phase 3: Global Data Sharing
- [ ] Add `isGlobal` flag to Content model
- [ ] Create global scrape queue
- [ ] Implement background scrape jobs
- [ ] Add cache invalidation logic

### Phase 4: Job Listings (User-Private)
- [ ] Implement careers page scraper
- [ ] Create user-private job listings
- [ ] Add scrape-on-demand functionality
- [ ] Implement change detection (new/removed jobs)

---

## 7. Key Decisions Required

Before implementation, the following decisions need clarification:

### 7.1 Global vs User-Private for Culture/WeChat
**Question:** Should culture/wechat be shared globally (one fetch, all users see) or user-private (each user fetches their own)?

**Recommendation:** **Shared globally** - these are factual company attributes that don't vary by user.

### 7.2 Scrape Depth Defaults
**Question:** What should be the default scrape depth for companies?

Options:
- **Quick** (default): /about page only, ~5 seconds
- **Medium**: /about, /careers, ~30 seconds
- **Deep**: Full AI-powered research, ~5 minutes

**Recommendation:** Start with **Quick** as default, allow user to trigger deeper scrapes.

### 7.3 Update Frequency
**Question:** How often should global data (culture, wechat, news) be refreshed?

Options:
- **Aggressive**: Refresh on every user visit (high cost)
- **Daily**: Cron job daily (moderate cost)
- **Weekly**: Cron job weekly (low cost)
- **Manual**: User-triggered only (zero auto-cost)

**Recommendation:** **Weekly for culture/wechat**, **daily for news**.

### 7.4 Job Listing Scope
**Question:** Should job listings be scraped for ALL companies a user has, or only "active" companies?

**Recommendation:** Only scrape for companies where user has enabled job tracking.

---

## 8. Risk Considerations

| Risk | Mitigation |
|------|------------|
| Website blocks scraping | Add delays, rotate user agents, use OpenCLI for stealth |
| Site structure changes | AI-powered extraction, fallback to manual |
| AI costs spiral | Caching, weekly refresh, global sharing |
| WeChat QR codes unreadable | Allow manual entry as fallback |
| Job listings stale | Show "last updated" timestamp, clear visual indicator |

---

## 9. Summary

### What Was Discovered

1. **No scraping infrastructure exists** in the codebase
2. **Content table pattern** already defined for flexible content storage
3. **Three distinct content types** with different characteristics:
   - company_culture: Static, shareable globally
   - company_wechat: Static but hard to auto-extract, shareable globally
   - company_hiring_trends/job_listings: Dynamic, user-private

4. **Multiple technical approaches available**:
   - Pure Playwright (lightweight, fast, brittle)
   - Playwright + Claude (balanced)
   - OpenCLI (powerful but expensive)

### Recommended Approach

**Hybrid tiered strategy:**
1. **Company Culture/WeChat/News**: Global shared data, weekly refresh, Playwright + AI
2. **Job Listings**: User-private, on-demand scrape, with daily background refresh option
3. **Use caching aggressively** to minimize API calls
4. **Start with Playwright-only**, add OpenCLI later if needed for complex sites

### Sources Consulted
- `prisma/schema.prisma` - Data model analysis
- `src/actions/companies.ts` - Current company action patterns
- `src/lib/db/company.ts` - Database helper patterns
- `context/project-overview.md` - Planned scraping architecture
- Web search for Playwright and OpenCLI best practices