# Whole Process

## Make the prototype

I want to build a AI-powered hub in React to manage your job search: company research.
Here are the requirements:

FEATURES:
Create, edit, and delete the following company records.
By manul input a simple name, more detailed information of the company ,or import Excel files
With custom tags
Choose multiple types information of the company to gather and save, like basic information, official website, WeChat official accounts, culture, and newly published jobs.
Search functionality to filter following company records.
Dark/light mode toggle

TECHNICAL REQUIREMENTS:

- Use React with functional components and hooks
- Use react-markdown for preview rendering
- Responsive design (mobile-friendly sidebar)
- Clean, modern UI with Tailwind v4

STRUCTURE:

- Break UI into separate components where it makes sense

Edit:

## Mock Data

We need a single source of truth for mock data to use until we implement a database. Read @context/project-overview.md and look at @context/screenshots/dashboard-ui-main.png.

Create a new file at src/lib/mock-data.ts and create a simple data structure for the dashboard UI. It should include items, collections, item types and a user for the current logged in user.
