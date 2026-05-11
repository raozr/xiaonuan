# SPEC: 分层记忆系统

*Spec Version: 2.0*
*Last Updated: 2026-05-11*

---

## 1. Objective

**目标**：为 Pi Agent 接入分层记忆系统，使 AI 在单次对话及跨会话场景中都能引用不同时间粒度的上下文，从而告别"每轮从零开始"的体验，让老人感受到小暖"记得住事"。

**目标用户**：
- **主要受益用户**：老人（Elder）。对话更连贯、更 personalized，AI 能自然引用当天早些时候聊过的话题、几天前提到的身体状况、长期的家庭关系等。
- **间接用户**：子女（Child）。子女设置的信息（爱好、健康注意、回避话题）属于长期记忆层，已通过 System Prompt 生效；本 SPEC 让 AI 对"动态发生的事实"也有记忆。

**成功标准**：
- 单次对话中，AI 能感知当前 session 的多轮上下文（回话记忆）。
- 同一天内多次打开小程序，AI 能记住上午聊过什么（当天记忆）。
- 聊起几天前的话题时，AI 能引用之前的关键信息（短期记忆）。
- 当老人提到某个爱好、地点或家人时，AI 能从历史对话中召回相关细节（中短期记忆）。
- 老人基本信息、家属关系等静态信息始终作为长期记忆打底（已有，保持不变）。

**关于主动引用 vs 被动引用**：
采用 **Context Injection 模式**——把各层记忆整理成自然语言文本注入 LLM 上下文，由模型自主决定是否引用、如何引用。不硬编码"必须主动提及"的规则，也不完全被动等待询问。后续根据实际对话效果再调优。

---

## 2. Core Features & Acceptance Criteria

### Feature 1: 回话记忆（Session Memory）

**描述**：当前 WebSocket session 内的多轮对话历史自动注入到 LLM 的 messages 上下文。

**实现要求**：
- `turn-manager.ts` 新增 `getRecentMessages(sessionId, limit)`，按 `createdAt` 升序查询最近 N 条消息。
- `pi-agent.ts` 的 `processMessage` 在构造 messages 数组时，把回话历史放在 system prompt 之后、当前 user message 之前。
- 保留条数上限：`limit = 10`（可配置），超出部分丢弃，控制 token 消耗。
- 单条消息长度上限：单条消息超过 150 个汉字时截断（保留前 150 字 + "…"），防止某一轮超长消息占用过多 token。
- 消息格式：每条历史消息保持原 `role`（ELDER → user，AI → assistant）。

**AC**：
- [ ] 同一 session 内，老人说"我刚才说什么了"，AI 能正确引用之前的对话内容。
- [ ] 回话记忆只包含当前 session，不包含其他 session。
- [ ] 回话记忆条数不超过 10 条，防止 token 爆炸。
- [ ] 后端测试验证：mock prisma 后，`processMessage` 构造的 messages 数组包含正确的历史消息序列。

---

### Feature 2: 当天记忆（Daily Memory）

**描述**：同一天内（00:00 - 23:59）该家庭的所有已结束 session 的 checkpoint 摘要，自动汇总为"今日概览"注入上下文。

**实现要求**：
- 新建 `apps/gateway/src/memory/daily-memory.ts`：
  - `getDailySummary(familyId)`：查询当天（本地时间 00:00 起）所有 `Session.endedAt != null` 的 session，提取其关联的 `Checkpoint.topicSummary`，拼接为简洁文本。
  - 若无当天已结束 session，返回空字符串（不注入）。
- `context-builder.ts` 在构造记忆上下文时，把当天记忆作为独立区块插入。
- **注入策略**：当天记忆仅在 session 的前 3 轮对话中注入（含 GREETING 阶段）。从第 4 轮起不再重复注入，避免 token 累积。
- 当天记忆文本示例：
  ```
  【今日回顾】
  - 上午聊到您儿子周末要回来看您。
  - 您提到最近膝盖不太舒服。
  ```

