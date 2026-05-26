# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供仓库指引，以便在此代码库中高效工作。

## 项目概览

**小暖 (XiaoNuan)** 是一个 AI 居家养老陪伴平台，采用 PNPM Workspace 组织的 Monorepo 结构，包含以下模块：
- **AI 网关** (`apps/gateway`)：基于 Fastify 的 Node.js 后端，支持 WebSocket
- **小暖 App** (`apps/xiaonuan-app`)：统一 React Native 移动端（Expo SDK 55 + RN 0.83 + NativeWind v4 + Reanimated 4 + Zustand），同时服务于老人 (COMPANIONEE) 和监护人 (STEWARD)
- **语音服务** (`apps/voice-service`)：Python FastAPI 语音处理服务
- **共享包** (`packages/prisma`, `packages/skills`)：数据库 schema 和 AI 技能定义

## 常用命令

### 开发
```bash
# 安装依赖
pnpm install

# 启动开发服务器（需要 Docker 基础设施）
docker-compose up -d postgres qdrant redis  # 先启动基础设施
pnpm db:generate                            # 生成 Prisma 客户端
pnpm dev                                    # 启动所有开发服务器

# 构建和检查
pnpm build
pnpm lint

# 测试
pnpm test                    # 运行所有测试
pnpm --filter @xiaonuan/gateway test   # 仅运行网关测试
```

### 数据库
```bash
pnpm db:migrate      # 运行迁移（开发环境）
pnpm db:generate     # 生成 Prisma 客户端
pnpm db:seed         # 填充种子数据
pnpm db:studio       # 打开 Prisma Studio
```

### 生产部署
```bash
./manager.sh start     # 启动所有 Docker 服务
./manager.sh update    # 完整部署：备份、拉取、重建、重启
./manager.sh logs gateway    # 查看网关日志
./manager.sh health  # 检查服务健康状态
./manager.sh backup  # 备份数据库
```

## 架构概览

### AI 网关 (`apps/gateway`)
基于 Fastify 构建的主后端服务，核心模块如下：

**对话系统** (`src/conversation/`)
- `loop.ts`：对话主编排器，集成 LLM、记忆和工具
- `turn-manager.ts`：管理用户与 AI 之间的轮次

**记忆系统** (`src/memory/`)
分层记忆架构，模拟人类记忆方式：
- 会话记忆：当前对话上下文（基于 Checkpoint）
- 日记忆：按 UTC 日期分组的每日回顾摘要
- 短期记忆：最近的对话摘要（最近 N 条事件）
- 中期记忆：基于 Qdrant 向量 embedding 的语义搜索
- 关系层：各分类下置信度最高的 5 条 PersonaProfile
- 情感追踪：从对话事件中提取情绪信号，使用 40+ 情绪标签映射（开心、悲伤、孤独、焦虑、感激等）
- 上下文构建器：三级注入（日常 → 短期 → 中期），4096 字符 token 预算控制，按优先级截断
- 其他文件：`dedup.ts`（跨层去重）、`entity-vocabulary.ts`（基于实体的记忆词汇）、`greeting-hint.ts`（冷启动问候建议）、`checkpoint-service.ts`（ConversationCheckpoint CRUD）

**事件系统** (`src/events/`)
统一事件驱动架构：
- `event-bus.ts`：中央事件分发器（写入缓冲，每 10 条事件或 30 秒刷新）
- `event-types.ts`：类型安全的事件定义
- `event-archiver.ts`：定期归档事件到长期存储
- `checkpoint-persistence.ts`：基于 Redis 的 Checkpoint 待处理键管理

**服务** (`src/services/`)
- `extraction-queue.ts`：基于 BullMQ 的异步 LLM 提取队列（worker 处理对话事件，用于记忆/人格提取）
- `extraction-service.ts`：入队封装
- `dashscope.ts`：底层 DashScope (Qwen-Plus) LLM API 客户端
- `embedding.ts`：文本 embedding 生成服务，用于向量搜索
- `voice.ts`：语音服务 HTTP 客户端（代理到 `voice-service`）
- `voice-service-client.ts`：音频处理的备选语音服务客户端

**人格服务** (`src/memory/`)
集中的 PersonaProfile 操作：
- `getTopProfiles()`：按置信度取 Top N profile
- `getProfilesByCategories()`：按分类过滤 profile
- `addProfiles()`：批量创建 profile

**Agent 系统** (`src/agent/`)
- `pi-agent.ts`：具备工具调用能力的主 AI agent
- `prompt-builder.ts`：从技能文件构建 prompt
- `skill-loader.ts`：从 `packages/skills/` 加载模块化技能
- `response-cleaner.ts`：从 AI 响应中去除 markdown 代码块和系统产物，再返回给客户端
- `hidden-goals.ts`：注入到每个 prompt 的隐式行为规则（如"不许说自己是机器人"）
- `tone-dictionary.ts`：基于方言的响应转换（四川话、河南话、东北话）
- `PROMPT_ENGINE_SPEC.md`：prompt 构建架构的设计文档

