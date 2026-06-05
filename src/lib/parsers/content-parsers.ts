/**
 * Base parser interface for all content types
 */
export interface ContentParser<T = any> {
  /**
   * Parse raw content string into structured data
   * @param content Raw content string from database
   * @returns Structured data of type T
   */
  parse(content: string): T;

  /**
   * Validate if content is valid for this parser
   * @param content Raw content string
   * @returns True if content is valid, false otherwise
   */
  validate(content: string): boolean;
}

/**
 * Text parser for plain text content
 * Used for: company_culture, company_news, company_wechat, company_hiring_trends
 */
export class TextParser implements ContentParser<string> {
  parse(content: string): string {
    // Return trimmed text, handle null/undefined
    return (content || "").trim();
  }

  validate(content: string): boolean {
    return typeof content === "string";
  }
}

/**
 * JSON parser for JSON-encoded content
 * Used for: profile_skill, resume_skills, etc.
 */
export class JsonParser<T = any> implements ContentParser<T> {
  parse(content: string): T {
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      console.error("Failed to parse JSON content:", e);
      return {} as T;
    }
  }

  validate(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }
}
