import { prisma } from '@xiaonuan/prisma';

export async function saveMessage(
  sessionId: string,
  role: 'COMPANIONEE' | 'AI',
  content: string
) {
  return prisma.sessionMessage.create({
    data: {
      sessionId,
      role,
      content,
    },
  });
}

export async function incrementTurnCount(sessionId: string) {
  return prisma.session.update({
    where: { id: sessionId },
    data: { turnCount: { increment: 1 } },
  });
}

export async function getRecentMessages(
  sessionId: string,
  limit: number = 10
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const messages = await prisma.sessionMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Reverse to chronological order (oldest first) for LLM context
  return messages.reverse().map((m) => {
    let content = m.content;
    if (content.length > 150) {
      content = content.slice(0, 150) + '…';
    }
    return {
      role: m.role === 'COMPANIONEE' ? ('user' as const) : ('assistant' as const),
      content,
    };
  });
}

export async function updateSessionPhase(
  sessionId: string,
  phase: string
) {
  return prisma.session.update({
    where: { id: sessionId },
    data: { phase: phase as any },
  });
}

export async function getSessionPhase(sessionId: string): Promise<string> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { phase: true },
  });
  return session?.phase ?? 'GREETING';
}