**状态机** (`src/state-machine/`)
会话状态流转：`greeting` → `active-chat` → `closing` → `ended`

**WebSocket 处理器** (`src/websocket/`)
- `session-handler.ts`：实时双工语音会话管理，独立于 HTTP 的 `/ws` 路由

**工具** (`src/tools/`)
- `alert.ts`：紧急事件检测与告警工具，用于安全监控
- `memory.ts`：允许 AI 主动触发记忆操作的工具

**Qdrant 客户端** (`src/qdrant/`)
- `client.ts`：向量数据库客户端初始化和集合管理 (`ensurePairingMemoriesCollection`)

**配置** (`src/config/`)
- `env.ts`：集中式环境变量加载（所有模块共用）

**工具函数** (`src/utils/`)
- `invite-code.ts`：6 位配对码生成
- `timezone.ts`：时区感知的日期处理（以老人本地时间为准）
- `wechat.ts`：微信 OAuth 辅助函数 (code2session, token 验证)
- `audio-convert.ts`：音频格式转换工具

**路由** (`src/routes/`)
- `auth.ts` — 微信 OAuth、静默登录、注册
- `pc-auth.ts` — PC 端认证（STEWARD 网页的登录/注册）
- `pairing.ts` — 配对 CRUD、绑定、解绑、刷新邀请码
- `events.ts` — 事件列表（分页、筛选）
- `feed-event.ts` — Feed 动态创建与管理
- `session.ts` — WebSocket 处理器 (`/ws`)，实时语音
- `asr.ts` / `tts.ts` — 语音识别与合成
- `voice-clone.ts` — 声音克隆 CRUD + 激活
- `me.ts` — 当前用户信息
- `health.ts` — 健康检查

**服务器启动** (`server.ts`)
直接执行时（非作为模块导入）：
1. 确保 Qdrant 集合存在 (`ensurePairingMemoriesCollection`)
2. 启动 BullMQ 提取 worker (`startWorker`)，用于异步 LLM 处理
3. 调度每日凌晨 2:00 的事件裁剪 (`pruneEvents` — 归档旧事件，删除过期事件)
4. 调度每日上午 10:00 的主动外呼 (`runProactiveOutreach` — 向超过 72 小时无互动的配对发送关怀消息，24 小时冷却)
5. 监听 `env.PORT`（默认 3000）

静态文件（APK 下载、音频文件）从 `public/` 目录以 `/` 前缀提供服务。

**中间件** (`src/middleware/`)
- `auth.ts`：`authenticate` 封装器 — 验证 `Authorization: Bearer <token>` JWT，将解码后的 payload 附加到 `request.user`。作为 Fastify 封装插件用于受保护路由。

### 小暖 App (`apps/xiaonuan-app`)
统一 React Native 应用，基于 Expo Router 文件系统路由：

**基于角色的路由：**
- `(companionee)/` — 老人端：绑定页面 + 语音对话首页
- `(steward)/` — 监护端：认证 → 配对列表 → 详情页（4 个标签页：概览/日志/留言/声音）+ 设置/帮助/隐私
- 入口 `index.tsx` 根据 auth token + 角色自动跳转

**技术栈：** Expo SDK 55, React Native 0.83, NativeWind v4, Reanimated 4, Zustand, Lucide 图标, expo-updates OTA 更新

**核心 Store：** `auth-store.ts` (token/pairingId/names), `role-store.ts` (companionee/steward)

### 数据库 Schema (`packages/prisma`)
核心实体（V0.4+ 使用 Pairing 模型替代旧 Family 模型）：
- `Pairing`：连接老人、子女和 AI 人格的核心实体
- `Participant`：配对成员（COMPANIONEE 角色、STEWARD 角色、AI 陪伴）
- `PersonaProfile`：结构化的用户画像事实，含分类和置信度
- `Session`：对话会话，含状态跟踪
- `EventStream`：统一事件日志（feed_message, conversation_turn, conversation_extracted, info_extracted, mood_change, relationship_shift, proactive_outreach, persona_updated）
- `Checkpoint`：对话检查点，含待处理状态
- `VoiceClone`：关联配对的声音克隆记录

### 语音处理 (`apps/voice-service`)
Python FastAPI 服务，负责：
- 实时 ASR（阿里云 NLS）
- 支持声音克隆的 TTS
- 音频文件管理

### AI 技能 (`packages/skills/`)
模块化 prompt 工程 markdown 文件：
- `companion-persona/`：核心人格定义
- `conversation-flow/`：分阶段对话引导
- `conversation-strategy/`：方言和语气策略
- `greeting-protocol/`：开场对话模式
- `memory-protocol/`：记忆摘要 prompt

