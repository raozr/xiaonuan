# 语音聊天完整数据流分析

## 概述

本文档详细追踪从用户语音输入到 AI 语音回复的完整路径，涵盖移动端录制、WebSocket 传输、语音识别、AI 对话处理、记忆系统、技能注入、文本转语音等所有环节。

---

## 1. 端到端数据流全景

```
用户长按说话 → 松开 → 音频 → WebSocket → 服务端 → ASR → AI 处理 → TTS → 音频 URL → 播放
```

### COMPANIONEE（老人端）语音聊天流程

```
移动端                                                       服务端
─────────                                                  ─────────
home.tsx                                                    session-handler.ts
  │                                                           │
  ├─ useVoice.startRecording()                                │
  │   └─ expo-audio 录制 M4A                                 │
  │                                                           │
  ├─ useVoice.stopRecording()                                 │
  │   └─ 获取文件 URI                                        │
  │                                                           │
  ├─ getRecordingBase64()                                     │
  │   └─ File.base64() → base64 字符串                       │
  │                                                           │
  ├─ WebSocket.send('message:voice_audio', {audioBase64}) ───→│
  │                                                           ├─ base64 → Buffer
  │                                                           ├─ ffmpeg M4A → WAV (16kHz mono)
  │                                                           ├─ transcribeVoice() ───→ voice-service /asr/transcribe
  │                                                           │                         └─ 阿里云百炼 ASR → 文本
  │                                                           │
  │                                                           ├─ handleVoiceText(文本)
  │                                                           │   │
  │                                                           │   ├─ saveMessage(COMPANIONEE, 文本) → PostgreSQL
  │                                                           │   ├─ enqueueExtraction() → BullMQ (异步)
  │                                                           │   ├─ incrementTurnCount()
  │                                                           │   ├─ [每5轮] generateCheckpoint() → 异步
  │                                                           │   ├─ createPiAgent() → 加载技能
  │                                                           │   └─ agent.processMessage(文本)
  │                                                           │       ├─ getRecentMessages(10条)
  │                                                           │       ├─ buildMemoryContext() → 5层记忆
  │                                                           │       ├─ buildSystemPrompt() → 7段 + 技能
  │                                                           │       ├─ chatCompletion() → DashScope LLM
  │                                                           │       │   └─ [可选] tool_call 循环 (最多3轮)
  │                                                           │       └─ cleanLLMResponse() → AI 文本
  │                                                           │
  │                                                           ├─ saveMessage(AI, 文本) → PostgreSQL
  │                                                           ├─ synthesizeForPairing() ───→ voice-service /tts/synthesize
  │                                                           │   └─ 下载 MP3 → public/tts/<uuid>.mp3
  │                                                           │
  │                                                           ├─ WebSocket.send('message:ai_text', {text})
  │                                                           └─ WebSocket.send('ai:audio', {url})
  │
  ├─ WebSocket message:ai_text ←──────────────────────────────┘
  │   └─ 显示文字气泡
  │
  └─ WebSocket ai:audio ←────────────────────────────────────┘
      └─ playAudio(url) → expo-audio 播放
          └─ 播放完毕 → 状态重置 IDLE
```

---

## 2. 移动端（`apps/xiaonuan-app/`）

### 2.1 音频录制

**`src/hooks/useVoice.ts`** — 核心录制 Hook

| 函数 | 作用 |
|------|------|
| `startRecording()` | 请求权限 → `setAudioModeAsync({allowsRecording: true})` → `recorder.prepareToRecordAsync()` → `recorder.record()` |
| `stopRecording()` | `recorder.stop()` → 返回文件 URI |
| `getRecordingBase64()` | `new FileSystemFile(uri).base64()` → base64 字符串 |
| `playAudio(uri)` | 重置音频模式 → `player.replace({uri})` → `player.play()` |

- **录制格式**：M4A（`RecordingPresets.HIGH_QUALITY`）
- **库**：`expo-audio@~55.0.14`

### 2.2 WebSocket 通信

**`src/hooks/useWebSocket.ts`**

