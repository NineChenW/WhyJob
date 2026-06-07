import * as XLSX from "xlsx";
import { writeFileSync } from "fs";

// Sample company data for testing
const companies = [
  {
    name: "TechCorp Inc.",
    description: "Leading AI startup building innovative solutions",
    website: "https://techcorp.example.com",
    industry: "Technology",
    size: "51-200",
    stage: "Series B",
    headquarters: "San Francisco, CA",
  },
  {
    name: "HealthFirst Medical",
    description: "Digital health platform improving patient care",
    website: "https://healthfirst.example.com",
    industry: "Healthcare",
    size: "201-500",
    stage: "Series A",
    headquarters: "Boston, MA",
  },
  {
    name: "GreenEnergy Solutions",
    description: "Renewable energy company focused on solar",
    website: "https://greenenergy.example.com",
    industry: "Energy",
    size: "11-50",
    stage: "Series A",
    headquarters: "Austin, TX",
  },
  {
    name: "FinanceHub",
    description: "Modern fintech platform for SMBs",
    website: "https://financehub.example.com",
    industry: "Finance",
    size: "51-200",
    stage: "Series C",
    headquarters: "New York, NY",
  },
  {
    name: "EduLearn Platform",
    description: "Online learning platform for professionals",
    website: "https://edulearn.example.com",
    industry: "Education",
    size: "11-50",
    stage: "Startup",
    headquarters: "Seattle, WA",
  },
];

// Create workbook
const workbook = XLSX.utils.book_new();

// Create header row
const headerRow = ["name", "description", "website", "industry", "size", "stage", "headquarters"];

// Create data rows (header + companies)
const data = [headerRow, ...companies.map((c) => [
  c.name,
  c.description,
  c.website,
  c.industry,
  c.size,
  c.stage,
  c.headquarters,
])];

// Convert to worksheet
const worksheet = XLSX.utils.aoa_to_sheet(data);

// Set column widths for better readability
worksheet["!cols"] = [
  { wch: 20 }, // name
  { wch: 45 }, // description
  { wch: 35 }, // website
  { wch: 15 }, // industry
  { wch: 12 }, // size
  { wch: 12 }, // stage
  { wch: 20 }, // headquarters
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, "Companies");

// Write to file
writeFileSync("test-batch-import.xlsx", XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));

console.log("Created test-batch-import.xlsx with 5 sample companies");
console.log("\nColumn mapping for test:");
console.log("  A = name (required)");
console.log("  B = description");
console.log("  C = website");
console.log("  D = industry");
console.log("  E = size");
console.log("  F = stage");
console.log("  G = headquarters");
console.log("\nRow settings for test:");
console.log("  Start Row: 1");
console.log("  End Row: 6 (leave empty for all)");