# Current Feature: Company Batch Create

## Status

Complete

## Goals

- Implement server action `createBatchCompanies` with Zod validation
- Create query function `queryCompanyByNames` in `lib/db/company.ts` to check company uniqueness for user
- Create save function `createBatchCompanies` in `lib/db/company.ts` (limited to 10 companies at once, with transaction)
- Implement parsing and processing logic:
  - Toast error messages with specific row and column numbers for validation failures
  - Ensure existing content between configured begin and end row numbers
  - Validate column format and content based on selected column configuration
- Implement asynchronous processing:
  - Stream read from upload file
  - Pick selected column content and structure each row into company type instance
  - Batch process in chunks of 10 or at end row:
    - Check user company uniqueness and filter existing instances
    - Batch insert legal data to DB
- Toast on success, close modal, and refresh

## Notes

- Server action should handle Zod validation
- Database operations must use transactions for batch inserts
- Limited to 10 companies per batch operation
- Need to handle Excel file parsing and column mapping
- Error messages should be specific (row/column level)

## History

- **2026-05-26**: Initial Next.js and Tailwind CSS v4 setup
- **2026-05-27**: Dashboard UI Phase 1
- **2026-05-27**: Dashboard UI Phase 2 - collapsible sidebar with Profile menu, company list, search input, tag filter, drawer icon, and mobile drawer
- **2026-06-01**: Company View Phase 1 - company detail page with header, tracking columns, and tabbed information area
- **2026-06-02**: Prisma + Neon PostgreSQL Setup - complete database setup with Prisma ORM, Neon serverless PostgreSQL, initial schema with all models, migrations, and database test script
- **2026-06-03**: Database Seed Script - fully independent seed script with realistic development data (5 companies, 4 jobs, resumes, interviews), Prisma 7 config, and comprehensive test suite
- **2026-06-04**: Dashboard Company Spec - replace dummy collection data with actual database data, create data fetching functions, implement text and stage search via server actions
- **2026-06-05**: Company Create (Modal Dialog) - implement "New Company" button with shadcn Dialog modal, form with Company Name, Description, Stage, and Information to Track, server action with Zod validation, database save function, and toast notifications
- **2026-06-05**: Company Description Field - add `description` field to Company model in Prisma schema, update `createCompany` action to save directly to Company table instead of as Content entry, apply database migration
- **2026-06-06**: Company Batch Import Dialog - implement 3-step wizard for Excel import with column mapping, drag-and-drop reordering, file upload, and preview
- **2026-06-07**: Company Batch Create - implement server action `batchImportCompanies` with Zod validation, query function `queryCompanyByNames`, save function `createBatchCompanies` (10-limit, transaction), Excel parsing with column mapping, error toast with row numbers, and batch import working end-to-end