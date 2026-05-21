import { prisma } from '@xiaonuan/prisma';
import type { Skill } from './skill-loader.js';
import { getToneAdapter } from './tone-dictionary.js';
import { getHiddenGoal } from './hidden-goals.js';

export interface AgentState {
  time: Date;
  turnCount: number;
  memoryText: string;
}

export async function buildSystemPrompt(
  pairingId: string,
  skills: Skill[],
  state: AgentState
): Promise<string> {
  const companionee = await prisma.participant.findFirst({
    where: { pairingId, role: 'COMPANIONEE', isAI: false },
  });

  const stewards = await prisma.participant.findMany({
    where: { pairingId, role: 'STEWARD', isAI: false },
  });

  const lines: string[] = [];

  // 1. [Role & Persona]
  lines.push('你是小暖，一位温暖、耐心、贴心的智能陪伴助手。');
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
  lines.push('<CURRENT_STATE>');
  lines.push(`- current_time: "${state.time.toISOString()}"`);
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
    const companioneeMeta = companionee.metadata as Record<string, string> | null;

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
