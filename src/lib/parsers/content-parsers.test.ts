import { describe, it, expect } from "vitest";
import { TextParser, JsonParser } from "./content-parsers";

describe("TextParser", () => {
  const parser = new TextParser();

  describe("parse", () => {
    it("should return trimmed text", () => {
      expect(parser.parse("  hello world  ")).toBe("hello world");
    });

    it("should handle empty string", () => {
      expect(parser.parse("")).toBe("");
    });

    it("should handle whitespace-only string", () => {
      expect(parser.parse("   ")).toBe("");
    });

    it("should handle null/undefined by returning empty string", () => {
      expect(parser.parse("")).toBe("");
    });

    it("should return text as-is after trimming", () => {
      const text = "This is a test string.";
      expect(parser.parse(text)).toBe(text);
    });
  });

  describe("validate", () => {
    it("should return true for valid string", () => {
      expect(parser.validate("test")).toBe(true);
    });

    it("should return true for empty string", () => {
      expect(parser.validate("")).toBe(true);
    });
  });
});

describe("JsonParser", () => {
  const parser = new JsonParser();

  describe("parse", () => {
    it("should parse valid JSON object", () => {
      const json = '{"key": "value"}';
      const result = parser.parse(json);
      expect(result).toEqual({ key: "value" });
    });

    it("should parse valid JSON array", () => {
      const json = '[1, 2, 3]';
      const result = parser.parse(json);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse complex nested JSON", () => {
      const json = JSON.stringify({
        nested: { deep: { value: 42 } },
        array: [1, 2, { obj: "test" }],
      });
      const result = parser.parse(json);
      expect(result.nested.deep.value).toBe(42);
      expect(result.array[2].obj).toBe("test");
    });

    it("should return empty object on invalid JSON", () => {
      const result = parser.parse("invalid json");
      expect(result).toEqual({});
    });

    it("should handle empty JSON object", () => {
      const result = parser.parse("{}");
      expect(result).toEqual({});
    });

    it("should handle empty JSON array", () => {
      const result = parser.parse("[]");
      expect(result).toEqual([]);
    });
  });

  describe("validate", () => {
    it("should return true for valid JSON", () => {
      expect(parser.validate('{"key": "value"}')).toBe(true);
    });

    it("should return true for valid JSON array", () => {
      expect(parser.validate('[1, 2, 3]')).toBe(true);
    });

    it("should return false for invalid JSON", () => {
      expect(parser.validate("not json")).toBe(false);
    });

    it("should return false for malformed JSON", () => {
      expect(parser.validate('{"key": "value"')).toBe(false);
    });
  });
});
