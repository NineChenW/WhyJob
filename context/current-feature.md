# Update Rules

!!! Read this before update. !!!
Do not violate any following rules:

1. Please keep all the comments stay the same.
2. Do not delete the existing history records.
3. Only add a new history record at the end of this file after a feature is stetted completed.
4. Fill the current feature area with the current active feature title.
5. Update status to "In Progress" when starting a new feature.
6. Update status to "Completed" when finishing a feature.
7. Update goals section with current feature requirements.
8. Update notes section with current feature references.

# Current Feature: Company Create (Modal Dialog)

## Status

Completed

## Goals

- Implement "New Company" button in the dashboard top bar that opens a shadcn Dialog modal
- Create form in modal with:
  - Company Name (required field)
  - Description field
  - Tags (stage) selection
  - Information to Track (multiple selections allowed, mapped to company content types)
- Implement server action `createCompany` with Zod input validation
- Add database save function `createCompany` in `src/lib/db/company.ts`
- Show toast notification on successful creation, close modal, and refresh company list
- Follow existing patterns for server actions and database operations

## Notes

- Uses shadcn/ui Dialog component
- Follows Content table pattern for company content types
- References: @context/screenshots/dashboard-add-company-1.png, @context/screenshots/dashboard-add-company-2.png

## History

<!--
Keep this updated.
Earliest to latest.
-->

- **2026-05-26**: Initial Next.js and Tailwind CSS v4 setup
- **2026-05-27**: Dashboard UI Phase 1
- **2026-06-01**: Dashboard UI Phase 2 - collapsible sidebar with Profile menu, company list, search input, tag filter, drawer icon, and mobile drawer
- **2026-06-01**: Company View Phase 1 - company detail page with header, tracking columns, and tabbed information area
- **2026-06-02**: Prisma + Neon PostgreSQL Setup - complete database setup with Prisma ORM, Neon serverless PostgreSQL, initial schema with all models, migrations, and database test script
- **2026-06-03**: Database Seed Script - fully independent seed script with realistic development data (5 companies, 4 jobs, resumes, interviews), Prisma 7 config, and comprehensive test suite
- **2026-06-04**: Dashboard Company Spec - replace dummy collection data with actual database data, create data fetching functions, implement text and stage search via server actions
- **2026-06-05**: Company Create (Modal Dialog) - implement "New Company" button with shadcn Dialog modal, form with Company Name, Description, Stage, and Information to Track, server action with Zod validation, database save function, and toast notifications
