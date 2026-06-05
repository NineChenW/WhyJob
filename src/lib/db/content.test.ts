import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Content } from "@prisma/client";

// Mock Prisma client with factory function using vi.hoisted
const { mockFindMany, mockFindFirst, mockCreate, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    content: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

// Import after mocking
import { getContentBySource, getContentByType, getContentByTypes, createContent, updateContent, deleteContent } from "./content";

describe("getContentBySource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call with correct params", async () => {
    const mockContent: Content[] = [
      {
        id: "1",
        sourceType: "company",
        sourceId: "company-1",
        contentType: "company_culture",
        content: "test content",
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockFindMany.mockResolvedValue(mockContent);

    const result = await getContentBySource("company", "company-1");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        sourceType: "company",
        sourceId: "company-1",
      },
      orderBy: { sortOrder: "asc" },
    });
    expect(result).toEqual(mockContent);
  });
});

describe("getContentByType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call with correct params", async () => {
    const mockContent: Content = {
      id: "1",
      sourceType: "company",
      sourceId: "company-1",
      contentType: "company_culture",
      content: "test content",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(mockContent);

    const result = await getContentByType("company", "company-1", "company_culture");

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        sourceType: "company",
        sourceId: "company-1",
        contentType: "company_culture",
      },
    });
    expect(result).toEqual(mockContent);
  });
});

describe("getContentByTypes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call with content type filter", async () => {
    const mockContent: Content[] = [
      {
        id: "1",
        sourceType: "company",
        sourceId: "company-1",
        contentType: "company_culture",
        content: "culture content",
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        sourceType: "company",
        sourceId: "company-1",
        contentType: "company_news",
        content: "news content",
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockFindMany.mockResolvedValue(mockContent);

    const result = await getContentByTypes("company", "company-1", [
      "company_culture",
      "company_news",
    ]);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        sourceType: "company",
        sourceId: "company-1",
        contentType: { in: ["company_culture", "company_news"] },
      },
      orderBy: { sortOrder: "asc" },
    });
    expect(result).toEqual(mockContent);
  });
});

describe("createContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call with correct params", async () => {
    const mockContent: Content = {
      id: "1",
      sourceType: "company",
      sourceId: "company-1",
      contentType: "company_culture",
      content: "test content",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCreate.mockResolvedValue(mockContent);

    const data = {
      sourceType: "company",
      sourceId: "company-1",
      contentType: "company_culture",
      content: "test content",
      sortOrder: 1,
    };

    const result = await createContent(data);

    expect(mockCreate).toHaveBeenCalledWith({
      data,
    });
    expect(result).toEqual(mockContent);
  });
});

describe("updateContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call with correct params", async () => {
    const mockContent: Content = {
      id: "1",
      sourceType: "company",
      sourceId: "company-1",
      contentType: "company_culture",
      content: "updated content",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockUpdate.mockResolvedValue(mockContent);

    const data = { content: "updated content" };

    const result = await updateContent("1", data);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "1" },
      data,
    });
    expect(result).toEqual(mockContent);
  });
});

describe("deleteContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call with correct params", async () => {
    const mockContent: Content = {
      id: "1",
      sourceType: "company",
      sourceId: "company-1",
      contentType: "company_culture",
      content: "test content",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDelete.mockResolvedValue(mockContent);

    const result = await deleteContent("1");

    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: "1" },
    });
    expect(result).toEqual(mockContent);
  });
});