**AC**：
- [ ] 老人上午聊完后关闭小程序，下午再次进入，AI 能自然接续上午的话题或提及上午聊到的事。
- [ ] 若当天无其他 session，不注入"今日回顾"区块，避免空内容。
- [ ] 测试验证：mock prisma 中创建当天和昨天的 session + checkpoint，验证只有当天的被注入。

---

### Feature 3: 短期记忆（Short-term Memory）

**描述**：最近 3 天内（不含当天）的 checkpoint 摘要聚合，提炼关键事实与情绪线索。

**实现要求**：
- 新建 `apps/gateway/src/memory/short-term-memory.ts`：
  - `getShortTermSummary(familyId)`：查询最近 3 天内（当天除外）的 checkpoint，按天分组，每组选取最关键的 1-2 条 `keyFacts`。
  - 返回格式化为简洁的要点列表。
- **注入策略**：与当天记忆相同，仅在 session 的前 3 轮对话中注入。第 4 轮起不再重复注入。
- 若结果为空，不注入。
- 短期记忆文本示例：
  ```
  【近日动态】
  - 前天您提到天气转凉，记得添衣服。
  - 昨天您和隔壁李阿姨通了电话，聊得很开心。
  ```

**AC**：
- [ ] 老人聊起"前天我说的事"，AI 能基于短期记忆正确回应。
- [ ] 短期记忆最多聚合 3 天的内容，每天最多 2 条 keyFacts，防止文本过长。
- [ ] 测试验证：mock 不同日期的 checkpoint，验证时间窗口和选取逻辑正确。

---

### Feature 4: 中短期记忆（Mid-term Memory）

**描述**：基于 Qdrant 向量检索（`memory_recall`）和 `FamilyFeed` 内容，按语义相关性召回与当前话题相关的历史记忆，而非按时间。**按需触发**，不是每轮对话都加载。

**实现要求**：
- 新建 `apps/gateway/src/memory/mid-term-memory.ts`：
  - `getMidTermContext(query, familyId)`：调用现有 `memoryRecall(query, familyId, undefined, 3)`，获取 top 3 相关向量记忆。
  - 同时查询 `FamilyFeed` 中 `category` 为 `PREFERENCE` 或 `HEALTH` 的最近 5 条记录（作为结构化事实补充）。
  - 把向量检索结果和 FamilyFeed 记录整理为自然语言文本。
- **触发策略（按需）**：
  - `pi-agent.ts` 的 `processMessage` 在拿到用户输入后，**先判断是否需要召回**：
    - 若用户输入包含具体实体词（人名、地点、爱好、疾病等），或输入长度 ≥ 10 字，则执行 `getMidTermContext(input, familyId)`。
    - 若输入为极短句（如"嗯"、"好的"、"是"），跳过中短期检索，节省 token 和耗时。
  - 召回结果非空时才注入 messages，空结果不产生任何文本。
- 中短期记忆文本示例：
  ```
  【相关回忆】
  - 您以前提到喜欢早上去公园打太极。
  - 关于您的腰：建议避免久坐，适当热敷。
  ```

**AC**：
- [ ] 当老人提到"太极"，AI 能召回之前关于"早上去公园打太极"的记忆。
- [ ] 当老人提到"腰"，AI 能召回 healthNotes 或 FamilyFeed 中的健康建议。
- [ ] 向量检索只返回本家庭（`familyId`）的数据，严格数据隔离。
- [ ] 测试验证：mock qdrant search 和 prisma FamilyFeed 查询，验证返回结果正确拼接。

---

### Feature 5: 长期记忆（Long-term Memory）

**描述**：老人基本信息、家属关系、爱好、健康注意、回避话题等静态信息。

**实现要求**：
- **已有实现**：`prompt-builder.ts` 中的 `buildSystemPrompt` 已覆盖此层。
- 本次 **不修改** `prompt-builder.ts` 的核心逻辑，仅确保 `context-builder.ts` 把长期记忆与动态记忆正确拼接，避免重复或冲突。

