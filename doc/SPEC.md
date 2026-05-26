# SPEC: 小暖 (XiaoNuan) V0.2

*Spec Version: 0.2.0*  
*Last Updated: 2026-05-12*  
*Scope: 全产品技术规格（基于最新代码实现）*

---

## 1. Objective

**目标**：构建一款面向独居老人的 AI 语音陪伴微信小程序，让老人通过自然的语音对话获得情感陪伴，同时让子女能够远程了解老人状态并管理家庭档案。

**目标用户**：
- **主要用户**：60 岁以上独居老人。核心诉求是"有人说话"、"被记得"、"不孤单"。
- **次要用户**：老人的成年子女（通常 30-50 岁）。核心诉求是"知道爸妈今天怎么样"、"远程关怀"。

**成功标准**：
- 老人按住按钮说话，松手后 3 秒内听到 AI 的语音回复。
- 同一天内多次对话，AI 能提及上午聊过的话题。
- 聊起几天前的事，AI 能自然引用之前的对话内容。
- 老人情绪低落时，AI 优先安抚而非继续追问事实。
- 子女能在小程序中查看和编辑老人的基础档案（爱好、健康注意、方言偏好）。

---

## 2. Core Features & Acceptance Criteria

### Feature 1: 三态语音交互（老人端核心）

**描述**：老人端首页采用"默认态 → 倾听态 → 说话态"三态 UI，支持按住说话、语音合成播放、打断重录的完整闭环。

**实现要求**：
- `elder-home.wxml` 顶部 AppBar（小头像 + 标题 + 记录入口），中部大头像区，底部 FAB。
- **默认态**：大头像（440rpx）+ 橙色 mic FAB（240rpx，阴影 `0 32rpx 64rpx rgba(143,78,0,0.25)`）。提示"按住下方按钮说话"。
- **倾听态**：按住 FAB 时头像出现双层脉冲光环（`pulse-ring` 动画，2s 周期），FAB scale(0.95) 按下效果，底部音条随机跳动（`wave-bar` 高度 10-70rpx，150ms 刷新）。提示"我在听…"。
- **说话态**：AI 播放 TTS 时头像呼吸缩放（`speak-pulse` 0.8s 交替），环境光晕（`filter: blur(80rpx)`），音条跳动，对话气泡显示 AI 文字，FAB 变为灰色"打断"按钮（`front_hand` 图标）。
- **打断功能**：点击打断按钮立即停止音频播放（`destroyAudio`），重置状态到默认态。
- **录音参数**：WAV 格式，16kHz，单声道，最大 30 秒。少于 500ms 视为误触，Toast 提示"说话时间太短"。
- **交互边界**：processing 态（ASR/LLM 处理中）FAB 变为灰色，提示"小暖在想…"。

**AC**：
- [ ] 按住 FAB 开始录音，松手停止，识别文字通过 WebSocket 发送给后端。
- [ ] AI 回复到达后自动调用 TTS，播放 MP3 音频。
- [ ] 播放中点击"打断"按钮，音频立即停止，页面回到默认态。
- [ ] 录音时间过短（< 500ms）不发送请求，提示 Toast。
- [ ] WebSocket 断开后自动重连（指数退避，最多 3 次）。

---

### Feature 2: 分层记忆系统

**描述**：AI 在每次回复前注入多层记忆上下文，让对话具备"记得住事"的能力。

**实现要求**：
- **回话记忆**（`session-memory.ts`）：始终注入当前 session 最近 10 条消息（`getRecentMessages`），单条超 150 字截断，按时间升序排列。
- **当天记忆**（`daily-memory.ts`）：查询当天（老人时区 00:00-23:59）所有已结束 session 的最新 checkpoint topicSummary，拼接为"【今日回顾】"。仅在 session 前 3 轮注入。
- **短期记忆**（`short-term-memory.ts`）：查询近 3 天（不含当天）的 checkpoint，每天取最多 2 条 keyFacts，拼接为"【近日动态】"。仅在 session 前 3 轮注入。
- **中短期记忆**（`mid-term-memory.ts`）：当用户输入 ≥ 10 字或包含家庭实体词时，触发 Qdrant 向量检索（`memoryRecall`，top 3）+ FamilyFeed 最近 5 条（PREFERENCE/HEALTH），拼接为"【相关回忆】"。
- **跨层去重**（`dedup.ts`）：使用 LCS 相似度（阈值 0.6）对当天记忆和短期记忆去重，避免重复信息进入 prompt。
- **并发容错**：4 层记忆查询通过 `Promise.allSettled` 并行执行，任一失败不影响其他层。

