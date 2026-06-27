# Company Table Add Columns

## Overview

Add some columns to the company table and update the related areas in this codebase. By scanning all related functionalities, such as adding a company, adding a batch of companies, the company list, the company view, etc.

## Requirements

- Adding Columns(All Optional in the Company Table):
  - name_en: Text, the English of the company name
  - register_address: Text, the register address of the company
  - register_post_code: Text, the register address of the company
  - province: Text, the province of the company's address
  - city: Text, the city of the company's address
  - district: Text, the district of the company's address
  - company_size: Text, the description of company size
  - establishment_date: Date, yyyy-MM-dd, the company's establishment date, like "1995-01-06"
- All the columns add to the company table directly
- Always use `prisma migrate dev` for schema changes (not `db push`)
- Run `prisma migrate status` before committing to verify migrations are in sync
- Scanning all related functionalities
- Edit each functionality one by one, file by file, step by step, with appropriate test cases