- 连接地址：`ws://<host>:3000/ws?token=<jwt>`（开发）/ `wss://www.quirklabs.top/xiaonuan/ws`（生产）
- 消息类型：`session:create`、`session:resume`、`message:voice_audio`
- 接收类型：`session:created`、`session:resumed`、`message:ai_text`、`ai:audio`、`error`
- 心跳：服务端每 30 秒发送 `ping`，客户端回复 `pong`

### 2.3 语音状态机

**`app/(companionee)/home.tsx`** — 4 种状态

```
IDLE → LISTENING → PROCESSING → SPEAKING → IDLE
  │        │            │            │
  │    长按麦克风    松开按钮     收到音频URL   播放完毕
  │                  发送音频    播放音频    或8秒超时
```

---

## 3. 服务端 WebSocket 处理

### 3.1 路由

**`apps/gateway/src/routes/session.ts`**

```
GET /ws (WebSocket upgrade)
  └─ createWebSocketHandler(app)
```

### 3.2 会话处理器

**`apps/gateway/src/websocket/session-handler.ts`**

认证（第 326-369 行）：
- 从查询参数 `?token=` 或 cookie 中提取 JWT
- 验证 token，检查 `pairingId`、`role`、`deviceId`
- 拒绝无 token 或角色验证失败的连接

消息路由（第 114-293 行）：

| 消息类型 | 处理逻辑 |
|----------|----------|
| `session:create` | 创建数据库 session 记录，回复 `session:created` |
| `session:resume` | 恢复已有 session，回复 `session:resumed` |
| `message:voice_text` | 备用路径：直接处理已转写的文本 |
| `message:voice_audio` | **主路径**：base64 解码 → 音频转换 → ASR → AI 处理 |

### 3.3 音频转换

**`apps/gateway/src/utils/audio-convert.ts`**

```
ffmpeg 输入 (M4A) → 16kHz 单声道 WAV → 输出 Buffer
```

- 使用 `ffmpeg-static` 或系统 PATH 中的 `ffmpeg`
- 输出格式：WAV, 16000 Hz, mono, 16-bit

### 3.4 语音识别 (ASR)

**`apps/gateway/src/services/voice-service-client.ts`** → **`apps/voice-service/routers/asr.py`**

```
HTTP POST /asr/transcribe
  └─ 阿里云百炼 Paraformer (bailian_asr.py)
      └─ 返回 { success, text }
```

处理特殊状态：
- `SUCCESS_WITH_NO_VALID_FRAGMENT`：无有效语音片段 → 返回空字符串（不发错误）

---

## 4. AI 对话处理

### 4.1 会话循环

**`apps/gateway/src/conversation/loop.ts`** — `handleVoiceText()`

顺序执行：
1. **保存用户消息** → `session_messages` 表
2. **异步提取** → BullMQ 队列（不阻塞响应）
3. **轮次计数** → `session.turnCount++`
4. **检查点** → 每 5 轮触发一次（异步）
5. **获取阶段** → `GREETING` | `ACTIVE_CHAT` | `CLOSING` | `ENDED`
6. **创建 Agent** → `createPiAgent({ pairingId, phase })`
7. **处理消息** → `agent.processMessage(text)`
8. **保存 AI 回复** → `session_messages` 表
9. **TTS 合成** → `synthesizeForPairing()`
10. **WebSocket 发送** → `message:ai_text` + `ai:audio`

### 4.2 Pi Agent

**`apps/gateway/src/agent/pi-agent.ts`** — `processMessage()`

```
输入：用户文本
输出：AI 回复文本
```

执行步骤：
1. **获取历史**：最近 10 条消息，每条截断 150 字符
2. **构建记忆上下文**：`buildMemoryContext()` → 5 层记忆聚合
3. **构建系统提示**：`buildSystemPrompt()` → 7 段 + 技能注入
4. **组装消息**：`[system, ...history, user]`
5. **LLM 调用**：`chatCompletion(messages, { temperature: 0.85, maxTokens: 512 })`
6. **工具调用循环**：最多 3 轮

#### 可用工具

| 工具 | 触发条件 | 作用 |
|------|----------|------|
| `memory_recall` | 用户提及特定人物/事件/使用模糊代词 | Qdrant 向量语义搜索 |
| `memory_note` | 用户明确表达新事实 | 写入 `event_stream` 和 `persona_profiles` |
| `emergency_alert` | 生命威胁/严重不适/自残倾向 | 控制台告警（可扩展通知） |

