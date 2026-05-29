import { getDailyMemory } from './daily-memory.js';
import { getShortTermMemory } from './short-term-memory.js';
import { getMidTermMemory } from './mid-term-memory.js';
import { getGreetingHint } from './greeting-hint.js';
import { getRelationshipLayer } from './relationship-layer.js';
import { getRecentMoods } from './emotion-tracker.js';
import { getFeedMessages } from './feed-messages.js';
import { deduplicateSections, type Section } from './dedup.js';

const TOKEN_BUDGET_CHARS = 4096;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 1.5);
}

function parseSection(text: string): Section {
  const lines = text.split('\n');
  const title = lines[0] ?? '';
  const bullets = lines.slice(1).filter((l) => l.trim().startsWith('- '));
  return { title, bullets };
}

function truncateToBudget(sections: Section[], budget: number): Section[] {
  const totalChars = sections.reduce((sum, s) => {
    return sum + s.title.length + s.bullets.join('\n').length;
  }, 0);

  if (totalChars <= budget) return sections;

  const priorityOrder: Record<string, number> = {
    '【关系档案】': 0,
    '【相关回忆】': 1,
    '【近日动态】': 2,
    '【今日回顾】': 3,
    '【情感状态】': 4,
    '【家人留言】': 5,
  };

  const sorted = [...sections].sort(
    (a, b) => (priorityOrder[a.title] ?? 99) - (priorityOrder[b.title] ?? 99)
  );

  for (const section of sorted) {
    while (section.bullets.length > 0) {
      section.bullets.pop();
      const currentChars = sections.reduce((sum, s) => {
        return sum + s.title.length + s.bullets.join('\n').length;
      }, 0);
      if (currentChars <= budget) break;
    }
    const remainingChars = sections.reduce((sum, s) => {
      return sum + s.title.length + s.bullets.join('\n').length;
    }, 0);
    if (remainingChars <= budget) break;
  }

  return sections.filter((s) => s.bullets.length > 0);
}

async function getEmotionSnapshot(pairingId: string): Promise<string> {
  const moods = await getRecentMoods(pairingId, 5);
  if (moods.length === 0) return '';

  const lines = moods.map((m) => {
    const daysAgo = Math.round((Date.now() - m.eventTime.getTime()) / 86400000);
    const timeStr = daysAgo === 0 ? '今天' : daysAgo === 1 ? '昨天' : `${daysAgo}天前`;
    return `- ${m.mood}（${timeStr}）`;
  });

  return `【情感状态】\n${lines.join('\n')}`;
}

export async function buildMemoryContext(params: {
  pairingId: string;
  turnCount: number;
  input: string;
  phase?: string;
}): Promise<string> {
  const results = await Promise.allSettled([
    params.turnCount <= 3 ? getDailyMemory(params.pairingId) : Promise.resolve(''),
    params.turnCount <= 3 ? getShortTermMemory(params.pairingId) : Promise.resolve(''),
    getMidTermMemory(params.input, params.pairingId),
    params.phase === 'GREETING' ? getGreetingHint(params.pairingId) : Promise.resolve(''),
    getRelationshipLayer(params.pairingId),
    getEmotionSnapshot(params.pairingId),
    getFeedMessages(params.pairingId),
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

  const relationship = results[4].status === 'fulfilled' ? results[4].value : '';
  if (relationship) rawSections.push(relationship);

  const emotion = results[5].status === 'fulfilled' ? results[5].value : '';
  if (emotion) rawSections.push(emotion);

  const feedMsgs = results[6].status === 'fulfilled' ? results[6].value : '';
  if (feedMsgs) rawSections.push(feedMsgs);

  const parsed = rawSections.map(parseSection);
  const deduped = deduplicateSections(parsed, 0.6);
  const truncated = truncateToBudget(deduped, TOKEN_BUDGET_CHARS);

  return truncated
    .map((s) => `${s.title}\n${s.bullets.join('\n')}`)
    .join('\n\n');
}
