"use server";

import { z } from "zod";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import type { Company, Content } from "@prisma/client";
import {
  createCompanySchema,
  type CreateCompanyInput,
  batchImportCompaniesSchema,
  type BatchImportCompaniesInput,
  type ColumnMapping,
} from "@/schemas/company";

const searchCompaniesSchema = z.object({
  query: z.string().optional(),
  stage: z.string().optional(),
});

export type SearchCompaniesInput = z.infer<typeof searchCompaniesSchema>;

/**
 * Search companies by text and stage (server action)
 */
export async function searchCompanies(input: SearchCompaniesInput): Promise<Company[]> {
  // Validate input
  const validatedInput = searchCompaniesSchema.parse(input);

  const { query, stage } = validatedInput;
  const userId = await getCurrentUserId();

  const where: any = { userId };

  if (query && query.trim() !== "") {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
{ industry: { contains: query, mode: "insensitive" } },
      { headquarters: { contains: query, mode: "insensitive" } },
    ];
  }

  if (stage) {
    where.stage = stage;
  }

  return prisma.company.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get all companies for current user
 */
export async function getCompanies(): Promise<Company[]> {
  const userId = await getCurrentUserId();
  return prisma.company.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a company by ID for current user
 */
export async function getCompanyById(id: string): Promise<Company | null> {
  const userId = await getCurrentUserId();
  return prisma.company.findUnique({
    where: { id, userId },
  });
}

/**
 * Get company contents for current user
 */
export async function getCompanyContents(companyId: string): Promise<Content[]> {
  const userId = await getCurrentUserId();
  // Verify the company belongs to the user
  const company = await prisma.company.findUnique({
    where: { id: companyId, userId },
  });
  if (!company) {
    return [];
  }
  return prisma.content.findMany({
    where: { sourceType: "company", sourceId: companyId },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Create a new company (server action)
 */
export async function createCompany(input: CreateCompanyInput): Promise<{ success: boolean; company?: Company; error?: string }> {
  try {
    // Validate input
    const validatedInput = createCompanySchema.parse(input);
    const userId = await getCurrentUserId();

    const { name, description, stage, trackInfo } = validatedInput;

    // Create company in transaction
    const company = await prisma.$transaction(async (tx) => {
      // Create company record
      const newCompany = await tx.company.create({
        data: {
          name,
          description: description || null,
          stage,
          userId,
        },
      });

      // Create content entries for selected track info types
      const contentEntries: { sourceType: "company"; sourceId: string; contentType: string; content: string; sortOrder: number }[] = [];

      if (trackInfo && trackInfo.length > 0) {
        trackInfo.forEach((contentType) => {
          contentEntries.push({
            sourceType: "company" as const,
            sourceId: newCompany.id,
            contentType,
            content: "",
            sortOrder: contentEntries.length + 1,
          });
        });
      }

      // Create content entries if any
      if (contentEntries.length > 0) {
        await tx.content.createMany({
          data: contentEntries,
        });
      }

      return newCompany;
    });

    return { success: true, company };
  } catch (error) {
    console.error("Error creating company:", error);
    return { success: false, error: "Failed to create company. Please try again." };
  }
}

/**
 * Import multiple companies from Excel file (server action)
 */
export async function batchImportCompanies(
  input: BatchImportCompaniesInput
): Promise<{
  success: boolean;
  companies?: Company[];
  error?: string;
  preview?: { rows: any[]; headers: string[] };
  totalProcessed?: number;
  totalCreated?: number;
}> {
  try {
    // Validate input
    const validatedInput = batchImportCompaniesSchema.parse(input);
    const userId = await getCurrentUserId();

    const { file, columnMappings, startRow, endRow } = validatedInput;

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert sheet to array of arrays (raw data)
    const rawData = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

    // Get actual end row (use provided or last row with data)
    const actualEndRow = endRow ?? rawData.length;

    // Validate row range
    if (startRow > actualEndRow) {
      return { success: false, error: "Start row cannot be greater than end row" };
    }

    // Extract relevant rows (convert to 0-indexed)
    const dataRows = rawData.slice(startRow - 1, actualEndRow);

    // Convert Excel column letters to indexes (A=0, B=1, ..., AA=26)
    const getColumnIndex = (col: string): number => {
      let index = 0;
      for (let i = 0; i < col.length; i++) {
        index = index * 26 + (col.charCodeAt(i) - 64); // A=1, B=2, etc.
      }
      return index - 1; // Convert to 0-index
    };

    // Parse rows into company objects
    const companiesToCreate = dataRows.map((row) => {
      const company: any = {};
      columnMappings.forEach(({ column, excelColumn }) => {
        const colIndex = getColumnIndex(excelColumn.toUpperCase());
        if (row[colIndex] !== undefined && row[colIndex] !== null) {
          company[column] = String(row[colIndex]).trim();
        }
      });
      return company;
    });

    // Filter out rows without company name (required)
    const validCompanies = companiesToCreate.filter((c) => c.name && c.name.trim() !== "");

    if (validCompanies.length === 0) {
      return {
        success: false,
        error: "No valid companies found in the selected rows. Ensure Company Name column is mapped correctly.",
      };
    }

    // Create companies in transaction
    const createdCompanies = await prisma.$transaction(async (tx) => {
      const results: Company[] = [];

      for (const companyData of validCompanies) {
        // Create company record
        const newCompany = await tx.company.create({
          data: {
            ...companyData,
            userId,
          },
        });
        results.push(newCompany);
      }

      return results;
    });

    // Return preview data if requested, or success result
    return {
      success: true,
      companies: createdCompanies,
      totalProcessed: validCompanies.length,
      totalCreated: createdCompanies.length,
      preview: {
        headers: rawData[0] || [],
        rows: dataRows.slice(0, 5), // First 5 rows for preview
      },
    };
  } catch (error) {
    console.error("Error batch importing companies:", error);
    return {
      success: false,
      error: "Failed to import companies. Please check your file and mapping configuration.",
    };
  }
}
