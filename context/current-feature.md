# Current Feature: Company Table Add Columns

## Status
Complete

## Goals

- Scan ALL related functionalities in the codebase ✓ (completed)
- Add new columns to Company table via Prisma migration ✓:
  - `name_en`: Text (English name)
  - `register_address`: Text (registered address)
  - `register_post_code`: Text (postal code)
  - `province`: Text
  - `city`: Text
  - `district`: Text
  - `company_size`: Text (size description)
  - `establishment_date`: Date (yyyy-MM-dd format)
  - `enterprise_type`: Text (enterprise type like LLC, Corporation)
- Update create-company dialog: remove collapsible "Advanced Information" section, show all fields directly, add scrolling, add enterprise_type field ✓
- Update ALL related functionalities discovered during the scan ✓
- Ensure all changes use `prisma migrate dev` ✓
- Run `prisma migrate status` before committing ✓
- Build passes ✓

## Notes

- All columns are optional
- Columns added directly to company table (not Content table pattern)
- Must comprehensively scan all related code areas before implementing
- Update each functionality one by one, file by file, step by step

## Files to Update (Scanned)

### Priority 1 - Database
| File | Reason |
|------|--------|
| `prisma/schema.prisma` | Add columns to Company model |
| `prisma/seed.ts` | Add seed data for new columns |

### Priority 2 - Types & Schemas
| File | Reason |
|------|--------|
| `src/schemas/company.ts` | Add to `companyColumnSchema` enum for batch import |
| `src/lib/db.types.ts` | Add TypeScript interface fields |
| `src/lib/db/company.ts` | Add to DB helper functions |

### Priority 3 - Components & Actions
| File | Reason |
|------|--------|
| `src/components/companies/batch-import-companies-dialog.tsx` | Add to AVAILABLE_COLUMNS UI |
| `src/components/companies/create-company-dialog.tsx` | Add form fields |
| `src/components/companies/company-list.tsx` | Add display columns |
| `src/components/companies/company-view.tsx` | Add display fields |
| `src/actions/companies.ts` | Add to server actions |

### Priority 4 - Mock/Seed Data
| File | Reason |
|------|--------|
| `src/lib/mock-data.ts` | Add mock data |

## History

- **2026-06-08**: Company Table Add Columns - Add 8 new columns to Company table (name_en, register_address, register_post_code, province, city, district, company_size, establishment_date), update create-company dialog with collapsible advanced section, batch-import dialog with all new columns, company-view BasicInfoSection with all fields, server actions with new fields, Zod schemas, TypeScript interfaces, mock data, and seed data
- **2026-06-08**: Add enterprise_type column and improve create-company dialog - add enterprise_type column to Company table, remove collapsible "Advanced Information" section from dialog, show all fields directly with scrolling, add enterprise_type to all related files (batch import, company view, schemas, mock data)
- **2026-05-26**: Initial Next.js and Tailwind CSS v4 setup
- **2026-05-27**: Dashboard UI Phase 1
- **2026-05-27**: Dashboard UI Phase 2 - collapsible sidebar with Profile menu, company list, search input, tag filter, drawer icon, and mobile drawer
- **2026-06-01**: Company View Phase 1 - company detail page with header, tracking columns, and tabbed information area
- **2026-06-02**: Prisma + Neon PostgreSQL Setup - complete database setup with Prisma ORM, Neon serverless PostgreSQL, initial schema with all models, migrations, and database test script
- **2026-06-03**: Database Seed Script - fully independent seed script with realistic development data (5 companies, 4 jobs, resumes, interviews), Prisma 7 config, and comprehensive test suite
- **2026-06-04**: Dashboard Company Spec - replace dummy collection data with actual database data, create data fetching functions, implement text and stage search via server actions
- **2026-06-05**: Company Create (Modal Dialog) - implement "New Company" button with shadcn Dialog modal, form with Company Name, Description, Stage, and Information to Track, server action with Zod validation, database save function, and toast notifications
- **2026-05-06**: Company Description Field - add `description` field to Company model in Prisma schema, update `createCompany` action to save directly in table instead of as Content entry, apply database migration
- **2026-06-06**: Company Batch Import Dialog - implement 3-step wizard for Excel import with column mapping, drag-and-drop reordering, file upload, and preview
- **2026-06-07**: Company Batch Create - implement server action `batchImportCompanies` with Zod validation, query function `queryCompanyByNames`, save function `createBatchCompanies` (10-limit, transaction), Excel parsing with column mapping, error toast with row numbers, and batch import working end-to-end