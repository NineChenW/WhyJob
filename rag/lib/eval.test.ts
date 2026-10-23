import { describe, expect, it } from 'vitest';
import {
  evaluateAnswerable,
  evaluateRefusal,
  parseEvalSet,
  REFUSE_PHRASE,
  sourceMatches,
  summarizeResults,
  type EvalResult,
} from './eval';

const VALID_SET = JSON.stringify({
  questions: [
    { question: 'q1', expectedSource: 'ckb/projects/x.md', shouldRefuse: false },
    { question: 'q2', expectedSource: null, shouldRefuse: true },
  ],
});

describe('parseEvalSet', () => {
  it('parses a valid eval set', () => {
    const set = parseEvalSet(VALID_SET);
    expect(set.questions).toHaveLength(2);
    expect(set.questions[0].expectedSource).toBe('ckb/projects/x.md');
    expect(set.questions[1].shouldRefuse).toBe(true);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseEvalSet('not json')).toThrow();
  });

  it('rejects a question missing the question text', () => {
    const bad = JSON.stringify({ questions: [{ expectedSource: 'a.md', shouldRefuse: false }] });
    expect(() => parseEvalSet(bad)).toThrow();
  });

  it('rejects refusal questions with an expected source', () => {
    const bad = JSON.stringify({
      questions: [{ question: 'q', expectedSource: 'a.md', shouldRefuse: true }],
    });
    expect(() => parseEvalSet(bad)).toThrow('shouldRefuse questions must have expectedSource: null');
  });

  it('rejects answerable questions with an empty expected source', () => {
    const bad = JSON.stringify({
      questions: [{ question: 'q', expectedSource: null, shouldRefuse: false }],
    });
    expect(() => parseEvalSet(bad)).toThrow('answerable questions must have a non-empty expectedSource');
  });
});

describe('sourceMatches', () => {
  it('matches an exact path', () => {
    expect(sourceMatches(['ckb/projects/x.md'], 'ckb/projects/x.md')).toBe(true);
  });

  it('matches an unambiguous fragment', () => {
    expect(sourceMatches(['ckb/projects/fingo-push-platform.md'], 'fingo-push-platform.md')).toBe(true);
  });

  it('does not match unrelated sources', () => {
    expect(sourceMatches(['docs/RESUME_FORMAT.md'], 'ckb/projects/x.md')).toBe(false);
  });

  it('does not match when there are no chunks', () => {
    expect(sourceMatches([], 'a.md')).toBe(false);
  });
});

describe('evaluateAnswerable', () => {
  it('hits when a retrieved chunk source matches', () => {
    const result = evaluateAnswerable(
      'q',
      ['docs/other.md', 'ckb/projects/x.md'],
      [0.4, 0.9],
      'ckb/projects/x.md'
    );
    expect(result.kind).toBe('answerable');
    expect(result.hit).toBe(true);
    expect(result.bestSimilarity).toBe(0.9);
  });

  it('misses when no chunk matches', () => {
    const result = evaluateAnswerable('q', ['docs/other.md'], [0.7], 'ckb/projects/x.md');
    expect(result.hit).toBe(false);
    expect(result.matchedSource).toBeNull();
    expect(result.bestSimilarity).toBe(0.7);
  });

  it('reports best similarity 0 when retrieval returned nothing', () => {
    const result = evaluateAnswerable('q', [], [], 'ckb/projects/x.md');
    expect(result.hit).toBe(false);
    expect(result.bestSimilarity).toBe(0);
  });
});

describe('evaluateRefusal', () => {
  it('passes only on the exact refuse phrasing (trimmed)', () => {
    expect(evaluateRefusal('q', REFUSE_PHRASE).passed).toBe(true);
    expect(evaluateRefusal('q', `  ${REFUSE_PHRASE}\n`).passed).toBe(true);
  });

  it('fails on anything else, including a prefixed answer', () => {
    expect(evaluateRefusal('q', `Sorry — ${REFUSE_PHRASE}`).passed).toBe(false);
    expect(evaluateRefusal('q', 'not in the knowledge base.').passed).toBe(false);
    expect(evaluateRefusal('q', 'Amazon has about 1.5 million employees.').passed).toBe(false);
  });
});

describe('summarizeResults', () => {
  it('produces the spec summary line', () => {
    const results: EvalResult[] = [
      { kind: 'answerable', question: 'q1', hit: true, bestSimilarity: 0.9, matchedSource: 'a.md' },
      { kind: 'answerable', question: 'q2', hit: false, bestSimilarity: 0.5, matchedSource: null },
      { kind: 'refusal', question: 'q3', passed: true, answer: REFUSE_PHRASE },
      { kind: 'refusal', question: 'q4', passed: false, answer: 'made up' },
    ];
    const summary = summarizeResults(results);
    expect(summary.recallLine).toBe('recall@5: 1/2 answerable, refusals: 1/2 correct');
    expect(summary.hits).toBe(1);
    expect(summary.answerable).toBe(2);
    expect(summary.refusalsPassed).toBe(1);
    expect(summary.refusals).toBe(2);
  });
});