**AC**：
- [ ] 长期记忆继续通过 System Prompt 生效，AI 仍能在每轮对话中准确称呼老人姓名、使用方言风格、回避禁忌话题。
- [ ] 动态记忆（回话/当天/短期/中短期）注入后，不与 System Prompt 中的静态信息矛盾。

---

### Feature 6: Checkpoint 自动生成

**描述**：自动调用 LLM 生成 checkpoint，提取话题摘要、关键事实、情绪快照、下次话题提示。采用"连接断开 + 延迟确认"与"每 5 轮增量更新"双保险机制。

**实现要求**：
- 新建 `apps/gateway/src/memory/checkpoint-service.ts`：
  - `generateCheckpoint(sessionId)`：读取该 session 的所有消息，构造 prompt 让 LLM 生成 JSON：
    ```json
    {
      "topicSummary": " string, 30字以内 ",
      "keyFacts": [" string ", " string "],
      "moodSnapshot": " string, 20字以内 ",
      "nextTopicHint": " string, 可选 "
    }
    ```
  - 把结果写入 `Checkpoint` 表。若该 session 已存在 checkpoint，则**更新覆盖**（增量更新）。
- **触发时机（双保险）**：
  1. **主触发：连接断开 + 5 分钟延迟窗口**
     - `session-handler.ts` 的 `socket.on('close')` 时，启动一个 5 分钟的延迟任务（`setTimeout`）。
     - 若 5 分钟内老人通过 `session:resume` 恢复同一会话 → 取消延迟任务，session 继续。
     - 若 5 分钟内无恢复 → 标记 session 为 `ENDED`，触发 `generateCheckpoint`。
  2. **保险触发：每 5 轮增量更新**
     - 在 `handleVoiceText` 的 `incrementTurnCount` 后判断 `turnCount % 5 === 0`。
     - 若满足条件，异步调用 `generateCheckpoint(sessionId)` 更新 checkpoint。
     - 确保即使异常断开（手机没电、闪退），也能保留最近 5 轮的摘要。
- Checkpoint 生成是**异步后台任务**，不阻塞 AI 回复老人。
- 若 session 消息为空或极少（< 2 轮），不生成 checkpoint。

**AC**：
- [ ] WebSocket 连接断开后，若老人 5 分钟内未恢复，session 自动标记为 ENDED 并生成 checkpoint。
- [ ] WebSocket 连接断开后，若老人 3 分钟内通过 `session:resume` 恢复，不生成 checkpoint，session 继续。
- [ ] 每 5 轮对话后，checkpoint 被增量更新（不阻塞回复）。
- [ ] Checkpoint 内容包含自然的 topicSummary 和至少一条 keyFacts。
- [ ] Checkpoint 生成不阻塞 WebSocket 回复（异步执行）。
- [ ] 测试验证：mock LLM 返回固定 JSON，验证 checkpoint 正确写入 prisma。

---

### Feature 7: Session Phase 状态机

**描述**：让 `SessionPhase`（GREETING → ACTIVE_CHAT → CLOSING → ENDED）真正运转起来，不同阶段加载不同 skill 和记忆上下文。

**实现要求**：
- 新建 `apps/gateway/src/state-machine/index.ts`：
  - `definePhaseTransition(currentPhase, event)` → 返回新 phase。
  - 规则：
    - `GREETING` + `first_message_received` → `ACTIVE_CHAT`
    - `ACTIVE_CHAT` + `elder_silent_30s` → `CLOSING`
    - `CLOSING` + `elder_speaks_again` → `ACTIVE_CHAT`
    - `CLOSING` + `session_close` → `ENDED`（主结束路径：WebSocket 断开 + 5 分钟未恢复）
    - 任意 phase + `session_close` → `ENDED`
  - 注：`elder_silent_30s` 的检测先在后端通过 WebSocket 消息时间戳简单实现，不依赖 Phase 3 的 VAD。Session 结束以 `session_close` 事件为主，不再依赖第二段静默超时。
