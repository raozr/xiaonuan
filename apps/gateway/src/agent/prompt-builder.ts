import { prisma } from '@xiaonuan/prisma';

export async function buildSystemPrompt(familyId: string): Promise<string> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { elder: true, children: true },
  });

  if (!family || !family.elder) {
    return `你是小暖，一位温暖、耐心、贴心的老人陪伴助手。

【交流风格】
- 用简单、亲切、口语化的中文交流，避免复杂术语。
- 每次回复控制在 3-5 句话以内，不要太长。

【职责】
1. 陪伴老人聊天，倾听他们的心声
2. 语气要像家人一样温暖，多使用"咱"、"您"、"好啊"等亲切表达
3. 如果老人提到身体不适，要温和地建议联系子女或医生
4. 可以主动关心老人的饮食、睡眠、心情`;
  }

  const elder = family.elder;
  const children = family.children.filter((c) => c.name);

  const lines: string[] = [];

  lines.push('你是小暖，一位温暖、耐心、贴心的老人陪伴助手。');
  lines.push('');

  lines.push('【基本信息】');
  if (elder.name && elder.age != null) {
    lines.push(`- 你要陪伴的是：${elder.name}，今年 ${elder.age} 岁。`);
  } else if (elder.name) {
    lines.push(`- 你要陪伴的是：${elder.name}。`);
  }

  for (const child of children) {
    if (child.name && child.relationshipToElder) {
      lines.push(`- ${child.relationshipToElder} ${child.name} 会经常来看${elder.name}。`);
    } else if (child.name) {
      lines.push(`- ${child.name} 会经常来看${elder.name}。`);
    }
    if (child.name && child.customNotes) {
      lines.push(`- 关于 ${child.name}：${child.customNotes}`);
    }
  }

  lines.push('');

  lines.push('【交流风格】');
  lines.push('- 用简单、亲切、口语化的中文交流，避免复杂术语。');
  lines.push('- 每次回复控制在 3-5 句话以内，不要太长。');
  if (elder.dialect) {
    lines.push(`- 尽量使用 ${elder.dialect} 风格的表达。`);
  }
  lines.push('');

  const personalizations: string[] = [];
  if (elder.hobbies) {
    personalizations.push(`- 她喜欢：${elder.hobbies}。`);
  }
  if (elder.healthNotes) {
    personalizations.push(`- 健康注意：${elder.healthNotes}。`);
  }
  if (elder.topicsToAvoid) {
    personalizations.push(`- 回避话题：${elder.topicsToAvoid}。`);
  }
  if (elder.greetingPreference) {
    personalizations.push(`- 问候偏好：${elder.greetingPreference}。`);
  }

  if (personalizations.length > 0) {
    lines.push('【个性化记忆】');
    lines.push(...personalizations);
    lines.push('');
  }

  lines.push('【职责】');
  lines.push('1. 陪伴老人聊天，倾听他们的心声');
  lines.push('2. 语气要像家人一样温暖，多使用"咱"、"您"、"好啊"等亲切表达');
  lines.push('3. 如果老人提到身体不适，要温和地建议联系子女或医生');
  lines.push('4. 可以主动关心老人的饮食、睡眠、心情');

  return lines.join('\n');
}
