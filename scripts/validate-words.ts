/**
 * Word library validator (SPEC §14.3). Usage:
 *   npm run validate:words              # validate all levels (fails build on error)
 *   npm run validate:words -- --level easy   # validate one level only
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Level = 'easy' | 'medium' | 'hard';
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const GRADES: Record<Level, string[]> = { easy: ['K', '1'], medium: ['2', '3'], hard: ['4', '5'] };
const TARGET = 500;
const TOLERANCE = 0.15;

// Terms flagged for human review (report only, does not fail).
const DENYLIST = [
  'kill', 'dead', 'death', 'die', 'blood', 'gun', 'knife', 'sword', 'war', 'fight', 'hit',
  'punch', 'bomb', 'shoot', 'scary', 'ghost', 'monster', 'devil', 'hell', 'god', 'church',
  'pray', 'beer', 'wine', 'drunk', 'drug', 'smoke', 'kiss', 'love', 'date', 'poop', 'pee',
  'fart', 'butt', 'vote', 'president', 'hate', 'stupid', 'dumb', 'ugly', 'fat', 'sexy',
  'cigarette', 'pistol', 'weapon', 'grave', 'coffin', 'witch', 'demon', 'angel', 'heaven',
];

interface Entry {
  id: unknown;
  word: unknown;
  level: unknown;
  grade: unknown;
  sentence: unknown;
  homophoneGroup?: unknown;
}

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'src', 'data', 'words');

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countWholeWord(sentence: string, word: string): number {
  const re = new RegExp(`(?<![a-z])${escapeRe(word)}(?![a-z])`, 'gi');
  return (sentence.match(re) ?? []).length;
}

export function sentenceWordCount(sentence: string): number {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

function main(): void {
  const argIdx = process.argv.indexOf('--level');
  const only = argIdx >= 0 ? (process.argv[argIdx + 1] as Level) : undefined;
  const levels = only ? [only] : LEVELS;
  const errors: string[] = [];
  const flagged: string[] = [];
  const ids = new Set<string>();
  const groups = new Map<string, string[]>();

  for (const level of levels) {
    const raw: unknown = JSON.parse(readFileSync(join(dataDir, `${level}.json`), 'utf8'));
    if (!Array.isArray(raw)) {
      errors.push(`${level}.json: not an array`);
      continue;
    }
    const words = new Set<string>();
    (raw as Entry[]).forEach((e, i) => {
      const where = `${level}[${i}]${typeof e.word === 'string' ? ` "${e.word}"` : ''}`;
      const keys = Object.keys(e);
      for (const k of keys) {
        if (!['id', 'word', 'level', 'grade', 'sentence', 'homophoneGroup'].includes(k))
          errors.push(`${where}: unknown key "${k}"`);
      }
      if (typeof e.id !== 'string' || !e.id) errors.push(`${where}: id missing`);
      else if (ids.has(e.id)) errors.push(`${where}: duplicate id ${e.id}`);
      else ids.add(e.id);
      if (typeof e.word !== 'string' || !/^[a-z]+$/.test(e.word)) {
        errors.push(`${where}: word must match /^[a-z]+$/`);
        return;
      }
      if (words.has(e.word)) errors.push(`${where}: duplicate word in level`);
      words.add(e.word);
      if (e.level !== level) errors.push(`${where}: level "${String(e.level)}" != file ${level}`);
      if (typeof e.grade !== 'string' || !GRADES[level].includes(e.grade))
        errors.push(`${where}: grade "${String(e.grade)}" not valid for ${level}`);
      if (typeof e.sentence !== 'string') {
        errors.push(`${where}: sentence missing`);
        return;
      }
      const n = sentenceWordCount(e.sentence);
      if (n < 5 || n > 14) errors.push(`${where}: sentence has ${n} words (need 5–14)`);
      const c = countWholeWord(e.sentence, e.word);
      if (c !== 1) errors.push(`${where}: sentence contains word ${c} times (need exactly 1)`);
      if (e.homophoneGroup !== undefined) {
        if (typeof e.homophoneGroup !== 'string' || !e.homophoneGroup)
          errors.push(`${where}: homophoneGroup must be a non-empty string`);
        else groups.set(e.homophoneGroup, [...(groups.get(e.homophoneGroup) ?? []), e.word]);
      }
      const text = `${e.word} ${e.sentence}`.toLowerCase();
      for (const term of DENYLIST) {
        if (countWholeWord(text, term) > 0) flagged.push(`${where}: contains "${term}" — "${e.sentence}"`);
      }
    });
    const min = Math.round(TARGET * (1 - TOLERANCE));
    const max = Math.round(TARGET * (1 + TOLERANCE));
    if (raw.length < min || raw.length > max)
      errors.push(`${level}: ${raw.length} words (need ${min}–${max})`);
    console.log(`${level}: ${raw.length} words`);
  }

  if (!only) {
    for (const [g, members] of groups) {
      if (members.length < 2) errors.push(`homophoneGroup "${g}" has only ${members.length} member`);
    }
  }

  if (flagged.length) {
    console.log(`\nBlocklist report (${flagged.length}, for human review):`);
    for (const f of flagged) console.log(`  ${f}`);
  }
  if (errors.length) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log('\nWord library OK');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