- `session-handler.ts`：
  - `session:create` 时 phase 仍为 `GREETING`（而非硬编码 `ACTIVE_CHAT`）。
  - 收到第一条 `message:voice_text` 时，触发 `GREETING → ACTIVE_CHAT` 转换。
  - 转换后通知前端 `phase:changed`。
- `pi-agent.ts`：
  - `createPiAgent` 根据 `config.phase` 调用 `loadSkillsForPhase(phase)`，已支持。
  - `GREETING` 阶段的 skill 中应包含"根据短期/当天记忆生成温暖开场白"的指令。
- `turn-manager.ts` 新增 `updateSessionPhase(sessionId, phase)`。

**AC**：
- [ ] 新 session 创建后处于 GREETING 阶段，AI 的第一句回复是问候/开场白（而非直接应答）。
- [ ] 老人发送第一条消息后，进入 ACTIVE_CHAT，后续为正常对话。
- [ ] 老人 30 秒未说话，进入 CLOSING，AI 可以说"您先休息，我随时在"。
- [ ] 老人在 CLOSING 阶段再次说话，回到 ACTIVE_CHAT。
- [ ] Session 关闭后，phase 为 ENDED。
- [ ] 测试验证：mock WebSocket 消息序列，验证 phase 转换符合状态图。

### Feature 8: Qdrant family_memories Collection 初始化

**描述**：`checkpoint-service.ts` 在生成 checkpoint 时会向 Qdrant `family_memories` collection 写入向量数据，`memoryRecall` 也依赖该 collection 进行语义检索。但目前 Qdrant 中缺少该 collection，导致中短期记忆检索实际被降级为空结果。本特性确保网关在启动时自动、幂等地创建并配置好该 collection。

**实现要求**：
- 改造 `apps/gateway/src/qdrant/client.ts`：
  - 新增 `ensureFamilyMemoriesCollection()` 函数，封装完整的 collection 初始化逻辑。
  - **向量配置**：size = 1024（与 `text-embedding-v4` 默认输出维度一致），distance = `'Cosine'`。
  - **Payload 索引**：collection 创建成功后，为 `familyId` 字段创建 `keyword` 类型的 payload 索引，加速按家庭过滤的检索。
  - 幂等设计：先调用 `collectionExists` 检查，已存在则直接跳过，不删除或覆盖已有数据。
- 在 `apps/gateway/src/index.ts`（或 Fastify 插件注册流程）中，于服务启动阶段调用 `ensureFamilyMemoriesCollection()`。
- **容错**：Qdrant 不可达时，启动流程记录错误日志但**不阻塞服务启动**，中短期记忆暂时降级为空结果，待 Qdrant 恢复后重启即可。

**AC**：
- [ ] 网关启动时，若 Qdrant 中不存在 `family_memories`，自动创建。
- [ ] collection 的向量配置为 1024 维 + Cosine 距离。
- [ ] `familyId` keyword 索引已创建。
- [ ] 重复启动不会报错或丢失数据。
- [ ] Qdrant 不可达时服务仍能启动，并输出清晰警告日志。
- [ ] 测试验证：mock qdrant client，验证存在时跳过、不存在时创建并建索引。

---

## 3. Tech Stack & Constraints

**技术栈**（复用现有，不改选型）：
- 网关：Node.js + Fastify + TypeScript
- 数据库：PostgreSQL + Prisma
- 向量库：Qdrant（已有 `memoryRecall`）
- AI：DashScope (Qwen-Plus) HTTP API
- 前端：微信小程序（本次后端 SPEC，前端改动极小）

**约束**：
- 所有记忆查询 + 上下文注入总耗时 ≤ 200ms（保证对话流畅）。
- 注入 LLM 的文本总量控制：
  - **日常轮次（第 4 轮以后）**：System Prompt（长期，~500 tokens）+ 回话历史（10 条，~800 tokens）= ~1300 tokens。
  - **会话初期（前 3 轮）**：额外叠加 当天记忆（~200 tokens）+ 短期记忆（~200 tokens）+ 按需的中短期记忆（~200-400 tokens），总上限 ≤ 2500 tokens。
  - 为 AI 回复保留至少 1000 tokens 空间。
