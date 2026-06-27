# Company Create Spec

## Overview

Add new Company via a modal dialog. Opens from "New Company" button in top bar.

## Requirements

- Use shadcn Dialog component
- Company Name(required), Description, Tags(stage)
- Information to Track(Multiple selections allowed), related with company's content
- Server action `createCompany` with Zod validation
- Save function `createCompany` in `src/lib/db/company.ts`
- Toast on success, close modal and refresh

## Reference

- @context/screenshots/dashboard-add-company-1.png
- @context/screenshots/dashboard-add-company-2.png
