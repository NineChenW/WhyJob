# Company Batch Create Spec

## Overview

Implement the batch create companies functionality of `@src/components/companies/batch-import-companies-dialog.tsx`. Parsing the Excel file and structuring the data to add batch companies.

## Requirements

- Server action `createBatchCompanies` with Zod validation
- Query function `queryCompanyByNames` in `lib/db/company.ts.`
  - Used to check the company's uniqueness for this user range
- Save function `createBatchCompanies` in `lib/db/company.ts.`
  - Limited to 10 companies at once, with a transaction
- Implementation
  - Logic check: Toast the error message with the specific row number and column number if needed
    - Ensure there is existing content in the upload file between the parsing begin and end row numbers.
    - Based on the selected column's format, ensure there is existing and correct format content in the configured index column of the upload file.
  - Process: asynchronous process, response to the user after logic check
    - Stream read from the upload file
    - Only pick the selected column's content, and structure each row into a company type instance
    - Every time got 10 company-type instances or reached the configured end row number
      - Do the user company's unique check, and filter out the existing instances
      - If there are still legal data, do the batch insert DB operation
    - Reached the configured end row number, end the process
- Toast on success, close the modal, and refresh
