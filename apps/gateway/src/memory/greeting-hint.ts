import { prisma } from '@xiaonuan/prisma';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function getGreetingHint(familyId: string): Promise<string> {
  const lastSession = await prisma.session.findFirst({
    where: { familyId, endedAt: { not: null } },
    orderBy: { endedAt: 'desc' },
    select: { endedAt: true },
  });

  if (lastSession?.endedAt) {
    const elapsed = Date.now() - lastSession.endedAt.getTime();
    if (elapsed <= THREE_DAYS_MS) {
      return '';
    }
  }

  const checkpoint = await prisma.checkpoint.findFirst({
    where: {
      session: { familyId },
      nextTopicHint: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { nextTopicHint: true },
  });

  if (!checkpoint?.nextTopicHint) return '';

  return `【未尽话题】\n- 上次您提到${checkpoint.nextTopicHint}，今天咱们接着说？`;
}
