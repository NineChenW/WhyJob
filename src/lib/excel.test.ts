import { describe, it, expect } from "vitest";
import { getColumnIndex } from "./excel";

describe("getColumnIndex", () => {
  describe("single letter columns", () => {
    it("should return 0 for column A", () => {
      expect(getColumnIndex("A")).toBe(0);
    });

    it("should return 1 for column B", () => {
      expect(getColumnIndex("B")).toBe(1);
    });

    it("should return 25 for column Z", () => {
      expect(getColumnIndex("Z")).toBe(25);
    });
  });

  describe("double letter columns", () => {
    it("should return 26 for column AA", () => {
      expect(getColumnIndex("AA")).toBe(26);
    });

    it("should return 27 for column AB", () => {
      expect(getColumnIndex("AB")).toBe(27);
    });

    it("should return 51 for column AZ", () => {
      expect(getColumnIndex("AZ")).toBe(51);
    });

    it("should return 52 for column BA", () => {
      expect(getColumnIndex("BA")).toBe(52);
    });
  });

  describe("case insensitivity", () => {
    it("should handle lowercase input", () => {
      expect(getColumnIndex("a")).toBe(0);
      expect(getColumnIndex("b")).toBe(1);
      expect(getColumnIndex("aa")).toBe(26);
    });

    it("should handle mixed case input", () => {
      expect(getColumnIndex("Aa")).toBe(26);
      expect(getColumnIndex("aB")).toBe(27);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string input", () => {
      expect(getColumnIndex("")).toBe(-1);
    });

    it("should handle single character strings", () => {
      expect(getColumnIndex("A")).toBe(0);
      expect(getColumnIndex("M")).toBe(12);
      expect(getColumnIndex("Z")).toBe(25);
    });
  });
});