### 4.3 系统提示构建

**`apps/gateway/src/agent/prompt-builder.ts`** — 7 段结构

| 段落 | 内容 |
|------|------|
| 1. 角色与人格 | 你是一位温暖、耐心、贴心的智能陪伴助手，自称"我" |
| 2. 指令优先级 | P0=医疗安全 > P1=情绪共鸣 > P2=记忆检索 > P3=隐藏目标 |
| 3. 当前状态 | ISO 时间戳、轮次计数、记忆上下文文本 |
| 4. 技能聚合 | 当前阶段匹配的 SKILL.md 文件内容 |
| 5. 语调与个性化 | 被陪伴者姓名、监护人信息、方言、爱好、健康注意 |
| 6. 反模式 | 禁止机械用语、禁止诊断、禁止连续"请问" |
| 7. 输出格式 | 强制 XML：`<thought>` 分析 + `<response>` 回复 |

额外注入：
- **隐藏目标**（`hidden-goals.ts`）：每 5 轮触发一个对话目标（回忆工作、拿手菜等）
- **方言适配**（`tone-dictionary.ts`）：四川话、东北话、北京话、吴语等风格

### 4.4 LLM 服务

**`apps/gateway/src/services/dashscope.ts`**

| 参数 | 值 |
|------|-----|
| 模型 | `qwen3.6-plus` |
| 端点 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| 默认温度 | 0.85 |
| 默认 maxTokens | 1024 |
| 超时 | 60 秒（自动重试 1 次） |

### 4.5 响应清理

**`apps/gateway/src/agent/response-cleaner.ts`**

1. 去除 `<thought>...</thought>` 块（含截断情况）
2. 提取 `<response>...</response>` 内容（没有则返回全文）

---

## 5. 记忆系统（5 层架构）

**`apps/gateway/src/memory/context-builder.ts`** — 控制在 4096 字符预算内

### 5.1 各层详情

| 层 | 来源 | 触发条件 | 最大条目 | 优先级 |
|----|------|----------|----------|--------|
| 【今日回顾】 | `daily_summaries` 表（当日） | `turnCount <= 3` | 当日所有 | 最低 |
| 【近日动态】 | `checkpoints` 表（近 3 天） | `turnCount <= 3` | 每天 2 条 | 低 |
| 【相关回忆】 | Qdrant 向量搜索 + `persona_profiles` | 输入>=10字符或匹配实体 | 3+5 条 | 中 |
| 【未尽话题】 | `checkpoint.nextTopicHint` | 阶段=GREETING 且距上次>3天 | 1 条 | 高 |
| 【关系档案】 | `persona_profiles` 最高置信度 | 始终 | 5 条 | 最高 |

### 5.2 去重机制

**`apps/gateway/src/memory/dedup.ts`**

- 算法：最长公共子串（LCS）相似度
- 阈值：相似度 >= 0.6 视为重复（丢弃后出现的条目）
- 作用：防止跨层记忆层产生重复内容

### 5.3 预算截断

总字符数超过 4096 时，按优先级从低到高逐条移除，直至符合预算。

### 5.4 辅助组件

| 组件 | 文件 | 功能 |
|------|------|------|
| 实体词汇表 | `entity-vocabulary.ts` | 最近 50 条事件的标签缓存（5 分钟 TTL），决定中期记忆是否触发 |
| 问候提示 | `greeting-hint.ts` | 距上次对话 >3 天时，输出上次的 `nextTopicHint` |
| 情绪追踪器 | `emotion-tracker.ts` | 返回最近 7 天内最新的情绪快照 |
| 人物画像服务 | `persona-service.ts` | `persona_profiles` 表的 CRUD：按置信度/类别查询 |

---

## 6. 技能系统

### 6.1 技能文件

**`packages/skills/`** — 按阶段匹配的 Markdown 指令