**AC**：
- [ ] 同一 session 内多轮对话，AI 能引用之前说过的话。
- [ ] 上午聊完后关闭小程序，下午再次进入，AI 能自然接续上午话题（当天记忆）。
- [ ] 聊起"前天说的事"，AI 能基于短期记忆正确回应。
- [ ] 提到具体人名/爱好时，AI 能从历史对话中召回相关细节（中短期记忆）。
- [ ] 输入极短句（如"嗯"）时，不触发中短期检索，节省 token。
- [ ] 记忆查询严格按 `familyId` 隔离，不泄露其他家庭数据。

---

### Feature 3: Checkpoint 自动生成

**描述**：会话过程中自动提取话题摘要、关键事实、情绪快照，写入 Checkpoint 表、Qdrant 向量库和 FamilyFeed。

**实现要求**：
- `checkpoint-service.ts` 的 `generateCheckpoint(sessionId)`：读取 session 所有消息，构造 prompt 让 LLM 返回 JSON `{ topicSummary, keyFacts[], moodSnapshot, nextTopicHint }`。
- **双保险触发**：
  1. 主触发：WebSocket 断开 + 5 分钟延迟窗口。若 5 分钟内通过 `session:resume` 恢复则取消。
  2. 保险触发：每 5 轮对话（`turnCount % 5 === 0`）异步增量更新。
- **Triple-write**（异步、best-effort）：
  - Prisma：`Checkpoint` 表 upsert。
  - Qdrant：`family_memories` collection 写入向量（`text-embedding-v4`，1024 维）。
  - FamilyFeed：每条 keyFact 作为独立 feed 记录写入。
- 消息少于 2 条时不生成 checkpoint。

**AC**：
- [ ] 断开后 5 分钟内未恢复，session 标记为 ENDED 并生成 checkpoint。
- [ ] 每 5 轮对话后 checkpoint 被增量更新，不阻塞 AI 回复。
- [ ] Checkpoint 内容包含自然的 topicSummary 和至少一条 keyFacts。
- [ ] Qdrant 向量维度 1024，距离 Cosine，带 `familyId` keyword 索引。

---

### Feature 4: 会话状态机

**描述**：Session 分为 GREETING → ACTIVE_CHAT → CLOSING → ENDED 四个阶段，不同阶段加载不同 skill 和行为策略。

**实现要求**：
- `state-machine/index.ts` 定义 `definePhaseTransition(currentPhase, event)`：
  - `GREETING` + `first_message_received` → `ACTIVE_CHAT`
  - `GREETING/ACTIVE_CHAT` + `elder_silent_30s` → `CLOSING`
  - `CLOSING` + `elder_speaks_again` → `ACTIVE_CHAT`
  - `CLOSING` + `session_close` → `ENDED`
- `session-handler.ts`：
  - `session:create` 时 phase 为 `GREETING`。
  - 收到第一条 `message:voice_text` 触发 `GREETING → ACTIVE_CHAT`。
  - 30 秒静默检测： elder 最后一条消息后 30s 无新消息，触发 phase 转换并发送道别语（`sendClosingMessage`）。
  - 转换后通知前端 `phase:changed`。

**AC**：
- [ ] 新 session 创建后处于 GREETING，AI 回复是问候/开场白。
- [ ] 老人发送第一条消息后进入 ACTIVE_CHAT，后续为正常对话。
- [ ] 老人 30 秒未说话，进入 CLOSING，AI 发送温和道别语。
- [ ] CLOSING 阶段老人再次说话，回到 ACTIVE_CHAT。
- [ ] Session 关闭后 phase 为 ENDED。

---

### Feature 5: AI Agent（PiAgent）与技能系统

**描述**：基于 DashScope Qwen-Plus 的 AI Agent，支持动态 system prompt 构建、工具调用和技能加载。

**实现要求**：
- `pi-agent.ts` 的 `createPiAgent({ familyId, phase })`：
  - 根据 phase 加载对应 skills（`loadSkillsForPhase`）。
  - 构建 messages 数组：`[system, ...history(10), user]`。
  - 调用 LLM 时传入 tools 定义（`memory_recall`, `memory_note`, `emergency_alert`）。
  - 支持工具调用循环（最多 3 轮），解析 `<response>` 标签内容返回。
- `prompt-builder.ts` 的 `buildSystemPrompt` 组装 7 个区块：角色人设、指令优先级（P0-P3）、当前状态、技能聚合、语气个性化、反模式、输出格式（XML `<thought>` + `<response>`）。
- **语气个性化**：根据 elder 档案注入方言适配（`tone-dictionary.ts`）、问候偏好、爱好、健康注意、回避话题、子女信息。
- **隐藏目标**（`hidden-goals.ts`）：根据 turnCount 动态注入潜台词目标（如第 3 轮引导聊健康）。

