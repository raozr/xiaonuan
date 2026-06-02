# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概览

**小暖 (XiaoNuan)** — AI 居家养老陪伴平台。PNPM Monorepo，主要模块：

| 模块 | 路径 | 技术栈 |
|------|------|--------|
| AI 网关 | `apps/gateway/` | Node.js, Fastify 5, WebSocket, BullMQ |
| 移动端 | `apps/xiaonuan-app/` | Expo SDK 55, RN 0.83, NativeWind v4, Reanimated 4, Zustand |
| 语音服务 | `apps/voice-service/` | Python FastAPI, 阿里云 NLS |
| 数据库 | `packages/prisma/` | PostgreSQL + Prisma |
| AI 技能 | `packages/skills/` | 模块化 Prompt 工程 (Markdown) |

## 常用命令

```bash
# 开发
docker-compose up -d postgres qdrant redis   # 启动基础设施
pnpm install                                  # 安装依赖
pnpm db:generate                              # 生成 Prisma Client
pnpm dev                                      # 并行启动所有 dev server

# 网关开发（单独）
pnpm --filter @xiaonuan/gateway dev           # tsx watch src/server.ts

# 移动端开发
cd apps/xiaonuan-app && pnpm start            # Expo 开发服务器

# 构建 & 检查
pnpm build                                    # tsc 编译所有包
pnpm lint                                     # ESLint 检查

# 测试
pnpm test                                     # 所有 workspace 测试
pnpm --filter @xiaonuan/gateway test          # 仅网关测试
pnpm --filter @xiaonuan/gateway test:watch    # 监视模式

# 数据库
pnpm db:migrate                               # 创建迁移
pnpm db:seed                                  # 填充种子数据
pnpm db:studio                                # Prisma Studio

# 生产部署
./manager.sh start                            # docker compose up
./manager.sh update                           # 拉取→构建→重启
./manager.sh logs gateway                     # 查看日志
```

## 架构总览

### 对话流程

```
用户语音 → WebSocket (/ws) → session-handler → turn-manager → loop (主编排器)
                                                              ├── pi-agent (LLM + Tools)
                                                              ├── context-builder (记忆注入)
                                                              └── response-cleaner (产物清理)
```

`loop.ts` 是编排核心：接收用户输入 → `buildMemoryContext()` 组装记忆 → `createPiAgent()` 调用 LLM → 执行工具调用 → 输出回复。

### 记忆系统 (`apps/gateway/src/memory/`)

分层记忆架构（`context-builder.ts` 组装，4096 字符预算，按优先级截断）：

| 层级 | 文件 | 注入时机 | 内容 |
|------|------|----------|------|
| 问候提示 | `greeting-hint.ts` | 仅在 GREETING 阶段 | 冷启动问候建议 |
| 今日回顾 | `daily-memory.ts` | 前 3 轮 | 当天已结束 session 的主题摘要 |
| 近日动态 | `short-term-memory.ts` | 前 3 轮 | 近 3 天 Checkpoint keyFacts |
| 相关回忆 | `mid-term-memory.ts` | 输入≥10字或含实体词 | Qdrant 向量检索 top 3 |
| 关系档案 | `relationship-layer.ts` | 每轮 | 各分类 Top 5 PersonaProfile |
| 情感状态 | `emotion-tracker.ts` | 每轮 | 最近情绪标签 |
| 家人留言 | `feed-messages.ts` | 每轮 | 最近 5 条 FeedMessage |

跨层去重 `dedup.ts`：基于 LCS 相似度（阈值 0.6），优先保留高优先级层。

### Agent 系统 (`apps/gateway/src/agent/`)

`pi-agent.ts` — 使用 DashScope Qwen-Plus 的主 agent，具备工具调用能力。已注册工具：
- `emergency_alert` — 紧急告警（`src/tools/alert.ts`）
- `memory_context` — 获取家人留言/投喂内容（`src/tools/memory.ts` 中的 `memoryContext`）
- `memory_recall` — 向量记忆检索（`src/tools/memory.ts` 中的 `memoryRecall`）
- `memory_note` — 主动记录信息（`src/tools/memory.ts` 中的 `memoryNote`）

Prompt 由 `prompt-builder.ts` 动态组装：`packages/skills/` 目录下的技能 Markdown → `skill-loader.ts` 加载 → 合并 `hidden-goals.ts` 的行为规则 → 注入记忆上下文。

### 事件系统 (`src/events/`)

所有交互通过统一事件总线流转。`event-bus.ts` 缓冲写入（每 10 条或 30 秒刷新），事件类型定义在 `event-types.ts`。

