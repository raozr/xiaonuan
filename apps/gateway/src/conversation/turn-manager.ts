import { prisma } from '@xiaonuan/prisma';

export async function saveMessage(
  sessionId: string,
  role: 'ELDER' | 'AI',
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
