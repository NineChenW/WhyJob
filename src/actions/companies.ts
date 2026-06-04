"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import type { Company } from "@prisma/client";

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
