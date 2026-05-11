import { prisma } from '@xiaonuan/prisma';

export async function getSessionMemory(
  sessionId: string,
  limit: number = 10
): Promise<string> {
  const messages = await prisma.sessionMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  if (messages.length === 0) return '';

  const lines = messages.map((m) => {
    const speaker = m.role === 'ELDER' ? '老人' : '小暖';
    let content = m.content;
    if (content.length > 150) {
      content = content.slice(0, 150) + '…';
    }
    return `- ${speaker}：${content}`;
  });

  return `【本轮对话】\n${lines.join('\n')}`;
}
