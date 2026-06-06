# Current Feature

## Status

In Progress

## Goals

- Add "Add Batch Company(Excel)" button to top bar
- Implement shadcn Dialog with column mapping UI
- Column mapping: check to select from available columns, drag to reorder selected
- Support column index configuration (A, B, AA, etc.)
- Set parsing begin/end row numbers
- File upload with drag-and-drop, xlsx only, ≤10MB
- Preview uploaded file before import

## Notes

- Spec: @context/features/company-batch-create-dialog-spec.md
- References:
  - @context/screenshots/dashboar-import-companies-from-excel-1.png
  - @context/screenshots/dashboar-import-companies-from-excel-2.png
- Company Name is required; other columns (description, stage, etc.) are optional
- Use shadcn Dialog component for modal

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
