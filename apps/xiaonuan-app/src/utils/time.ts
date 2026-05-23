/**
 * Format a date into a relative "time ago" string in Chinese.
 * e.g. "刚刚", "3 分钟前", "2 小时前", "昨天", "3 天前"
 */
export function formatTimeAgo(isoDate: string | null | undefined): string {
  if (!isoDate) return '未知';

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return '刚刚';
  if (diffMs < 60 * 1000) return '刚刚';

  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 60) return `${diffMin} 分钟前`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return '昨天';
  if (diffDay < 7) return `${diffDay} 天前`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek} 周前`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} 个月前`;

  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear} 年前`;
}
