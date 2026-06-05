import { describe, it, expect } from "vitest";
import { getParserForContentType, parseContent } from "./index";
import { TextParser, JsonParser } from "./content-parsers";

describe("getParserForContentType", () => {
  it("should return TextParser for company_culture", () => {
    const parser = getParserForContentType("company_culture");
    expect(parser).toBeInstanceOf(TextParser);
  });

  it("should return TextParser for company_news", () => {
    const parser = getParserForContentType("company_news");
    expect(parser).toBeInstanceOf(TextParser);
  });

  it("should return TextParser for company_wechat", () => {
    const parser = getParserForContentType("company_wechat");
    expect(parser).toBeInstanceOf(TextParser);
  });

  it("should return TextParser for company_hiring_trends", () => {
    const parser = getParserForContentType("company_hiring_trends");
    expect(parser).toBeInstanceOf(TextParser);
  });

  it("should return JsonParser for profile_skill", () => {
    const parser = getParserForContentType("profile_skill");
    expect(parser).toBeInstanceOf(JsonParser);
  });

  it("should return JsonParser for job_experience", () => {
    const parser = getParserForContentType("job_experience");
    expect(parser).toBeInstanceOf(JsonParser);
  });

  it("should return JsonParser for resume_skills", () => {
    const parser = getParserForContentType("resume_skills");
    expect(parser).toBeInstanceOf(JsonParser);
  });

  it("should return TextParser for unknown content type (fallback)", () => {
    const parser = getParserForContentType("unknown_type");
    expect(parser).toBeInstanceOf(TextParser);
  });
});

describe("parseContent", () => {
  it("should parse text content correctly", () => {
    const result = parseContent<string>("company_culture", "  test content  ");
    expect(result).toBe("test content");
  });

  it("should parse JSON content correctly", () => {
    const json = JSON.stringify({ key: "value" });
    const result = parseContent<{ key: string }>("profile_skill", json);
    expect(result.key).toBe("value");
  });

  it("should parse complex JSON content", () => {
    const json = JSON.stringify({
      technical: ["TypeScript", "React"],
      soft: ["Leadership"],
    });
    const result = parseContent<{
      technical: string[];
      soft: string[];
    }>("profile_skill", json);
    expect(result.technical).toEqual(["TypeScript", "React"]);
    expect(result.soft).toEqual(["Leadership"]);
  });

  it("should handle empty string", () => {
    const result = parseContent<string>("company_culture", "");
    expect(result).toBe("");
  });

  it("should handle invalid JSON gracefully", () => {
    const result = parseContent("profile_skill", "invalid json");
    expect(result).toEqual({});
  });

  it("should use TextParser for unknown content type", () => {
    const result = parseContent<string>("unknown_type", "test");
    expect(result).toBe("test");
  });
});
