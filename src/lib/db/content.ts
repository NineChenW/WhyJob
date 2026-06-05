import { prisma } from "@/lib/prisma";
import type { Content } from "@prisma/client";

/**
 * Get all content entries for a specific source
 * @param sourceType - The type of source (e.g., "company", "profile", "job")
 * @param sourceId - The ID of the source
 * @returns Array of content entries sorted by sortOrder
 */
export async function getContentBySource(
  sourceType: string,
  sourceId: string
): Promise<Content[]> {
  return prisma.content.findMany({
    where: {
      sourceType,
      sourceId,
    },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Get a specific content entry by source and content type
 * @param sourceType - The type of source
 * @param sourceId - The ID of the source
 * @param contentType - The type of content to retrieve
 * @returns The content entry if found, null otherwise
 */
export async function getContentByType(
  sourceType: string,
  sourceId: string,
  contentType: string
): Promise<Content | null> {
  return prisma.content.findFirst({
    where: {
      sourceType,
      sourceId,
      contentType,
    },
  });
}

/**
 * Get multiple content entries by source and content types
 * @param sourceType - The type of source
 * @param sourceId - The ID of the source
 * @param contentTypes - Array of content types to retrieve
 * @returns Array of content entries matching the types, sorted by sortOrder
 */
export async function getContentByTypes(
  sourceType: string,
  sourceId: string,
  contentTypes: string[]
): Promise<Content[]> {
  return prisma.content.findMany({
    where: {
      sourceType,
      sourceId,
      contentType: { in: contentTypes },
    },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Create a new content entry
 * @param data - Content data to create
 * @returns The created content entry
 */
export async function createContent(
  data: Omit<Content, "id" | "createdAt" | "updatedAt">
): Promise<Content> {
  return prisma.content.create({
    data,
  });
}

/**
 * Update an existing content entry
 * @param id - ID of the content entry to update
 * @param data - Content data to update
 * @returns The updated content entry
 */
export async function updateContent(
  id: string,
  data: Partial<Omit<Content, "id" | "createdAt" | "updatedAt">>
): Promise<Content> {
  return prisma.content.update({
    where: { id },
    data,
  });
}

/**
 * Delete a content entry
 * @param id - ID of the content entry to delete
 * @returns The deleted content entry
 */
export async function deleteContent(id: string): Promise<Content> {
  return prisma.content.delete({
    where: { id },
  });
}
