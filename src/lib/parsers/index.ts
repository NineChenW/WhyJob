import type { ContentParser } from "./content-parsers";
import { TextParser, JsonParser } from "./content-parsers";

// Map of content types to their corresponding parsers
const PARSER_REGISTRY: Record<string, ContentParser> = {
  // Profile content types
  profile_summary: new TextParser(),
  profile_skill: new JsonParser(),
  job_experience: new JsonParser(),
  project_experience: new JsonParser(),
  education: new JsonParser(),
  achievement: new JsonParser(),
  certification: new JsonParser(),

  // Company content types
  company_culture: new TextParser(),
  company_news: new TextParser(),
  company_wechat: new TextParser(),
  company_hiring_trends: new TextParser(),

  // Job content types
  job_requirement: new TextParser(),
  job_responsibility: new TextParser(),
  job_salary: new TextParser(),
  job_location: new TextParser(),
  job_remote_policy: new TextParser(),

  // Resume content types
  resume_summary: new TextParser(),
  resume_experience: new JsonParser(),
  resume_skills: new JsonParser(),
  resume_education: new JsonParser(),

  // Interview content types
  interview_question: new JsonParser(),
  interview_answer: new TextParser(),
  interview_polished_answer: new TextParser(),
  interview_feedback: new TextParser(),
};

/**
 * Get the appropriate parser for a given content type
 * @param contentType The type of content to parse
 * @returns Content parser for the given type, or TextParser as fallback
 */
export function getParserForContentType(contentType: string): ContentParser {
  return PARSER_REGISTRY[contentType] || new TextParser();
}

/**
 * Parse content using the appropriate parser for its type
 * @param contentType The type of content
 * @param content Raw content string
 * @returns Parsed content
 */
export function parseContent<T = any>(contentType: string, content: string): T {
  const parser = getParserForContentType(contentType);
  return parser.parse(content) as T;
}
