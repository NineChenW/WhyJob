import { prisma } from "@/lib/prisma";
import type { Company } from "@prisma/client";

/**
 * Get all companies for a user
 */
export async function getCompaniesByUserId(userId: string): Promise<Company[]> {
  return prisma.company.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a company by ID for the current user
 */
export async function getCompanyById(id: string, userId: string): Promise<Company | null> {
  return prisma.company.findUnique({
    where: { id, userId },
  });
}

/**
 * Search companies by text and stage
 */
export async function searchCompanies(params: {
  userId: string;
  query?: string;
  stage?: string;
}): Promise<Company[]> {
  const { userId, query, stage } = params;

  const where: any = { userId };

  if (query) {
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
 * Create a new company
 */
export async function createCompany(
  userId: string,
  data: Omit<Company, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<Company> {
  return prisma.company.create({
    data: {
      ...data,
      userId,
    },
  });
}

/**
 * Update a company
 */
export async function updateCompany(
  id: string,
  data: Partial<
    Omit<Company, "id" | "userId" | "createdAt" | "updatedAt">
  >
): Promise<Company> {
  return prisma.company.update({
    where: { id },
    data,
  });
}

/**
 * Delete a company
 */
export async function deleteCompany(id: string): Promise<Company> {
  return prisma.company.delete({
    where: { id },
  });
}
