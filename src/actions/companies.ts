"use server";

import { z } from "zod";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { queryCompanyByNames, createBatchCompanies } from "@/lib/db/company";
import type { Company, Content } from "@prisma/client";
import { getColumnIndex } from "@/lib/excel";
import {
  createCompanySchema,
  batchImportCompaniesSchema,
  type BatchImportCompaniesInput,
  type CreateCompanyInput,
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

    const {
      name,
      description,
      stage,
      trackInfo,
      name_en,
      register_address,
      register_post_code,
      province,
      city,
      district,
      company_size,
      establishment_date,
      enterprise_type,
    } = validatedInput;

    // Create company in transaction
    const company = await prisma.$transaction(async (tx) => {
      // Create company record
      const newCompany = await tx.company.create({
        data: {
          name,
          description: description || null,
          stage,
          userId,
          // New columns
          name_en: name_en || null,
          register_address: register_address || null,
          register_post_code: register_post_code || null,
          province: province || null,
          city: city || null,
          district: district || null,
          company_size: company_size || null,
          establishment_date: establishment_date ? new Date(establishment_date) : null,
          enterprise_type: enterprise_type || null,
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

    // Validate that there is data in the file
    if (!rawData || rawData.length === 0) {
      return { success: false, error: "The uploaded file is empty or could not be parsed." };
    }

    // Get actual end row (use provided or last row with data)
    const actualEndRow = endRow ?? rawData.length;

    // Validate row range
    if (startRow > actualEndRow) {
      return { success: false, error: "Start row cannot be greater than end row" };
    }

    if (startRow < 1) {
      return { success: false, error: "Start row must be at least 1" };
    }

    // Extract relevant rows (convert to 0-indexed)
    const dataRows = rawData.slice(startRow - 1, actualEndRow);

    // Validate that there is data in the selected range
    if (dataRows.length === 0) {
      return {
        success: false,
        error: `No data found between row ${startRow} and ${actualEndRow}. Please check your row settings.`,
      };
    }

    // Parse rows into company objects with validation
    const companiesToCreate: Array<
      Omit<Company, "id" | "userId" | "createdAt" | "updatedAt">
    > = [];
    const errors: string[] = [];

    dataRows.forEach((row, rowIndex) => {
      const actualRowNumber = startRow + rowIndex;
      const company: any = {};
      let hasRequiredFields = false;

      columnMappings.forEach(({ column, excelColumn }) => {
        const colIndex = getColumnIndex(excelColumn.toUpperCase());
        const cellValue = row[colIndex];

        if (cellValue !== undefined && cellValue !== null) {
          // Handle establishment_date - convert Excel serial date to ISO-8601 DateTime
          if (column === "establishment_date") {
            const excelDate = Number(cellValue);
            if (!isNaN(excelDate) && excelDate > 0) {
              // Excel serial date: days since 1900-01-01 (with leap year bug)
              const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
              company[column] = jsDate.toISOString().slice(0, 19) + "Z";
            } else {
              // Try parsing as string (yyyy-MM-dd format) and convert to ISO-8601
              const dateStr = String(cellValue).trim();
              if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                company[column] = dateStr + "T00:00:00Z";
              }
            }
          } else {
            company[column] = String(cellValue).trim();
          }

          // Check if this is the required name field
          if (column === "name" && company[column]) {
            hasRequiredFields = true;
          }
        }
      });

      // Validate that required fields exist
      if (!hasRequiredFields) {
        errors.push(
          `Row ${actualRowNumber}: Missing required Company Name. Please check your column mapping.`
        );
      } else {
        companiesToCreate.push(company);
      }
    });

    // Return validation errors if any
    if (errors.length > 0) {
      return {
        success: false,
        error: errors[0], // Return first error for simplicity
      };
    }

    if (companiesToCreate.length === 0) {
      return {
        success: false,
        error: "No valid companies found in the selected rows. Ensure Company Name column is mapped correctly.",
      };
    }

    // Check for duplicate company names in the current batch
    const batchNames = companiesToCreate.map((c) => c.name.toLowerCase());
    const duplicateNamesInBatch = batchNames.filter(
      (name, index) => batchNames.indexOf(name) !== index
    );

    if (duplicateNamesInBatch.length > 0) {
      return {
        success: false,
        error: `Duplicate company names found in the uploaded file: ${[...new Set(duplicateNamesInBatch)].join(", ")}`,
      };
    }

    // Check for existing companies in the database
    const existingNames = await queryCompanyByNames(userId, companiesToCreate.map((c) => c.name));

    // Filter out companies that already exist
    const newCompaniesToCreate = companiesToCreate.filter(
      (c) => !existingNames.has(c.name.toLowerCase())
    );

    if (newCompaniesToCreate.length === 0) {
      return {
        success: false,
        error: "All companies in the file already exist in your database.",
      };
    }

    // Create companies in batches of 10
    const BATCH_SIZE = 10;
    const allCreatedCompanies: Company[] = [];

    for (let i = 0; i < newCompaniesToCreate.length; i += BATCH_SIZE) {
      const batch = newCompaniesToCreate.slice(i, i + BATCH_SIZE);
      const created = await createBatchCompanies(userId, batch);
      allCreatedCompanies.push(...created);
    }

    // Return success result
    return {
      success: true,
      companies: allCreatedCompanies,
      totalProcessed: companiesToCreate.length,
      totalCreated: allCreatedCompanies.length,
      preview: {
        headers: rawData[0] || [],
        rows: dataRows.slice(0, 5), // First 5 rows for preview
      },
    };
  } catch (error) {
    console.error("Error batch importing companies:", error);

    // Handle specific error types
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.issues[0].message}`,
      };
    }

    return {
      success: false,
      error: "Failed to import companies. Please check your file and mapping configuration.",
    };
  }
}
