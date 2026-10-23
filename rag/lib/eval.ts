// rag/lib/eval.ts

/**
 * Pure helpers for the phase-4 eval script (rag/04-evaluate.ts), extracted so
 * they can be unit-tested without triggering the script's main() or any
 * network/DB calls.
 */

import { z } from 'zod';

/** Refusal phrasing the phase-3 prompt mandates verbatim (lib/ask.ts buildPrompt). */
export const REFUSE_PHRASE = 'Not in the knowledge base.';

const evalQuestionSchema = z.object({
  question: z.string().min(1),
  expectedSource: z.string().nullable(),
  shouldRefuse: z.boolean(),
});

export const evalSetSchema = z.object({
  questions: z.array(evalQuestionSchema).min(1),
});

export type EvalQuestion = z.infer<typeof evalQuestionSchema>;
export type EvalSet = z.infer<typeof evalSetSchema>;

/** Outcome for one answerable question: did any retrieved chunk hit the expected source. */
export interface AnswerableResult {
  question: string;
  kind: 'answerable';
  hit: boolean;
  bestSimilarity: number;
  matchedSource: string | null;
}

/** Outcome for one should-refuse question: did the LLM answer with the exact refuse phrasing. */
export interface RefusalResult {
  question: string;
  kind: 'refusal';
  passed: boolean;
  answer: string;
}

export type EvalResult = AnswerableResult | RefusalResult;

/**
 * Parse and validate the eval-set JSON file content. Throws with a clear
 * message when the shape is wrong.
 */
export function parseEvalSet(raw: string): EvalSet {
  const parsed = evalSetSchema.parse(JSON.parse(raw));
  const answerable = parsed.questions.filter((q) => !q.shouldRefuse);
  const refusals = parsed.questions.filter((q) => q.shouldRefuse);
  if (refusals.some((q) => q.expectedSource !== null)) {
    throw new Error('shouldRefuse questions must have expectedSource: null');
  }
  if (answerable.some((q) => !q.expectedSource)) {
    throw new Error('answerable questions must have a non-empty expectedSource');
  }
  return parsed;
}

/**
 * Match rule for expected sources, kept deliberately simple per the spec:
 * a chunk hits when the expected source (a full relative path, or an
 * unambiguous fragment of one) is a substring of the chunk's source path.
 */
export function sourceMatches(chunkSources: string[], expectedSource: string): boolean {
  return chunkSources.some((source) => source.includes(expectedSource));
}

/** Evaluate one answerable question against its retrieved chunks. */
export function evaluateAnswerable(
  question: string,
  chunkSources: string[],
  similarities: number[],
  expectedSource: string
): AnswerableResult {
  const hit = sourceMatches(chunkSources, expectedSource);
  return {
    question,
    kind: 'answerable',
    hit,
    bestSimilarity: similarities.length > 0 ? Math.max(...similarities) : 0,
    matchedSource: hit ? expectedSource : null,
  };
}

/**
 * Evaluate one should-refuse question: pass only when the answer is exactly
 * the refuse phrasing (trimmed) — the phase-3 prompt mandates it verbatim.
 */
export function evaluateRefusal(question: string, answer: string): RefusalResult {
  return {
    question,
    kind: 'refusal',
    passed: answer.trim() === REFUSE_PHRASE,
    answer,
  };
}

/** Summarize results into the spec's required summary line. */
export function summarizeResults(results: EvalResult[]): { recallLine: string; hits: number; answerable: number; refusalsPassed: number; refusals: number } {
  const answerableResults = results.filter((r): r is AnswerableResult => r.kind === 'answerable');
  const refusalResults = results.filter((r): r is RefusalResult => r.kind === 'refusal');
  const hits = answerableResults.filter((r) => r.hit).length;
  const refusalsPassed = refusalResults.filter((r) => r.passed).length;
  return {
    recallLine: `recall@5: ${hits}/${answerableResults.length} answerable, refusals: ${refusalsPassed}/${refusalResults.length} correct`,
    hits,
    answerable: answerableResults.length,
    refusalsPassed,
    refusals: refusalResults.length,
  };
}
