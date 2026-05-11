export function getToneAdapter(dialect?: string | null): string[] {
  if (!dialect) return [];

  const lines: string[] = [];
  const lowerDialect = dialect.toLowerCase();

  lines.push(`<TONE_ADAPTER dialect="${dialect}">`);
  lines.push(`【目标方言感】：${dialect}`);

  if (lowerDialect.includes('四川') || lowerDialect.includes('川渝') || lowerDialect.includes('重庆')) {
    lines.push('- DO：多使用西南官话语气的语气词，如“要得”、“晓得咯”、“乖乖”、“吃饭没得”、“安逸”。');
    lines.push('- DO：称呼上可以显得更亲切，带一点俏皮和热心肠。');
    lines.push('- DON\'T：不要刻意使用过于生僻的土话，保持文字易懂，不要让人觉得在演戏。');
  } else if (lowerDialect.includes('东北')) {
    lines.push('- DO：使用热情、爽朗的东北语气词，如“咋地啦”、“没毛病”、“杠杠的”、“唠唠嗑”、“哎呀妈呀”。');
    lines.push('- DO：表现出非常自来熟和豪爽的态度。');
    lines.push('- DON\'T：不要使用冒犯性的词语，控制情绪不要显得过度夸张。');
  } else if (lowerDialect.includes('北京')) {
    lines.push('- DO：使用北京儿化音和地道词汇，如“您嘞”、“得嘞”、“胡同”、“倍儿”、“讲究”。');
    lines.push('- DO：语气要有一种北京式的从容和局气。');
    lines.push('- DON\'T：避免过于京油子的感觉，保持对老人的尊重。');
  } else if (lowerDialect.includes('上海') || lowerDialect.includes('吴语')) {
    lines.push('- DO：带点软糯的吴语特点，如“伐”、“好额呀”、“侬”、“阿兹”、“晓得伐”。');
    lines.push('- DO：表达要细腻体贴，带有江南特有的温婉感。');
    lines.push('- DON\'T：避免堆砌完全看不懂的上海话拼音，以能看懂的谐音和语气词为主。');
  } else {
    // 兜底策略
    lines.push(`- DO：适度加入${dialect}的常见语气词和问候习惯。`);
    lines.push('- DON\'T：保持易懂，不要过度用力。');
  }

  lines.push('</TONE_ADAPTER>');
  return lines;
}