**AC**：
- [ ] AI 能准确称呼老人姓名，使用设定的方言风格。
- [ ] 老人提到负面情绪时，AI 优先共情，放弃记忆收集。
- [ ] 老人提到具体人名/事件时，AI 自动调用 `memory_recall` 检索历史。
- [ ] 老人表达新的事实时，AI 调用 `memory_note` 记录到 FamilyFeed。
- [ ] 触发危机关键词时，AI 调用 `emergency_alert` 并安抚老人（不在语言中提及报警）。

---

### Feature 6: 家庭档案与认证绑定

**描述**：子女注册创建家庭并管理老人档案，老人通过邀请码绑定到家庭。

**实现要求**：
- **子女注册**（`/api/auth/register`，role=CHILD）：
  - 微信 silent-login 获取 openid，创建 Family（含 placeholder Elder）和 ChildProfile。
  - 生成 6 位邀请码，24 小时有效。
- **老人绑定**（`/api/family/bind`）：
  - 输入邀请码 + deviceId，更新 ElderProfile 的 deviceId 和 openid。
  - 返回 JWT（365 天有效期）。
- **档案管理**（`/api/family/elder` PUT，`/api/family/settings` GET）：
  - 子女可编辑老人姓名、年龄、方言、爱好、健康注意、回避话题、问候偏好。
  - 动态注入到 System Prompt，AI 实时感知变化。

**AC**：
- [ ] 子女注册后自动生成邀请码，老人用邀请码成功绑定。
- [ ] 邀请码过期后（24h）绑定失败，提示"邀请码已过期"。
- [ ] 子女修改老人爱好后，AI 下轮对话能引用新爱好。
- [ ] 老人 JWT 有效期 365 天，子女 JWT 有效期 7 天。

---

### Feature 7: ASR / TTS 语音服务

**描述**：后端提供阿里云 NLS 一句话识别和语音合成接口。

**实现要求**：
- **ASR**（`/api/asr/transcribe`）：接收 base64 WAV（16kHz 单声道），调用 NLS 一句话识别，返回文本。
- **TTS**（`/api/tts/synthesize`）：接收文本，调用 NLS 语音合成（声音 `xiaoyun`，MP3 格式），保存到 `public/tts/<uuid>.mp3`，返回静态文件 URL。
- NLS Token 自动刷新（提前 60 秒）。

**AC**：
- [ ] 正常语音 1-3 秒识别准确率可用（依赖 NLS 服务质量）。
- [ ] 空语音返回"未能识别到语音内容"。
- [ ] TTS 文本长度限制 1000 字，超限时返回错误。
- [ ] 合成的 MP3 文件可被小程序正常播放。

---

### Feature 8: 安全护栏（紧急报警）

**描述**：AI 识别到老人生命威胁或严重身体不适时，触发后台报警工具。

**实现要求**：
- `tools/alert.ts` 的 `emergencyAlert(severity, reason, familyId)`：
  - CRITICAL：自残/轻生关键词（"不想活了"、"安眠药"等）。
  - HIGH：严重身体不适（"胸口痛喘不过气"、"摔倒起不来"等）。
- 当前实现为日志记录 + 返回成功状态，实际 SMS/推送通道待接入。
- AI 回复中**不提及**已报警，保持冷静安抚。

**AC**：
- [ ] 老人说"不想活了"，AI 调用 `emergency_alert` 并安抚。
- [ ] 老人说"胸口痛"，AI 调用 `emergency_alert` 并引导休息。
- [ ] AI 回复中不出现"已为您报警"、"已通知子女"等字眼。

---

### Feature 9: WebSocket 会话管理

**描述**：老人端与网关通过 WebSocket 维持长连接，支持会话创建、恢复、心跳和断线重连。

**实现要求**：
- 连接地址 `ws://<host>/ws?token=<JWT>`，无 token 或错误 token 立即断开。
- **心跳**：服务端每 30s 发送 `ping`，客户端回复 `pong`；连续 2 次未回复服务端主动断开。
- **session:create**：创建新 session（phase=GREETING），返回 `session:created`。
- **session:resume**：按 `sessionId` + `familyId` 恢复已有会话，返回 `session:resumed`；越权访问返回"会话不存在"。
- **message:voice_text**：未创建会话直接发消息返回"会话未创建"；空文本返回"text 必填"。
- 断开 5 分钟后若未恢复，标记 session ENDED 并异步生成 checkpoint。

