import { memoryRecall } from '../tools/memory.js';
import { getProfilesByCategories } from './persona-service.js';
import { getPairingEntities } from './entity-vocabulary.js';

export async function getMidTermMemory(
  input: string,
  pairingId: string
): Promise<string> {
  if (!await shouldTrigger(input, pairingId)) return '';

  const [vectorResults, profiles] = await Promise.all([
    memoryRecall(input, pairingId, undefined, 3),
    getProfilesByCategories(pairingId, ['health', 'preference'], 5),
  ]);

  const lines: string[] = [];

  for (const r of vectorResults) {
    const payload = r.payload as Record<string, string> | undefined;
    const content = payload?.content;
    if (content) {
      lines.push(`- ${content}`);
    }
  }

  for (const p of profiles) {
    if (p.content) {
      lines.push(`- ${p.content}`);
    }
  }

  if (lines.length === 0) return '';
  return `【相关回忆】\n${lines.join('\n')}`;
}

async function shouldTrigger(input: string, pairingId: string): Promise<boolean> {
  if (input.length >= 10) return true;

  const entities = await getPairingEntities(pairingId);
  for (const entity of entities) {
    if (input.includes(entity)) return true;
  }

  return false;
}