## 关键开发模式

### 添加新 API 路由
路由位于 `apps/gateway/src/routes/`。模式：
```typescript
import { FastifyInstance } from 'fastify';

export async function myRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    // 实现
  });
}
```

在 `server.ts` 中注册，可选认证中间件：

```typescript
// 公开路由
await app.register(pairingRoutes, { prefix: '/api/pairings' });

// 受保护路由（需要 JWT，通过 authenticate 封装）
await app.register(async (protectedRoutes) => {
  await authenticate(protectedRoutes);
  await myRoutes(protectedRoutes);
}, { prefix: '/api/my-route' });
```

**服务器启动**时还会启动 BullMQ 提取 worker，并调度每日凌晨 2:00 的事件裁剪和上午 10:00 的主动外呼。

### 添加新工具
工具扩展 AI 能力，位于 `apps/gateway/src/tools/`：
1. 在 `tool-schemas.ts` 中定义工具 schema
2. 在 `tool-handlers.ts` 中实现处理器
3. 工具自动对 PI agent 可用

### 添加新移动端页面（小暖 App）
页面使用 Expo Router 文件系统路由，位于 `apps/xiaonuan-app/app/`：
1. 在对应分组下创建页面文件：`(companionee)/`、`(steward)/` 或 `(auth)/`
2. 使用 NativeWind 工具类进行样式设置
3. API 调用通过 `src/services/` 层，不直接使用 fetch
4. 全局状态通过 `src/store/`（auth-store, role-store）

### 数据库变更
1. 修改 `packages/prisma/prisma/schema.prisma`
2. 运行 `pnpm db:migrate` 创建迁移
3. 运行 `pnpm db:generate` 更新客户端
4. 通过 `import { prisma } from '@xiaonuan/prisma'` 访问

### 测试
使用 Vitest。测试文件与源码放在一起（`*.test.ts`）。集成测试从 `server.ts` 导入 app 实例，使用 supertest。
```bash
pnpm test                                   # 运行所有 workspace 测试
pnpm --filter @xiaonuan/gateway test        # 运行网关测试
pnpm --filter @xiaonuan/gateway test:watch  # 监视模式
pnpm --filter @xiaonuan/xiaonuan-app test   # 移动端测试
```

## 环境变量设置

复制 `.env.example` 为 `.env` 并配置：
- `DATABASE_URL`, `QDRANT_URL`, `REDIS_URL`：基础设施
- `DASHSCOPE_API_KEY`：LLM 访问（必填）
- `WECHAT_APPID`, `WECHAT_SECRET`：微信 OAuth
- `NLS_*`：阿里云语音凭证（语音功能需要）
- `PUBLIC_BASE_URL`：外部音频 URL 公网前缀（如 `https://www.example.com/xiaonuan`）

## TypeScript 配置

根目录 `tsconfig.json` 启用了严格模式：
- `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`
- `noUncheckedIndexedAccess` 数组安全访问
- `moduleResolution: NodeNext` 支持 ES 模块

## 重要说明

- **V0.5 统一 App**：V0.5 将 `elder-app` 合并到 `xiaonuan-app`，成为统一的 React Native 应用，通过 Expo Router 实现基于角色的路由。应用根据 auth token + role 自动跳转：
  - `(companionee)/` — 老人端：绑定页面 + 语音对话首页
  - `(steward)/` — 监护端：认证 → 配对列表 → 详情页（4 个标签）+ 设置/帮助/隐私
  - 入口 `index.tsx` 检查认证状态并跳转到对应角色页面
- **Auth Store 字段**：`auth-store.ts` 除 `token` 和 `pairingId` 外还存储 `stewardName` 和 `companioneeName`。这些由绑定 API 返回并持久化到 AsyncStorage。
- **绑定 API 响应**：`POST /api/pairings/bind` 返回 `{ success, token, role, pairingId, stewardName, companioneeName }`。`stewardName` 用于在老人端首页头部展示监护人姓名。
- V0.4 从基于 Family 的数据模型迁移到基于 Pairing 的模型；所有路由使用 `/api/pairings/*`
- **POST /api/pairings** 请求体：`{ name: string, relationship: string, notes?: string }`（此前为 `companioneeName`, `companioneeAge` 等）
- 参与者角色：`COMPANIONEE`（老人）和 `STEWARD`（监护者）（此前为 `ELDER`/`CHILD`）
- 网关从 `apps/gateway/public/` 以 `/` 前缀提供静态文件服务（APK 下载、TTS 音频文件）。APK 落地页在 `public/index.html`。
- 网关生产环境需要外部 Docker 网络 `app-network`
- 语音服务使用 Python 3.11+，依赖在 `requirements.txt` 中

- **生产环境数据库重置**：首次生产部署运行 `./manager.sh db-reset` 会删除所有表并重新创建。在没有生产数据时是安全的。
