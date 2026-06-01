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

# Current Feature: Company View

## Status

In Progress

## Goals

- Main area to the right of the sidebar showing company detail view
- Company header with icon, title, short description, and tags
- Edit and delete buttons on the right end of the header
- Tracking columns showing all tracked company data
- Tabbed information area with: Basic Information, Official Website, Company Culture, Recent Job Posting

## Notes

- Use mock data from `@src/lib/mock-data.ts` (import `mockCompanies`, `mockCompanyContents`)
- Reference screenshots: `@context/screenshots/dashboard-view-company-1.png` and `dashboard-view-company-2.png`
- Full spec: `@context/features/company-view-spec.md`

## History

<!--
Keep this updated.
Earliest to latest.
-->

- **2026-05-26**: Initial Next.js and Tailwind CSS v4 setup
- **2026-05-27**: Dashboard UI Phase 1
- **2026-06-01**: Dashboard UI Phase 2 - collapsible sidebar with Profile menu, company list, search input, tag filter, drawer icon, and mobile drawer
