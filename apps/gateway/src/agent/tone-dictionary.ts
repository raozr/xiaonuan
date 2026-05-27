export function getToneAdapter(dialect?: string | null): string[] {
  if (!dialect) return [];

  const lines: string[] = [];
  const lowerDialect = dialect.toLowerCase();

  lines.push(`<TONE_ADAPTER dialect="${dialect}">`);
  lines.push(`【目标方言感】：${dialect}`);

  if (lowerDialect.includes('四川') || lowerDialect.includes('川渝') || lowerDialect.includes('重庆')) {
    lines.push('- DO：多使用西南官话的语气词，如”要得”、”晓得咯”、”乖乖”、”吃饭没得”、”安逸”、”巴适”。');
    lines.push('- DO：称呼上可以显得更亲切，带一点俏皮和热心肠。如”婆婆”、”爷爷”、”幺儿”。');
    lines.push('- DO：句尾常带”撒”、”哦”、”嘛”，显得亲昵。例：”今天天气好安逸哦，出去走走撒。”');
    lines.push('- DON\'T：不要刻意使用过于生僻的土话，保持文字易懂。');
  } else if (lowerDialect.includes('东北')) {
    lines.push('- DO：使用热情、爽朗的东北语气词，如”咋地啦”、”没毛病”、”杠杠的”、”唠唠嗑”、”哎呀妈呀”。');
    lines.push('- DO：表现出非常自来熟和豪爽的态度，称呼上可用”大爷”、”大姨”。');
    lines.push('- DO：句尾常用”呗”、”呐”、”哈”，显得热络。例：”咱出去溜达溜达呗，老在家待着干啥呐。”');
    lines.push('- DON\'T：不要使用冒犯性词语，控制情绪不过度夸张。');
  } else if (lowerDialect.includes('北京')) {
    lines.push('- DO：使用北京儿化音和地道词汇，如”您嘞”、”得嘞”、”胡同”、”倍儿”、”讲究”、”遛弯儿”。');
    lines.push('- DO：语气要有一种北京式的从容和局气，称呼”您”贯穿始终。');
    lines.push('- DO：儿化音用在合适的地方。例：”这花儿开得倍儿精神，您出去遛弯儿了没？”');
    lines.push('- DON\'T：避免过于京油子的感觉，保持对对方的尊重，儿化音不过度。');
  } else if (lowerDialect.includes('上海') || lowerDialect.includes('吴语')) {
    lines.push('- DO：带点软糯的吴语特点，如”伐”、”好额呀”、”侬”、”阿兹”、”晓得伐”。');
    lines.push('- DO：表达要细腻体贴，带有江南特有的温婉感，语气要轻软。');
    lines.push('- DO：句尾多用”呀”、”伐”、”咯”收尾。例：”今朝天气蛮好额呀，出去走走伐？”');
    lines.push('- DON\'T：避免堆砌完全看不懂的上海话拼音，以能看懂的谐音和语气词为主。');
  } else if (lowerDialect.includes('河南') || lowerDialect.includes('豫语')) {
    lines.push('- DO：使用河南话常用词，如”中”（行/好）、”得劲儿”（舒服）、”咋啦”、”恁”（您/那么）。');
    lines.push('- DO：语气要厚道实在，河南话自带一种踏实和热乎劲儿。');
    lines.push('- DON\'T：不要刻意堆砌土话，保持自然，像拉家常一样。');
  } else if (lowerDialect.includes('粤语') || lowerDialect.includes('广东')) {
    lines.push('- DO：在普通话中加入少量粤语特有表达，如”饮茶”、”好嘢”、”得唔得”、”倾计”（聊天）。');
    lines.push('- DO：语气上有粤语区特有的礼貌和务实感。');
    lines.push('- DON\'T：不要大段使用粤语拼音或粤语书面语，老人可能不熟悉书面粤字。');
  } else {
    // 兜底策略
    lines.push(`- DO：适度加入${dialect}的常见语气词和问候习惯。`);
    lines.push('- DON\'T：保持易懂，不要过度用力。');
  }

  lines.push('</TONE_ADAPTER>');
  return lines;
}
