// rag/lib/ask.ts

/**
 * Pure helpers for phase 3's ask script, extracted so they can be unit
 * tested without triggering the script's main() (rag/03-ask.ts runs it
 * at module load).
 */

import { z } from 'zod';
import type OpenAI from 'openai';

export const TOP_K = 5;
export const MAX_ANSWER_ATTEMPTS = 2;

export interface RetrievedChunk {
  content: string;
  source: string;
  heading: string;
  similarity: number;
}

const structuredAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.number().int().min(1).max(TOP_K)),
});

/** Build the three-layer prompt: instructions (with refuse rule) → context → question. */
export function buildPrompt(question: string, chunks: RetrievedChunk[]): string {
  const instructions =
    'Answer ONLY from the provided context. Cite the source path for every claim, e.g. [1]. ' +
    "If the context does not cover the question, reply exactly: 'Not in the knowledge base.' " +
    'Do not use outside knowledge. ' +
    'Respond in JSON with keys: answer (string), citations (array of numbers indexing the [n] labels).';
  const context = chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.source} :: ${chunk.heading}\n${chunk.content}`)
    .join('\n\n');
  return `${instructions}\n\nContext:\n\n${context}\n\nQuestion: ${question}`;
}

/** Parse the model's JSON output and Zod-validate the { answer, citations } shape. */
export function parseStructuredAnswer(raw: string): { answer: string; citations: number[] } {
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`No JSON object found in model output: ${raw.slice(0, 200)}`);
  }
  return structuredAnswerSchema.parse(JSON.parse(raw.slice(jsonStart, jsonEnd + 1)));
}

/** Ask the chat model for a JSON answer; retry once if validation fails. */
export async function generateAnswer(
  client: OpenAI,
  prompt: string,
  chatModel: string
): Promise<{ answer: string; citations: number[] }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ANSWER_ATTEMPTS; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: chatModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        // nemotron-3-super is a reasoning model: reasoning_content burns tokens
        // before the JSON answer, so the budget must cover both
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      });
      return parseStructuredAnswer(completion.choices[0]?.message?.content ?? '');
    } catch (error) {
      lastError = error;
      console.warn(`Answer attempt ${attempt} failed validation: ${error instanceof Error ? error.message : error}`);
    }
  }
  throw new Error(
    `Failed to get a valid structured answer after ${MAX_ANSWER_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : lastError}`
  );
}
