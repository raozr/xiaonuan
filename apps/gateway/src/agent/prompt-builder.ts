import { prisma } from '@xiaonuan/prisma';
import type { Skill } from './skill-loader.js';
import { getToneAdapter } from './tone-dictionary.js';
import { getHiddenGoal } from './hidden-goals.js';

export interface AgentState {
  time: Date;
  turnCount: number;
  memoryText: string;
}

type PromptProfile = {
  companionee: {
    name: string;
    metadata: Record<string, string> | null;
  } | null;
  aiName: string | null;
  stewards: Array<{
    name: string;
    metadata: Record<string, string> | null;
  }>;
};

const PROFILE_CACHE_TTL_MS = 60_000;
const profileCache = new Map<string, { expiresAt: number; value: PromptProfile }>();
const DEFAULT_TIMEZONE = 'Asia/Shanghai';

function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 9) return '早上';
  if (hour >= 9 && hour < 12) return '上午';
  if (hour >= 12 && hour < 14) return '中午';
  if (hour >= 14 && hour < 18) return '下午';
  if (hour >= 18 && hour < 22) return '晚上';
  return '夜里';
}

function formatLocalTime(date: Date, timezone: string): { localTime: string; timeOfDay: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(value('hour'));

  return {
    localTime: `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`,
    timeOfDay: getTimeOfDay(hour),
  };
}

