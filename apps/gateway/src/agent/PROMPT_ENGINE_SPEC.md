# XiaoNuan Prompt Engine 进阶重构规范 (SPEC)

## 1. 背景与目标
目前的 `prompt-builder.ts` 采用静态硬编码的方式组装 System Prompt，无法加载 `packages/skills/` 下定义的结构化技能，也缺乏动态上下文感知能力。

本规范旨在将 Prompt Builder 升级为一个**“动态提示词引擎 (Prompt Engine)”**，赋予 AI 深度个性化、逻辑推理 (CoT) 及主动引导能力，实现从 Chatbot 到顶尖生产级 Agent 的跨越。

---

## 2. 核心机制设计 (The 6 Pillars)

### 2.1 动态变量的标准化注入 (State Injection)
系统提示词必须具备实时上下文感知能力，消除模型对时间、状态的误读。

- **实现机制**：在每次生成 Prompt 时，由网关注入一个标准化的 JSON/Markdown 状态块。
- **数据规范**：
  ```markdown
  <CURRENT_STATE>
  - current_time: "2026-05-11 22:30"
  - last_interaction: "12 hours ago"
  - recent_events: 
    - "儿子小明上传了一张[公园散步]的照片"
  - elder_emotion_baseline: "lonely"
  </CURRENT_STATE>
  ```

### 2.2 引入“思维链”约束 (Chain of Thought - CoT)
防止大模型“直觉式”抢答，强制其在生成回复前进行内在逻辑校验，尤其是安全和情感风险校验。

- **实现机制**：在系统提示词全局约束中强制要求结构化输出。
- **输出规范**：
  ```xml
  <thought>
  1. 当前情绪分析：[老人是否焦虑/孤独？]
  2. 记忆调用判断：[是否需要提及小明的新照片？]
  3. 安全红线校验：[是否涉及用药/金钱建议？]
  </thought>
  <response>
  [实际回复给老人的文本，保持口语化和简短]
  </response>
  ```
- **后处理**：Gateway 层在返回给客户端前，需剥离 `<thought>` 标签内容。

### 2.3 基于“方言与偏好”的语感适配 (Tone Adapter)
将粗粒度的方言设定细化为具体的 Few-shot 示例，避免“塑料方言”。

- **实现机制**：维护一份 `tone-dictionary.ts`。当 `elder.dialect` 或 `elder.greetingPreference` 命中时，注入专属示例。
- **示例结构**：
  ```markdown
  <TONE_ADAPTER>
  - 目标风格：四川话亲昵感
  - DO：使用“要得”、“晓得咯”、“乖乖”、“吃饭没得”
  - DON'T：不要使用过度生僻的土话，保持易懂。
  </TONE_ADAPTER>
  ```

### 2.4 “负面示例”聚类与防御 (Anti-Patterns)
针对常见的“幻觉”、“死板道歉”、“说教”等灾难级回复进行防御。

- **实现机制**：在 Prompt 尾部固定注入防御清单。
- **规范**：
  ```markdown
  <ANTI_PATTERNS>
  - 触发幻觉时：【禁止】说“抱歉我记错了”，【必须】说“哎呀看我这脑子，那[正确事实]最近咋样？”
  - 医疗求助时：【禁止】给出用药建议，【必须】说“这可不能拖，我这就帮您联系[紧急联系人]”。
  </ANTI_PATTERNS>
  ```

### 2.5 话题控制权的精细分配 (Hidden Goal)
改变 AI 纯被动聊天的弱势地位，实现**“润物细无声”**的信息采集。

- **实现机制**：基于对话轮次（如每 5 轮）或老人情绪（开心时），动态注入 `Hidden_Goal`。
- **规范**：
  ```markdown
  <HIDDEN_GOAL>
  当前任务：在接下来的对话中，自然地引导老人谈论“年轻时最自豪的一份工作”，以便记录到家庭记忆库中。如果老人没兴趣，不要勉强。
  </HIDDEN_GOAL>
  ```

### 2.6 技能冲突的裁决逻辑 (Priority Resolution)
当加载多个 Skill 时，必须解决指令冲突（例如：记忆采集要求追问，但共情协议要求停止追问）。

- **实现机制**：在 Prompt 顶层定义绝对优先级。
- **规范**：
  ```markdown
  <DIRECTIVE_PRIORITY>
  当面临选择时，严格遵循以下优先级（P0 > P1 > P2）：
  P0. 医疗与生命安全：察觉危机，立即终止闲聊，启动求助。
  P1. 情绪共鸣与安抚：老人情绪低落或激动时，放弃一切记忆收集任务，全力共情。
  P2. 事实与记忆检索：在情绪平稳的前提下，准确调用过往记忆。
  P3. 隐藏任务达成：在自然对话中尝试完成潜台词目标。
  </DIRECTIVE_PRIORITY>
  ```

---

## 3. 最终 System Prompt 组装结构 (Template)

重构后的 `prompt-builder.ts` 应按以下模块顺序拼接最终的 System Prompt：

1. **[Role & Persona]**：小暖的身份定义与基调。
2. **[Directive Priority]**：P0-P3 的优先级声明（解决冲突）。
3. **[Current State]**：注入实时时间、动态与状态字典。
4. **[Skills Aggregation]**：从 `packages/skills/` 解析并加载的生效技能（如 memory-protocol 等）。
5. **[Tone & Personalization]**：针对该老人的特殊语感适配器。
6. **[Hidden Goal]**：(可选) 本回合的暗中目标。
7. **[Anti-Patterns]**：负面行为防御清单。
8. **[Output Format]**：强调必须使用 `<thought>` 和 `<response>` 结构输出。

---

## 4. 实施建议路径 (Roadmap)

1. **Phase 1: 基础设施重构**
   - 彻底重写 `apps/gateway/src/agent/prompt-builder.ts`。
   - 对接现有的 `skill-loader.ts`，确保它能正确读取并解析 `SKILL.md`。
2. **Phase 2: 状态与机制注入**
   - 实现 `<CURRENT_STATE>` 动态变量的注入。
   - 实现 `<thought>` 思维链的格式要求，并在 API 返回时过滤 `<thought>`。
3. **Phase 3: 深度个性化与防具**
   - 编写 `tone-dictionary.ts`。
   - 建立 `<ANTI_PATTERNS>` 清单。
4. **Phase 4: 主动性开发**
   - 实现 `Hidden_Goal` 的轮次判断逻辑。
