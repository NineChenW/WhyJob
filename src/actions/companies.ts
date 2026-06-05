"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import type { Company, Content } from "@prisma/client";
import { createCompanySchema, type CreateCompanyInput } from "@/schemas/company";

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
          stage,
          userId,
        },
      });

      // Create content entries if needed
      const contentEntries = [];

      // Add description as company_culture if provided
      if (description && description.trim()) {
        contentEntries.push({
          sourceType: "company" as const,
          sourceId: newCompany.id,
          contentType: "company_culture" as const,
          content: description.trim(),
          sortOrder: 1,
        });
      }

      // Add empty content entries for selected track info types
      if (trackInfo && trackInfo.length > 0) {
        trackInfo.forEach((contentType) => {
          // Skip company_culture if we already added it from description
          if (contentType === "company_culture" && description && description.trim()) {
            return;
          }

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
