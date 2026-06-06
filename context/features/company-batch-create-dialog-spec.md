# Company Batch Create Dialog Spec

## Overview

Add batch new Company via a modal dialog. Opens from "Add Batch Company(Excel)" button in top bar.

## Requirements

- Use shadcn Dialog component
- Top bar "Add Batch Company(Excel)" button
- Configure Columns: Mapping Parser Columns to Excel Columns
  - Available Columns-Check to Select
    - Each Column: name, description, format
    - Company Name is required, others are optional
    - Every columns selected are added to the selected & order area
  - Selected & Order - Drag to reorder
    - Support drag the selected column for reordering
    - Support set different column index to each selected column like "A", "B", "AA"
- Set the parsing begin and end row number
- Upload & Preview
  - FileUpload component with drag-and-drop
  - Only support xlsx file and equal or less than 10 MB
- Not exactly same with the screenshorts images, those just for reference

## Reference

- @context/screenshots/dashboar-import-companies-from-excel-1.png
- @context/screenshots/dashboar-import-companies-from-excel-2.png
