import { getToneAdapter } from '../src/agent/tone-dictionary.js';
import { getHiddenGoal } from '../src/agent/hidden-goals.js';

async function runTests() {
  console.log('=== 测试 1: 方言语感器 (Tone Adapter) ===');
  const sichuanTone = getToneAdapter('四川话');
  console.log('四川话注入:\n', sichuanTone.join('\n'));
  console.log('\n----------------------------------------\n');

  console.log('=== 测试 2: 潜台词任务池 (Hidden Goal) ===');
  console.log('回合数 = 1:', getHiddenGoal(1));
  console.log('回合数 = 5:', getHiddenGoal(5));
  console.log('回合数 = 10:', getHiddenGoal(10));
  console.log('\n----------------------------------------\n');

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
  console.log('LLM 原始输出:\n', mockLlmOutput.trim());
  console.log('\n后端拦截提取后返回给前端的结果:\n', content);
}

runTests().catch(console.error);
