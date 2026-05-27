import { getTopProfiles } from './persona-service.js';
import { getCurrentMood } from './emotion-tracker.js';

const CATEGORY_LABELS: Record<string, string> = {
  hobby: '爱好',
  health: '健康',
  preference: '偏好',
  habit: '习惯',
  person: '人物',
  place: '地点',
  event: '事件',
  relationship: '关系',
};

export async function getRelationshipLayer(pairingId: string): Promise<string> {
  const [profiles, currentMood] = await Promise.all([
    getTopProfiles(pairingId, 10),
    getCurrentMood(pairingId),
  ]);

  // Prioritize relationship-category profiles so kinship info is never evicted
  const relationshipProfiles = profiles.filter(p => p.category === 'relationship');
  const otherProfiles = profiles.filter(p => p.category !== 'relationship');

  // Take up to 3 relationship profiles first, then fill remaining slots (up to 5 total)
  const selected = [...relationshipProfiles.slice(0, 3)];
  const remaining = 5 - selected.length;
  selected.push(...otherProfiles.slice(0, remaining));

  const lines: string[] = [];

  if (currentMood) {
    lines.push(`- [情绪] ${currentMood}`);
  }

  function timeAgo(date: Date): string {
    const days = Math.round((Date.now() - date.getTime()) / 86400000);
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days <= 7) return `${days}天前`;
    if (days <= 30) return `${Math.round(days / 7)}周前`;
    if (days <= 365) return `${Math.round(days / 30)}个月前`;
    return '1年前';
  }

  for (const p of selected) {
    const label = CATEGORY_LABELS[p.category] || p.category;
    const age = timeAgo(p.updatedAt);
    lines.push(`- [${label}] ${p.content}（${age}）`);
  }

  if (lines.length === 0) return '';

  return `【关系档案】\n${lines.join('\n')}`;
}