**AC**：
- [ ] 正确 token 连接成功，错误 token 立即断开。
- [ ] 心跳正常时连接保持，2 次未回复 pong 服务端断开。
- [ ] 断线后使用旧 sessionId 恢复，上下文延续。
- [ ] 恢复其他家庭的 session 返回"会话不存在"。

---

## 3. Tech Stack & Constraints

**技术栈**（已确定，不改选型）：
- 后端：Node.js 22 + Fastify + TypeScript（ESM）
- 数据库：PostgreSQL 15 + Prisma ORM
- 向量库：Qdrant（REST API）
- 缓存：Redis
- AI：Alibaba DashScope（`qwen3.6-plus` + `text-embedding-v4`）
- 语音：Alibaba NLS（一句话识别 + 语音合成）
- 认证：Fastify JWT + 微信小程序 silent login
- 前端：微信小程序（WXML/WXSS/JS）
- 部署：Docker Compose

**约束**：
- LLM 上下文总量控制：日常轮次 ≤ 1300 tokens（system + history），前 3 轮 ≤ 2500 tokens（叠加记忆层）。
- 记忆查询总耗时 ≤ 200ms（并发查询 + 容错降级）。
- Checkpoint 生成异步执行，不得阻塞 WebSocket 回复。
- 所有数据操作严格按 `familyId` 隔离。
- TTS 合成的 MP3 文件暂无自动清理机制，需监控磁盘。

---

## 4. Project Structure

本次规格覆盖的已有实现文件清单：

```
apps/gateway/src/
  ├── agent/
  │   ├── pi-agent.ts              # Agent 主逻辑、工具调用循环
  │   ├── prompt-builder.ts        # 动态 System Prompt 构建
  │   ├── skill-loader.ts          # 按 phase 加载 skills
  │   ├── tone-dictionary.ts       # 方言适配
  │   └── hidden-goals.ts          # 动态隐藏目标
  ├── conversation/
  │   ├── loop.ts                  # 语音消息处理主循环
  │   └── turn-manager.ts          # 消息保存、回合计数、phase 查询
  ├── memory/
  │   ├── index.ts                 # 统一导出
  │   ├── context-builder.ts       # 整合各层记忆文本
  │   ├── session-memory.ts        # 回话历史查询
  │   ├── daily-memory.ts          # 当天记忆汇总
  │   ├── short-term-memory.ts     # 短期 checkpoint 聚合
  │   ├── mid-term-memory.ts       # Qdrant + FamilyFeed 检索
  │   ├── checkpoint-service.ts    # Checkpoint 自动生成
  │   ├── dedup.ts                 # LCS 跨层去重
  │   ├── entity-vocabulary.ts     # 动态实体词汇
  │   └── greeting-hint.ts         # 开场话题提示
  ├── state-machine/
  │   └── index.ts                 # Phase 转换规则
  ├── websocket/
  │   └── session-handler.ts       # WebSocket 连接、心跳、消息路由
  ├── routes/
  │   ├── auth.ts                  # 注册、登录、微信 code 交换
  │   ├── family.ts                # 家庭 CRUD、邀请码、档案更新
  │   ├── me.ts                    # 当前用户信息
  │   ├── asr.ts                   # 语音识别接口
  │   └── tts.ts                   # 语音合成接口
  ├── services/
  │   ├── dashscope.ts             # LLM chat completion
  │   ├── embedding.ts             # 文本向量化
  │   └── nls.ts                   # NLS ASR/TTS + Token 管理
  ├── tools/
  │   ├── memory.ts                # memory_recall / memory_note
  │   └── alert.ts                 # emergency_alert
  └── qdrant/
      └── client.ts                # Qdrant 客户端 + collection 初始化

# apps/mini-program/ — 已移除，不再维护

packages/
  ├── prisma/prisma/schema.prisma  # 数据模型
  └── skills/*/SKILL.md            # 5 个 AI 技能定义
```

---

## 5. Code Style & Conventions

- **TypeScript**：严格模式，所有新增函数必须有返回类型注解。
- **记忆模块接口统一**：各层记忆函数签名 `async function getXxxMemory(familyId: string): Promise<string>`，空字符串表示无内容。
- **Context Builder 职责单一**：只负责"查询各层记忆 → 拼接成自然语言文本"，不直接操作 LLM。
- **异步任务**：Checkpoint 生成使用 `setImmediate` 转为后台任务，不阻塞当前事件循环。
- **Phase 转换**：所有 phase 变更必须通过 `state-machine/index.ts` 的单一入口，禁止随意赋值 `session.phase = 'xxx'`。
- **错误降级**：外部服务（Qdrant、Embedding、LLM）失败时记录错误日志并返回降级结果，不抛异常中断主流程。