- 中短期记忆的 `embedText` 目前是确定性伪随机向量（TODO：后续替换为真实 embedding 模型）。本次 SPEC **不解决 embedding 质量**，只确保检索链路正确接入。
- Checkpoint 生成异步执行，不得阻塞 WebSocket 消息回复。
- 所有数据操作严格按 `familyId` 隔离。

---

## 4. Project Structure

本次变更涉及文件清单：

```
# [新建] 分层记忆模块
apps/gateway/src/memory/
  ├── index.ts                    # 统一导出
  ├── session-memory.ts           # 回话记忆查询
  ├── daily-memory.ts             # 当天记忆汇总
  ├── short-term-memory.ts        # 短期 checkpoint 聚合
  ├── mid-term-memory.ts          # Qdrant + FamilyFeed 检索
  ├── context-builder.ts          # 整合各层记忆，生成注入文本
  └── checkpoint-service.ts       # Checkpoint 自动生成

# [新建] 状态机
apps/gateway/src/state-machine/
  └── index.ts                    # Phase 定义与转换规则

# [改造] Qdrant 客户端
apps/gateway/src/qdrant/client.ts             # 新增 ensureFamilyMemoriesCollection
apps/gateway/src/index.ts                     # 启动时调用 collection 初始化

# [改造] Pi Agent
apps/gateway/src/agent/pi-agent.ts    # 接入 context-builder + 工具调用循环

# [改造] 对话循环
apps/gateway/src/conversation/loop.ts         # 保存消息后触发 checkpoint
apps/gateway/src/conversation/turn-manager.ts # 新增 getRecentMessages / updateSessionPhase

# [改造] WebSocket 会话
apps/gateway/src/websocket/session-handler.ts # phase 转换、session 关闭时触发 checkpoint

# [改造] 测试
apps/gateway/src/agent/agent.test.ts          # 验证记忆上下文注入
apps/gateway/src/memory/memory.test.ts        # [新建] 各层记忆单元测试
apps/gateway/src/state-machine/state-machine.test.ts # [新建] 状态机测试
```

---

## 5. Code Style & Conventions

- **TypeScript**：严格模式开启，所有新增函数必须有返回类型注解。
- **记忆模块接口统一**：各层记忆函数统一签名 `async function getXxxMemory(familyId: string, ...options): Promise<string>`，返回空字符串表示无内容。
- **Context Builder 职责单一**：只负责"查询各层记忆 → 拼接成自然语言文本"，不直接操作 LLM。
- **异步任务**：Checkpoint 生成使用 `setImmediate` 或 `Promise.resolve().then()` 转为微任务，避免阻塞当前事件循环。
- **Phase 转换**：所有 phase 变更必须通过 `state-machine/index.ts` 的单一入口，禁止随意赋值 `session.phase = 'xxx'`。

---

## 6. Testing Strategy

### Backend Tests

- `memory.test.ts`（新建）：
  - `session-memory`：mock prisma SessionMessage，验证返回最近 N 条消息。
  - `daily-memory`：mock prisma Session + Checkpoint，验证只选中当天记录。
  - `short-term-memory`：mock 不同日期的 checkpoint，验证 3 天窗口和 keyFacts 选取。
  - `mid-term-memory`：mock qdrant search + prisma FamilyFeed，验证结果拼接。
  - `context-builder`：mock 各层记忆函数，验证输出文本格式正确、空层被省略。
- `checkpoint-service.test.ts`（新建）：
  - mock LLM 返回固定 JSON，验证 checkpoint 正确写入 prisma。
  - 验证空 session（< 2 条消息）不生成 checkpoint。
- `state-machine.test.ts`（新建）：
  - 验证所有合法/非法 phase 转换。
- `qdrant/client.test.ts`（新建）：
  - mock qdrant client，验证 `ensureFamilyMemoriesCollection` 在 collection 不存在时调用 `createCollection` 并创建 `familyId` 索引。
  - 验证 collection 已存在时跳过，不报错。
  - 验证创建参数：size=1024, distance='Cosine'。