| 技能 | 文件 | 阶段 | 核心指令 |
|------|------|------|----------|
| 核心人设 | `companion-persona/SKILL.md` | all | 语言风格、行为准则、安全底线 |
| 问候协议 | `greeting-protocol/SKILL.md` | greeting | 不同时间跨度的开场策略 |
| 对话流程 | `conversation-flow/SKILL.md` | active_chat | 分阶段对话引导 |
| 对话策略 | `conversation-strategy/SKILL.md` | active_chat | 方言和语气策略 |
| 记忆协议 | `memory-protocol/SKILL.md` | active_chat | 记忆摘要 prompt |

### 6.2 技能加载

**`apps/gateway/src/agent/skill-loader.ts`**

- 解析 Markdown 文件的 YAML frontmatter（`name`、`description`、`priority`、`phase`）
- `loadSkillsForPhase(phase)`：返回所有 `phase=all` 或 `phase=当前阶段` 的技能
- 内容以 `<SKILL_AGGREGATION>` 标签注入系统提示

---

## 7. 事件系统

### 7.1 事件类型

**`apps/gateway/src/events/event-types.ts`**

```
feed_message | conversation_turn | conversation_extracted
info_extracted | mood_change | relationship_shift
proactive_outreach | persona_updated
```

### 7.2 事件总线

**`apps/gateway/src/events/event-bus.ts`**

- **缓冲写入**：内存积累 10 条或 30 秒 → 批量写入 `event_stream` 表
- **立即写入**：`{ immediate: true }` 跳过缓冲（检查点、外呼使用）
- **优雅退出**：SIGTERM/SIGINT 时刷新待处理事件

### 7.3 事件归档

**`apps/gateway/src/events/event-archiver.ts`**

- 每日凌晨 2:00 清理超过 90 天的事件记录

---

## 8. 提取系统（异步 LLM）

### 8.1 提取触发点

| 触发源 | 文件 | 时机 |
|--------|------|------|
| 对话 | `loop.ts:33` | 每条用户消息后 |
| 检查点 | `checkpoint-service.ts:186` | 每 5 轮对话后 |

### 8.2 提取 Worker

**`apps/gateway/src/services/extraction-queue.ts`**（BullMQ，并发 3）

处理流程：
1. **目标检测** → 正则判断文本描述对象（发送者 / 被陪伴者 / 第三方）
2. **LLM 提取** → 温度 0.3，从文本中提取结构化画像
3. **元数据合并** → 更新 `participant.metadata` JSON 列
4. **画像写入** → `addProfiles()` → `persona_profiles` 表

---

## 9. 检查点系统

### 9.1 生成时机

每 5 轮对话后异步触发（`loop.ts:44`）

### 9.2 检查点内容

**`apps/gateway/src/memory/checkpoint-service.ts`** — LLM 生成结构化摘要

```
{
  topicSummary: string,   // 30字主题总结
  keyFacts: Array<{       // 关键事实
    category: string,     // hobby / health / preference / relationship
    content: string
  }>,
  moodSnapshot: string,   // 20字情绪快照
  nextTopicHint: string   // 未尽话题提示
}
```

### 9.3 检查点写入目标

| 目标 | 用途 |
|------|------|
| `checkpoints` 表 (PostgreSQL) | 短期/每日记忆查询 |
| `daily_summaries` 表 (PostgreSQL) | 每日回顾 |
| `pairing_memories` collection (Qdrant) | 语义向量搜索 |
| `event_stream` 表 | 事件审计 |
| BullMQ 提取队列 | 异步画像分析 |

---

## 10. 语音合成 (TTS)

### 10.1 流程

**`apps/gateway/src/services/voice.ts`** → **`apps/voice-service/routers/tts.py`**

1. `resolveVoiceId(pairingId)`：检查是否有活跃的声音克隆
   - 有 → 使用克隆语音 ID
   - 无 → 按性别回退（`longanyang` 男声 / `longanhuan` 女声）
2. `synthesizeVoice(text, voiceId)`：HTTP POST 到语音服务
3. 下载音频 Buffer → `public/tts/<uuid>.mp3`
4. 构建 URL：`http://<host>:3000/tts/<uuid>.mp3`

### 10.2 声音克隆

**`apps/gateway/src/routes/voice-clone.ts`** — CRUD API