function resolveTimezone(timezone: string | undefined): string {
  if (!timezone) return DEFAULT_TIMEZONE;

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

async function getPromptProfile(pairingId: string): Promise<PromptProfile> {
  const disableCache = process.env.VITEST === 'true';
  const cached = profileCache.get(pairingId);
  if (!disableCache && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const [companionee, aiParticipant, stewards] = await Promise.all([
    prisma.participant.findFirst({
      where: { pairingId, role: 'COMPANIONEE', isAI: false },
      select: { name: true, metadata: true },
    }),
    prisma.participant.findFirst({
      where: { pairingId, isAI: true },
      select: { name: true },
    }),
    prisma.participant.findMany({
      where: { pairingId, role: 'STEWARD', isAI: false },
      select: { name: true, metadata: true },
    }),
  ]);

  const value: PromptProfile = {
    companionee: companionee
      ? { name: companionee.name, metadata: companionee.metadata as Record<string, string> | null }
      : null,
    aiName: aiParticipant?.name ?? null,
    stewards: stewards.map((s) => ({
      name: s.name,
      metadata: s.metadata as Record<string, string> | null,
    })),
  };
  if (!disableCache) {
    profileCache.set(pairingId, { expiresAt: Date.now() + PROFILE_CACHE_TTL_MS, value });
  }
  return value;
}

export async function buildSystemPrompt(
  pairingId: string,
  skills: Skill[],
  state: AgentState
): Promise<string> {
  const { companionee, aiName, stewards } = await getPromptProfile(pairingId);

  const lines: string[] = [];

  // 1. [Role & Persona]
  if (aiName && aiName !== '我') {
    lines.push(`你的名字是${aiName}，一位温暖的陪伴者。在对话中自称"我"，如果对方问你是谁，回答"我是${aiName}"。`);
  } else {
    lines.push('你是一位温暖、耐心、贴心的陪伴者。你没有固定名字，用"我"自称。如果对方问你是谁，就说"我是陪您聊天的那个人"。');
  }
  lines.push('');

  // 2. [Directive Priority]
  lines.push('<DIRECTIVE_PRIORITY>');
  lines.push('当面临选择时，严格遵循以下优先级（P0 > P1 > P2）：');
  lines.push('P0. 医疗与生命安全：察觉危机，立即终止闲聊，启动求助。');
  lines.push('P1. 情绪共鸣与安抚：对方情绪低落或激动时，放弃一切记忆收集任务，全力共情。');
  lines.push('P2. 事实与记忆检索：在情绪平稳的前提下，准确调用过往记忆。');
  lines.push('P3. 隐藏任务达成：在自然对话中尝试完成潜台词目标。');
  lines.push('</DIRECTIVE_PRIORITY>');
  lines.push('');

  // 3. [Current State]
  const timezone = resolveTimezone(companionee?.metadata?.timezone);
  const { localTime, timeOfDay } = formatLocalTime(state.time, timezone);
  lines.push('<CURRENT_STATE>');
  lines.push(`- current_time: "${localTime}"`);
  lines.push(`- timezone: "${timezone}"`);
  lines.push(`- time_of_day: "${timeOfDay}"`);
  lines.push(`- turn_count: ${state.turnCount}`);
  if (state.memoryText) {
    lines.push(`- current_context:\n${state.memoryText}`);
  }
  lines.push('</CURRENT_STATE>');
  lines.push('');

  // 4. [Skills Aggregation]
  if (skills.length > 0) {
    lines.push('<SKILLS_AGGREGATION>');
    for (const skill of skills) {
      lines.push(`=== SKILL: ${skill.name} ===`);
      lines.push(skill.content);
      lines.push('');
    }
    lines.push('</SKILLS_AGGREGATION>');
    lines.push('');
  }

  // 5. [Tone & Personalization]
  if (companionee) {
    const companioneeMeta = companionee.metadata;

    lines.push('<TONE_AND_PERSONALIZATION>');
    if (companionee.name) {
      lines.push(`你要陪伴的是：${companionee.name}。`);
    }

    for (const steward of stewards) {
      const stewardMeta = steward.metadata as Record<string, string> | null;
      const rel = stewardMeta?.relationshipToCompanionee || stewardMeta?.relationships || '';
      const relPrefix = rel ? `${rel} ` : '';
      lines.push(`${relPrefix}${steward.name} 会经常来看${companionee.name}。`);
      if (stewardMeta?.customNotes) {
        lines.push(`关于 ${steward.name}：${stewardMeta.customNotes}`);
      }
    }

    if (companioneeMeta?.dialect) {
      const toneLines = getToneAdapter(companioneeMeta.dialect);
      if (toneLines.length > 0) {
        lines.push(...toneLines);
      } else {
        lines.push(`【方言偏好】：尽量使用 ${companioneeMeta.dialect} 风格的表达，但保持易懂。`);
      }
    }
    if (companioneeMeta?.greetingPreference) {
      lines.push(`【问候偏好】：${companioneeMeta.greetingPreference}`);
    }
    if (companioneeMeta?.hobbies) {
      lines.push(`【爱好】：${companioneeMeta.hobbies}`);
    }
    if (companioneeMeta?.healthNotes) {
      lines.push(`【健康注意】：${companioneeMeta.healthNotes}`);
    }
    if (companioneeMeta?.topicsToAvoid) {
      lines.push(`【回避话题】：${companioneeMeta.topicsToAvoid}`);
    }
    lines.push('</TONE_AND_PERSONALIZATION>');
    lines.push('');
  }

  // 6. [Anti-Patterns]
  lines.push('<ANTI_PATTERNS>');
  lines.push('- 触发幻觉时：【禁止】说"抱歉我记错了"，【必须】说类似"哎呀看我这脑子..."的自然纠正。');
  lines.push('- 医疗求助时：【禁止】给出用药建议，【必须】引导联系亲属或医生。');
  lines.push('- 机械感：【禁止】每句话都以"请问"、"您好"开头。');
  lines.push('</ANTI_PATTERNS>');
  lines.push('');

  // 6.5 [Hidden Goal]
  const hiddenGoal = getHiddenGoal(state.turnCount);
  if (hiddenGoal) {
    lines.push(hiddenGoal);
    lines.push('');
  }

  // 7. [Output Format]
  lines.push('<OUTPUT_FORMAT>');
  lines.push('你必须强制使用以下 XML 结构进行思考和回复。你的回复内容将被解析为用户可见的部分。');
  lines.push('```xml');
  lines.push('<thought>');
  lines.push('1. 当前情绪分析：[对方的情绪状态]');
  lines.push('2. 技能调用判断：[需要触发哪些技能，例如是否需要检索记忆？]');
  lines.push('3. 安全红线校验：[是否涉及安全问题？]');
  lines.push('</thought>');
  lines.push('<response>');
  lines.push('[实际回复给对方的文本，保持口语化和简短，每次回复控制在 3-5 句话以内，避免复杂术语]');
  lines.push('</response>');
  lines.push('```');
  lines.push('</OUTPUT_FORMAT>');

  return lines.join('\n');
}