事件类型（由 Prisma enum `EventType` 定义）：`feed_message`, `conversation_turn`, `conversation_extracted`, `info_extracted`, `mood_change`, `relationship_shift`, `proactive_outreach`, `persona_updated`

异步处理：`extraction-queue.ts` (BullMQ) 消费对话事件，调用 LLM 提取记忆/人格信息写入 PersonaProfile。

### 会话状态机 (`src/state-machine/`)

```
GREETING → (first_message_received) → ACTIVE_CHAT
GREETING → (companionee_silent_timeout) → CLOSING
ACTIVE_CHAT → (companionee_silent_timeout) → CLOSING
CLOSING → (companionee_speaks_again) → ACTIVE_CHAT
任何阶段 → (session_close) → ENDED
```

### 移动端 (`apps/xiaonuan-app/`)

Expo Router 文件系统路由，基于角色自动跳转：
- `(companionee)/` — 老人端（语音优先大 UI，按住说话）
- `(steward)/` — 监护端（配对列表 → 4 标签详情：概览/日志/留言/声音 + 设置）
- 入口 `index.tsx` 根据 auth token + role 跳转

**Store**: `auth-store.ts` (token/pairingId/stewardName/companioneeName) + `role-store.ts`
**API 层**: `src/services/` 封装所有后端调用，不直接使用 fetch
**组件**: `src/components/` (shared/ + steward/ + ui/ 原子组件)

### 数据库核心实体 (`packages/prisma/`)

- **Pairing** — 连接老人-子女-AI 的核心实体
- **Participant** — 成员（COMPANIONEE / STEWARD / AI 陪伴）
- **PersonaProfile** — 结构化画像（分类 + 置信度）
- **Session** — 对话会话 + 状态
- **EventStream** — 统一事件日志（8 种类型）
- **Checkpoint** — 对话检查点（待处理状态）
- **VoiceClone** — 声音克隆
- **FeedMessage** — 家人留言/投喂

### 服务器启动 (`server.ts`)

启动时自动执行：
1. 确保 Qdrant `pairing_memories` 集合存在
2. 启动 BullMQ 提取 worker
3. 调度每日 02:00 事件裁剪（`pruneEvents`）
4. 调度每日 10:00 主动外呼（`runProactiveOutreach`，72h 无互动触发，24h 冷却）

## 关键开发模式

### 添加 API 路由

在 `apps/gateway/src/routes/` 下创建文件，在 `server.ts` 中注册：

```typescript
// 公开路由
await app.register(myRoutes, { prefix: '/api/xxx' });

// 受保护路由
await app.register(async (routes) => {
  await authenticate(routes);
  await myRoutes(routes);
}, { prefix: '/api/xxx' });
```

### 添加 AI 工具

1. 在 `apps/gateway/src/tools/` 下实现函数
2. 在 `pi-agent.ts` 的 `tools` 数组中注册 schema 和 handler

### 数据库变更

```bash
# 修改 schema.prisma → 创建迁移 → 生成客户端
pnpm db:migrate
pnpm db:generate
```

### 测试规范

- 使用 Vitest，测试文件与被测文件同目录 (`*.test.ts`)
- 集成测试从 `server.ts` 导入 app 实例，搭配 supertest
- 外部依赖（prisma, qdrant, redis）通过 `vi.mock()` 模拟

## 环境变量

复制 `.env.example` 为 `.env`，关键变量：
- `DATABASE_URL`, `QDRANT_URL`, `REDIS_URL` — 基础设施
- `DASHSCOPE_API_KEY` — LLM 访问（必填）
- `WECHAT_APPID`, `WECHAT_SECRET` — 微信 OAuth
- `NLS_APP_KEY`, `NLS_ACCESS_KEY_ID`, `NLS_ACCESS_KEY_SECRET` — 阿里云语音
- `PUBLIC_BASE_URL` — 音频文件公网前缀

## 重要说明

- **V0.5 统一 App**：elder-app 已合并到 xiaonuan-app，基于 Expo Router 角色路由
- **绑定 API**：`POST /api/pairings/bind` 返回 `{ success, token, role, pairingId, stewardName, companioneeName }`
- **参与者角色**：`COMPANIONEE`（老人） / `STEWARD`（监护者）
- **静态文件**：网关 `public/` 目录以 `/` 前缀服务（APK 下载、TTS 音频）
- **Docker 网络**：生产环境需要外部 `app-network`
- **数据库重置**：首次生产部署 `./manager.sh db-reset` 会清空所有表
- **TypeScript**: `moduleResolution: NodeNext`（ESM），严格模式，`noUncheckedIndexedAccess`