| 操作 | 端点 |
|------|------|
| 创建克隆 | `POST /api/voice-clone/` |
| 列表查询 | `GET /api/voice-clone/` |
| 激活 | `PATCH /api/voice-clone/:id/activate` |

---

## 11. 关闭消息（3 分钟静默）

**`apps/gateway/src/conversation/loop.ts`** — `sendClosingMessage()`

当用户静默 3 分钟时：
1. 获取最近 6 条消息
2. 构建带"对方已 3 分钟未说话"指令的系统提示
3. 注入 `（静默）` 作为用户消息
4. LLM 调用（温度 0.85，maxTokens 128）
5. 保存 + TTS + WebSocket 发送

会话阶段从 `ACTIVE_CHAT` → `CLOSING` → `ENDED`

---

## 12. 主动外呼

**`apps/gateway/src/memory/proactive-outreach.ts`**

- **调度**：每日上午 10:00（`server.ts`）
- **条件**：配对超过 72 小时无互动 + 24 小时冷却
- **流程**：查找非活跃配对 → 冷却检查 → 构建 LLM 提示（含历史上下文）→ 生成 1-2 句问候 → 记录外呼事件

---

## 13. 数据库实体关系

```
Pairing (配对)
  ├── Participant (参与者: COMPANIONEE / STEWARD)
  ├── AIPersona (AI 人格配置)
  ├── Session (对话会话)
  │     ├── SessionMessage (逐轮消息)
  │     ├── Checkpoint (检查点摘要)
  │     └── DailySummary (每日汇总)
  ├── PersonaProfile (人物画像条目)
  ├── EventStream (事件流)
  ├── FeedMessage (动态消息)
  └── VoiceClone (声音克隆)
```

### 存储系统

| 系统 | 用途 |
|------|------|
| PostgreSQL (Prisma) | 所有结构化数据：用户、对话、记忆事件 |
| Qdrant | 向量存储：语义记忆检索 |
| Redis | 缓存、会话存储、BullMQ 队列、检查点恢复标志 |
| 文件系统 (`public/tts/`) | TTS 音频文件（通过 HTTP 静态提供） |

---

## 14. 关键文件索引

| 类别 | 路径 |
|------|------|
| 移动端录制 | `apps/xiaonuan-app/src/hooks/useVoice.ts` |
| 移动端 WebSocket | `apps/xiaonuan-app/src/hooks/useWebSocket.ts` |
| 语音首页 | `apps/xiaonuan-app/app/(companionee)/home.tsx` |
| 服务端路由 | `apps/gateway/src/routes/session.ts` |
| WS 会话处理 | `apps/gateway/src/websocket/session-handler.ts` |
| 会话循环 | `apps/gateway/src/conversation/loop.ts` |
| 轮次管理 | `apps/gateway/src/conversation/turn-manager.ts` |
| Pi Agent | `apps/gateway/src/agent/pi-agent.ts` |
| 提示构建 | `apps/gateway/src/agent/prompt-builder.ts` |
| 技能加载 | `apps/gateway/src/agent/skill-loader.ts` |
| 响应清理 | `apps/gateway/src/agent/response-cleaner.ts` |
| 音频转换 | `apps/gateway/src/utils/audio-convert.ts` |
| 记忆上下文构建 | `apps/gateway/src/memory/context-builder.ts` |
| 记忆去重 | `apps/gateway/src/memory/dedup.ts` |
| 检查点服务 | `apps/gateway/src/memory/checkpoint-service.ts` |
| 事件总线 | `apps/gateway/src/events/event-bus.ts` |
| 提取队列 | `apps/gateway/src/services/extraction-queue.ts` |
| DashScope LLM | `apps/gateway/src/services/dashscope.ts` |
| TTS 编排 | `apps/gateway/src/services/voice.ts` |
| 语音服务客户端 | `apps/gateway/src/services/voice-service-client.ts` |
| ASR 外部服务 | `apps/voice-service/routers/asr.py` |
| TTS 外部服务 | `apps/voice-service/routers/tts.py` |
| 技能定义 | `packages/skills/companion-persona/SKILL.md` |
| 问候协议 | `packages/skills/greeting-protocol/SKILL.md` |
| 数据库 Schema | `packages/prisma/prisma/schema.prisma` |