- `agent.test.ts`（改造）：
  - mock prisma + qdrant + chatCompletion。
  - 验证 `processMessage` 构造的 messages 数组包含：system prompt、记忆上下文、回话历史、当前 user message。
  - 验证工具调用循环：LLM 请求 tool → 执行 tool → 结果回传 → 最终回复。

### Manual Verification

- 单次对话：连续多轮，AI 能引用之前说过的话。
- 跨 session（同一天）：上午聊"儿子周末回来"，下午进入小程序，AI 主动或被动提及此话题。
- 跨天：3 天内聊到"膝盖不舒服"，后续对话中 AI 能自然引用。
- 状态机：新 session 第一句为问候；静默 30s 后 AI 道别。

---

## 7. Boundaries

### Always Do
- 每次对话至少注入回话记忆（当前 session 历史）。
- Checkpoint 生成必须异步，不得阻塞 WebSocket 回复。
- 所有记忆查询必须带 `familyId` 过滤，防止数据泄露。
- 空记忆层在 prompt 中完全省略，不产生空行或占位符。
- Phase 转换后更新数据库 `session.phase`，并通知前端 `phase:changed`。
- 服务启动时必须确保 `family_memories` collection 已存在（若不存在则自动创建）。

### Ask First About
- 修改 LLM 底层模型（从 Qwen-Plus 切换）。
- 引入真实 embedding 模型替换当前的 `embedText` 伪随机向量。
- 改变 checkpoint 生成时机（如改为实时每轮生成）。
- 引入新的数据库（如 Redis 做缓存层）来加速记忆查询。
- 跨家庭数据共享或权限分级（如只读成员、管理员）。

### Never Do
- 在 Prompt 中泄露其他家庭的记忆数据（包括 checkpoint、FamilyFeed、Qdrant 结果）。
- 做同步的长时间检索（> 500ms）再回复老人。
- 硬编码"AI 必须在每轮主动引用记忆"的规则（交给 LLM 自主决定）。
- 在老人端展示技术错误信息（统一使用"小暖刚才走神了，您再说一遍？"等友好提示）。
- 为了 MVP 范围引入新的数据库或服务。

---

## 8. Open Questions / Decisions

| 决策项 | 确定方案 | 备注 |
|---|---|---|
| 短期记忆时间窗口 | 最近 3 天（不含当天） | 平衡覆盖面与 token 消耗；可在 env 配置 |
| 当天/短期记忆注入时机 | 仅在 session 前 3 轮注入，第 4 轮起不再重复 | 防止 token 累积 |
| Checkpoint 生成时机 | 双保险：① WebSocket 断开 + 5 分钟延迟窗口；② 每 5 轮增量更新 | 主触发确保完整摘要，保险触发防异常丢失 |
| 主动引用 vs 被动引用 | Context Injection，由 LLM 自主决定 | 不硬编码规则；观察 1-2 周后根据对话日志调优 |
| 中短期记忆触发策略 | 按需触发：输入含实体词或 ≥ 10 字时检索；极短句跳过 | 节省 token 和耗时 |
| 中短期记忆检索 topK | 向量检索 3 条 + FamilyFeed 5 条 | 避免信息过载；可在 `context-builder` 中动态裁剪 |
| 老人静默检测 | WebSocket 消息时间戳，30 秒阈值 | 不依赖 Phase 3 的 VAD；仅用于 GREETING→ACTIVE_CHAT 和 CLOSING 切换 |
| 回话历史上限 | 10 条消息，单条超 150 字截断 | 约占用 500-800 tokens；可调为 env 变量 |
| family_memories 向量维度 | 1024（text-embedding-v4 默认输出） | 与 embedding.ts 保持一致 |
| familyId payload 索引类型 | keyword | 精确匹配过滤，Qdrant 推荐类型 |

---

*Spec Version: 2.0*
*Scope: 分层记忆系统 + Session Phase 状态机（不含主动问候 / Phase 4）*
