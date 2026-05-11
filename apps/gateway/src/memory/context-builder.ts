import { getDailyMemory } from './daily-memory.js';
import { getShortTermMemory } from './short-term-memory.js';
import { getMidTermMemory } from './mid-term-memory.js';

export async function buildMemoryContext(params: {
  familyId: string;
  turnCount: number;
  input: string;
}): Promise<string> {
  const results = await Promise.allSettled([
    params.turnCount <= 3 ? getDailyMemory(params.familyId) : Promise.resolve(''),
    params.turnCount <= 3 ? getShortTermMemory(params.familyId) : Promise.resolve(''),
    getMidTermMemory(params.input, params.familyId),
  ]);

  const sections: string[] = [];

  const daily = results[0].status === 'fulfilled' ? results[0].value : '';
  if (daily) sections.push(daily);

  const shortTerm = results[1].status === 'fulfilled' ? results[1].value : '';
  if (shortTerm) sections.push(shortTerm);

  const midTerm = results[2].status === 'fulfilled' ? results[2].value : '';
  if (midTerm) sections.push(midTerm);

  return sections.join('\n\n');
}
