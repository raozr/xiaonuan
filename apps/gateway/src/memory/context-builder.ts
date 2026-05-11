import { getDailyMemory } from './daily-memory.js';
import { getShortTermMemory } from './short-term-memory.js';
import { getMidTermMemory } from './mid-term-memory.js';
import { getGreetingHint } from './greeting-hint.js';
import { deduplicateSections, type Section } from './dedup.js';

function parseSection(text: string): Section {
  const lines = text.split('\n');
  const title = lines[0] ?? '';
  const bullets = lines.slice(1).filter((l) => l.trim().startsWith('- '));
  return { title, bullets };
}

export async function buildMemoryContext(params: {
  familyId: string;
  turnCount: number;
  input: string;
  phase?: string;
}): Promise<string> {
  const results = await Promise.allSettled([
    params.turnCount <= 3 ? getDailyMemory(params.familyId) : Promise.resolve(''),
    params.turnCount <= 3 ? getShortTermMemory(params.familyId) : Promise.resolve(''),
    getMidTermMemory(params.input, params.familyId),
    params.phase === 'GREETING' ? getGreetingHint(params.familyId) : Promise.resolve(''),
  ]);

  const rawSections: string[] = [];

  const daily = results[0].status === 'fulfilled' ? results[0].value : '';
  if (daily) rawSections.push(daily);

  const shortTerm = results[1].status === 'fulfilled' ? results[1].value : '';
  if (shortTerm) rawSections.push(shortTerm);

  const midTerm = results[2].status === 'fulfilled' ? results[2].value : '';
  if (midTerm) rawSections.push(midTerm);

  const greetingHint = results[3].status === 'fulfilled' ? results[3].value : '';
  if (greetingHint) rawSections.push(greetingHint);

  const parsed = rawSections.map(parseSection);
  const deduped = deduplicateSections(parsed, 0.6);

  return deduped
    .map((s) => `${s.title}\n${s.bullets.join('\n')}`)
    .join('\n\n');
}
