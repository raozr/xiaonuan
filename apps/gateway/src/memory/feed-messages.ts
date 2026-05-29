import { prisma } from '@xiaonuan/prisma';

export async function getFeedMessages(pairingId: string): Promise<string> {
  const feeds = await prisma.feedMessage.findMany({
    where: { pairingId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (feeds.length === 0) return '';

  const lines: string[] = [];
  for (const feed of feeds) {
    const minutesAgo = Math.round((Date.now() - feed.createdAt.getTime()) / 60000);
    const timeLabel =
      minutesAgo < 60
        ? `${minutesAgo}分钟前`
        : `${Math.round(minutesAgo / 60)}小时前`;
    const truncated =
      feed.content.length > 200
        ? feed.content.slice(0, 200) + '…'
        : feed.content;
    lines.push(`- [${timeLabel}] ${truncated}`);
  }

  return `【家人留言】\n${lines.join('\n')}`;
}
