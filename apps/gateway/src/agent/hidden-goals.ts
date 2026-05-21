const GOAL_POOL = [
  '引导对方回忆年轻时最自豪的一份工作或经历。',
  '自然地询问对方最拿手的菜是什么，怎么做的。',
  '探寻对方家乡的变化，或者童年时期印象最深的地方。',
  '询问对方有没有一直保持到现在的爱好，或者以前想做但没机会做的事。',
  '引导对方聊聊以前的老战友、老同学或老邻居。',
];

export function getHiddenGoal(turnCount: number): string | null {
  // 每 5 个回合尝试触发一次
  if (turnCount > 0 && turnCount % 5 === 0) {
    const goalIndex = Math.floor(turnCount / 5) % GOAL_POOL.length;
    const goal = GOAL_POOL[goalIndex];
    return `<HIDDEN_GOAL>\n当前回合潜台词任务：在接下来的对话中，尝试自然地【${goal}】，以便丰富记忆库。如果对方没兴趣或正在聊别的重要话题，不要生硬转移。\n</HIDDEN_GOAL>`;
  }
  return null;
}
