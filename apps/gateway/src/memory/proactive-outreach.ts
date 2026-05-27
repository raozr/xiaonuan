import { prisma } from '@xiaonuan/prisma';
import { getRecentMessages } from '../conversation/turn-manager.js';
import { buildSystemPrompt } from '../agent/prompt-builder.js';
import { chatCompletion } from '../services/dashscope.js';
import { cleanLLMResponse } from '../agent/response-cleaner.js';
import { emitEvent } from '../events/event-bus.js';

const IDLE_THRESHOLD_HOURS = 72; // 3 天未对话
const OUTREACH_COOLDOWN_HOURS = 24; // 每天最多 1 条

export async function findInactivePairings(): Promise<string[]> {
  const threshold = new Date(Date.now() - IDLE_THRESHOLD_HOURS * 60 * 60 * 1000);

  // Find all pairings
  const pairings = await prisma.pairing.findMany({
    select: { id: true },
  });

  const inactiveIds: string[] = [];

  for (const pairing of pairings) {
    const lastSession = await prisma.session.findFirst({
      where: { pairingId: pairing.id },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    // No sessions ever, or last activity was too long ago
    if (!lastSession || lastSession.updatedAt < threshold) {
      inactiveIds.push(pairing.id);
    }
  }

  return inactiveIds;
}

export async function shouldSendOutreach(pairingId: string): Promise<boolean> {
  const lastOutreach = await prisma.eventStream.findFirst({
    where: {
      pairingId,
      type: 'proactive_outreach',
    },
    orderBy: { eventTime: 'desc' },
    select: { eventTime: true },
  });

  if (!lastOutreach) return true;

  const cooldown = new Date(Date.now() - OUTREACH_COOLDOWN_HOURS * 60 * 60 * 1000);
  return lastOutreach.eventTime < cooldown;
}

export async function generateOutreachMessage(
  pairingId: string
): Promise<string | null> {
  const companionee = await prisma.participant.findFirst({
    where: { pairingId, role: 'COMPANIONEE', isAI: false },
  });

  if (!companionee) return null;

  // Get last session messages for context
  const lastSession = await prisma.session.findFirst({
    where: { pairingId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  let recentMessages: Array<{ role: string; content: string }> = [];
  if (lastSession) {
    try {
      recentMessages = await getRecentMessages(lastSession.id, 6);
    } catch {
      // Session may have been deleted
    }
  }

  const systemPrompt = await buildSystemPrompt(pairingId, [], {
    time: new Date(),
    turnCount: 0,
    memoryText: '',
  });

  const messages = [
    {
      role: 'system' as const,
      content: `${systemPrompt}\n\n${companionee.name}已经 ${IDLE_THRESHOLD_HOURS / 24} 天没说话了。请生成一句简短、温暖的问候，关心${companionee.name}最近的情况。只说 1-2 句话，语气像家人一样自然。`,
    },
    ...recentMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: `（${companionee.name}很久没说话了）` },
  ];

  const reply = await chatCompletion(messages, {
    temperature: 0.9,
    maxTokens: 128,
  });

  return cleanLLMResponse(reply.content ?? '您最近好吗？我想您了。');
}

export async function sendOutreach(pairingId: string): Promise<boolean> {
  const shouldSend = await shouldSendOutreach(pairingId);
  if (!shouldSend) return false;

  const message = await generateOutreachMessage(pairingId);
  if (!message) return false;

  // Record the outreach event
  await emitEvent({
    pairingId,
    type: 'proactive_outreach',
    content: message,
  }, { immediate: true });

  return true;
}

export async function runProactiveOutreach(): Promise<{ sentCount: number; skippedCount: number }> {
  const inactivePairings = await findInactivePairings();
  let sentCount = 0;
  let skippedCount = 0;

  for (const pairingId of inactivePairings) {
    const success = await sendOutreach(pairingId);
    if (success) {
      sentCount++;
    } else {
      skippedCount++;
    }
  }

  return { sentCount, skippedCount };
}
