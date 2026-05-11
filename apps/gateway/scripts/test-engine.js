const GOAL_POOL = [
  '引导老人回忆年轻时最自豪的一份工作或经历。',
  '自然地询问老人最拿手的拿手菜是什么，怎么做的。',
  '探寻老人家乡的变化，或者童年时期印象最深的地方。',
  '询问老人有没有一直保持到现在的爱好，或者以前想做但没机会做的事。',
  '引导老人聊聊以前的老战友、老同学或老邻居。',
];

function getHiddenGoal(turnCount) {
  if (turnCount > 0 && turnCount % 5 === 0) {
    const goalIndex = Math.floor(turnCount / 5) % GOAL_POOL.length;
    const goal = GOAL_POOL[goalIndex];
    return `<HIDDEN_GOAL>\n当前回合潜台词任务：在接下来的对话中，尝试自然地【\${goal}】，以便丰富家庭记忆库。如果老人没兴趣或正在聊别的重要话题，不要生硬转移。\n</HIDDEN_GOAL>`;
  }
  return null;
}

function getToneAdapter(dialect) {
  if (!dialect) return [];
  const lines = [];
  const lowerDialect = dialect.toLowerCase();

  lines.push(`<TONE_ADAPTER dialect="\${dialect}">`);
  lines.push(`【目标方言感】：\${dialect}`);

  if (lowerDialect.includes('四川') || lowerDialect.includes('川渝') || lowerDialect.includes('重庆')) {
    lines.push('- DO：多使用西南官话语气的语气词，如“要得”、“晓得咯”、“乖乖”、“吃饭没得”、“安逸”。');
    lines.push('- DO：称呼上可以显得更亲切，带一点俏皮和热心肠。');
    lines.push("- DON'T：不要刻意使用过于生僻的土话，保持文字易懂，不要让人觉得在演戏。");
  } else {
    lines.push(`- DO：适度加入\${dialect}的常见语气词和问候习惯。`);
  }

  lines.push('</TONE_ADAPTER>');
  return lines;
}

console.log('=== 测试 1: 方言语感器 (Tone Adapter) ===');
const sichuanTone = getToneAdapter('四川话');
console.log('四川话注入:\\n', sichuanTone.join('\\n'));
console.log('\\n----------------------------------------\\n');

console.log('=== 测试 2: 潜台词任务池 (Hidden Goal) ===');
console.log('回合数 = 1:', getHiddenGoal(1));
console.log('回合数 = 5:', getHiddenGoal(5));
console.log('回合数 = 10:', getHiddenGoal(10));
console.log('\\n----------------------------------------\\n');

console.log('=== 测试 3: CoT 响应解析 (<response>) ===');
const mockLlmOutput = `
<thought>
1. 当前情绪分析：老人提到腰痛，可能有些焦虑和难受。
2. 技能调用判断：不需要检索记忆，应该优先表达关心。
3. 安全红线校验：涉及健康，需要温和建议看医生，不能直接给出用药建议。
</thought>
<response>
哎呀乖乖，腰痛可马虎不得哦。要是痛得凶，要得赶紧跟小李打个电话，去医院看一哈。您先躺倒歇哈儿嘛。
</response>
`;

let content = mockLlmOutput;
const responseMatch = content.match(/<response>([\s\S]*?)<\/response>/i);
if (responseMatch && responseMatch[1]) {
  content = responseMatch[1].trim();
}
console.log('LLM 原始输出:\\n', mockLlmOutput.trim());
console.log('\\n后端拦截提取后返回给前端的结果:\\n', content);
