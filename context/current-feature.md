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

# Current Feature: Database Seed Script

## Status

In Progress

## Goals

- Create a seed script (`prisma/seed.ts`) to populate the database with sample data for development and demos
- Base the seed data on the database schema (`prisma/schema.prisma`) and existing mock data (`src/lib/mock-data.ts`)
- Include test cases to ensure the script works correctly with the database schema

## Notes

### References

- @context/project-overview.md
- @src/lib/mock-data.ts
- @prisma/schema.prisma
- Prisma docs: https://prisma.io/docs (Prisma 7 has breaking changes - use latest documentation)

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
