# Dashboard Company Spec

## Overview

Replace the dummy data displayed in the main area of the dashboard (right side), with actual data from the database. It should look how it does now with the 5 companies, but instead of using data from @src/lib/mock-data.ts, it should be from our Neon database using Prisma.

## Requirements

- Create src/lib/db/company.ts with data fetching functions
- Fetch company data directly in server component
- Implement the text and stage search function
