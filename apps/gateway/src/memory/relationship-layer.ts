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
};

export async function getRelationshipLayer(pairingId: string): Promise<string> {
  const [profiles, currentMood] = await Promise.all([
    getTopProfiles(pairingId, 5),
    getCurrentMood(pairingId),
  ]);

  const lines: string[] = [];

  if (currentMood) {
    lines.push(`- [情绪] ${currentMood}`);
  }

  for (const p of profiles) {
    const label = CATEGORY_LABELS[p.category] || p.category;
    lines.push(`- [${label}] ${p.content}`);
  }

  if (lines.length === 0) return '';

  return `【关系档案】\n${lines.join('\n')}`;
}