---

## 6. Testing Strategy

### 单元测试

- `memory.test.ts`：mock prisma + qdrant，验证各层记忆查询、context-builder 拼接、去重逻辑。
- `checkpoint-service.test.ts`：mock LLM 返回固定 JSON，验证 checkpoint 写入 prisma 和 Qdrant。
- `state-machine.test.ts`：验证所有合法/非法 phase 转换。
- `agent.test.ts`：mock 外部服务，验证 messages 数组结构、工具调用循环、`<response>` 提取。
- `session-handler.test.ts`：mock WebSocket，验证心跳、会话创建/恢复、phase 转换、静默检测。

### 集成 / E2E 测试

- `e2e-test.mjs`：完整 WebSocket 对话循环（连接 → 创建 session → 发送语音文本 → 接收 AI 回复）。
- `manual-testing-phase2.md`：Phase 2 功能手动测试清单（心跳、断线重连、ASR/TTS、phase 切换）。

---

## 7. Boundaries

### Always Do
- 每次对话至少注入回话记忆（当前 session 历史）。
- Checkpoint 生成必须异步，不得阻塞 WebSocket 回复。
- 所有记忆查询必须带 `familyId` 过滤，防止数据泄露。
- 空记忆层在 prompt 中完全省略，不产生空行或占位符。
- Phase 转换后更新数据库 `session.phase`，并通知前端 `phase:changed`。
- 服务启动时确保 `family_memories` collection 已存在（若不存在则自动创建）。
- 老人端遇到技术错误时，统一使用"小暖刚才走神了，您再说一遍？"等友好提示，不暴露技术细节。

### Ask First About
- 修改 LLM 底层模型（从 Qwen-Plus 切换）。
- 引入新的数据库或服务（如 Redis 做缓存层、MongoDB 做日志）。
- 改变 checkpoint 生成时机（如改为实时每轮生成）。
- 跨家庭数据共享或权限分级（如只读成员、管理员）。
- 引入真实音量检测驱动波形动画（当前为模拟）。

### Never Do
- 在 Prompt 中泄露其他家庭的记忆数据（包括 checkpoint、FamilyFeed、Qdrant 结果）。
- 做同步的长时间检索（> 500ms）再回复老人。
- 硬编码"AI 必须在每轮主动引用记忆"的规则（交给 LLM 自主决定）。
- 在老人端展示"数据库错误"、"API 失败"等技术错误信息。
- 为了 MVP 范围引入额外的云服务或基础设施。

---

## 8. Open Questions / Decisions

| 决策项 | 确定方案 | 备注 |
|---|---|---|
| 短期记忆时间窗口 | 最近 3 天（不含当天） | 平衡覆盖面与 token 消耗 |
| 当天/短期记忆注入时机 | 仅在 session 前 3 轮注入，第 4 轮起不再重复 | 防止 token 累积 |
| Checkpoint 生成时机 | 双保险：① WebSocket 断开 + 5 分钟延迟；② 每 5 轮增量更新 | 主触发确保完整摘要，保险触发防异常丢失 |
| 主动引用 vs 被动引用 | Context Injection，由 LLM 自主决定 | 观察 1-2 周后根据对话日志调优 |
| 中短期记忆触发策略 | 输入含实体词或 ≥ 10 字时检索；极短句跳过 | 节省 token 和耗时 |
| 回话历史上限 | 10 条消息，单条超 150 字截断 | 约占用 500-800 tokens |
| family_memories 向量维度 | 1024（text-embedding-v4） | 与 embedding.ts 保持一致 |
| TTS 文件清理 | 暂无自动清理 | 需监控 `public/tts/` 磁盘占用 |
| Emergency Alert 通知通道 | 仅日志记录 | SMS / Push 待后续接入 |
| 子女端功能范围 | V0.2 仅支持档案管理 | 今日状态、历史记录、家庭记忆库 UI 已设计但未实现 |

---

## 9. Changelog

### v0.2.0 (2026-05-12)
- **语音交互**：老人端三态 UI 重构（默认/倾听/说话），脉冲光环、音波动画、打断按钮。
- **规格文档**：新增本 SPEC.md，作为全产品技术规格。

### v0.1.0 (2026-05)
- 初始 MVP：分层记忆、PiAgent、技能系统、WebSocket 会话、ASR/TTS、家庭档案、Docker 部署。

---

*Spec Version: 0.2.0*  
*Scope: 小暖全产品技术规格*  
