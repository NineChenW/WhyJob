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
 * Query companies by names for a user
 * Used to check company uniqueness before batch import
 */
export async function queryCompanyByNames(
  userId: string,
  names: string[]
): Promise<Set<string>> {
  if (names.length === 0) {
    return new Set();
  }

  const companies = await prisma.company.findMany({
    where: {
      userId,
      name: { in: names },
    },
    select: { name: true },
  });

  return new Set(companies.map((c) => c.name.toLowerCase()));
}

/**
 * Create multiple companies in a batch
 * Limited to 10 companies at once, uses a transaction
 */
export async function createBatchCompanies(
  userId: string,
  companies: Array<
    Omit<Company, "id" | "userId" | "createdAt" | "updatedAt">
  >
): Promise<Company[]> {
  const MAX_BATCH_SIZE = 10;

  if (companies.length > MAX_BATCH_SIZE) {
    throw new Error(
      `Cannot create more than ${MAX_BATCH_SIZE} companies at once. Received ${companies.length}.`
    );
  }

  if (companies.length === 0) {
    return [];
  }

  return prisma.$transaction(async (tx) => {
    const results: Company[] = [];

    for (const companyData of companies) {
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
}

/**
 * Delete a company
 */
export async function deleteCompany(id: string): Promise<Company> {
  return prisma.company.delete({
    where: { id },
  });
}
