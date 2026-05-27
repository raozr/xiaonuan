import { prisma } from '@xiaonuan/prisma';

export async function getSessionMemory(
  sessionId: string,
  pairingId: string,
  limit: number = 10
): Promise<string> {
  const [messages, aiParticipant] = await Promise.all([
    prisma.sessionMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }),
    prisma.participant.findFirst({
      where: { pairingId, isAI: true },
      select: { name: true },
    }),
  ]);

  if (messages.length === 0) return '';

  const aiLabel = aiParticipant?.name && aiParticipant.name !== '我' ? aiParticipant.name : '我';
  const lines = messages.map((m) => {
    const speaker = m.role === 'COMPANIONEE' ? '对方' : aiLabel;
    let content = m.content;
    if (content.length > 150) {
      content = content.slice(0, 150) + '…';
    }
    return `- ${speaker}：${content}`;
  });

  return `【本轮对话】\n${lines.join('\n')}`;
}
