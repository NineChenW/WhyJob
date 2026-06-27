import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Company } from "@prisma/client";

const { mockFindMany, mockCreate, mockTransaction } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findMany: mockFindMany, create: mockCreate },
    $transaction: mockTransaction,
  },
}));

import { queryCompanyByNames, createBatchCompanies } from "./company";

describe("company db utilities", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("queryCompanyByNames", () => {
    it("should return empty Set for empty names array", async () => {
      const result = await queryCompanyByNames("user123", []);
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("should return lowercase names in Set", async () => {
      mockFindMany.mockResolvedValue([{ name: "Stripe" }, { name: "Figma" }]);
      const result = await queryCompanyByNames("user123", ["stripe", "FIGMA", "Linear"]);
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
    });

    it("should call prisma with correct params", async () => {
      mockFindMany.mockResolvedValue([]);
      await queryCompanyByNames("user123", ["Stripe"]);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user123", name: { in: ["Stripe"] } },
        select: { name: true },
      });
    });
  });

  describe("createBatchCompanies", () => {
    const userId = "user123";
    const validCompany = {
      name: "Test Company",
      industry: "Tech",
      stage: "Series A",
    } as unknown as Company;

    it("should return empty array for empty companies array", async () => {
      mockTransaction.mockImplementation(async (callback) => callback({ company: { create: vi.fn() } }));
      const result = await createBatchCompanies(userId, []);
      expect(result).toEqual([]);
    });

    it("should throw error if exceeds MAX_BATCH_SIZE of 10", async () => {
      const companies = Array(11).fill(validCompany);
      await expect(createBatchCompanies(userId, companies)).rejects.toThrow("Cannot create more than 10 companies at once");
    });

    it("should create all companies within batch limit", async () => {
      const createdCompany1 = { id: "1", name: "Test Company", industry: "Tech", stage: "Series A", userId } as unknown as Company;
      const createdCompany2 = { id: "2", name: "Company 2", industry: "Tech", stage: "Series A", userId } as unknown as Company;

      mockTransaction.mockImplementation(async (callback) => {
        return callback({ company: { create: vi.fn().mockResolvedValueOnce(createdCompany1).mockResolvedValueOnce(createdCompany2) } });
      });

      const result = await createBatchCompanies(userId, [validCompany, { ...validCompany, name: "Company 2" } as unknown as Company]);
      expect(result).toHaveLength(2);
    });
  });
});