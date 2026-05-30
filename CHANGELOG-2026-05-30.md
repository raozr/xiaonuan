# 2026-05-30 项目导入与本地运行整理日志

## 背景

本轮从导入项目开始，对小暖 monorepo 做了项目结构梳理、本地运行验证、问题排查和若干优化修复。重点目标是让 Gateway、移动端、Voice service、Prisma、本地 Docker 基础设施能够在开发环境中稳定跑起来，并解决 Expo 真机调试与 WebSocket 断连问题。

## 修改文件总览

本轮一共修改 19 个文件：

- `.env.example`
- `README.md`
- `docker-compose.yml`
- `packages/prisma/prisma/seed.ts`
- `apps/gateway/src/agent/pi-agent.ts`
- `apps/gateway/src/config/env.ts`
- `apps/gateway/src/conversation/loop.ts`
- `apps/gateway/src/events/event-bus.ts`
- `apps/gateway/src/routes/pairing.ts`
- `apps/voice-service/tests/test_clone.py`
- `apps/xiaonuan-app/.env.development.local`
- `apps/xiaonuan-app/src/components/shared/TextInputPanel.tsx`
- `apps/xiaonuan-app/src/components/shared/VoiceInputOverlay.tsx`
- `apps/xiaonuan-app/src/components/shared/VoiceInputPanel.tsx`
- `apps/xiaonuan-app/src/services/events.ts`
- `apps/xiaonuan-app/src/services/feed.ts`
- `apps/xiaonuan-app/src/services/voice-clone.ts`
- `apps/xiaonuan-app/src/utils/constants.ts`
- `apps/xiaonuan-app/src/utils/theme.ts`

另外，仓库中存在未跟踪文件 `AGENTS.md`，本轮未改动其内容。

## 本地运行环境

### docker-compose

修改 `docker-compose.yml`：

- 去掉固定 `container_name`，避免不同项目或历史容器之间发生名称冲突。
- Qdrant 镜像从旧版本升级到 `qdrant/qdrant:v1.17.0`。
- Gateway 容器内依赖地址改为 Docker Compose service name：
  - PostgreSQL: `postgres`
  - Qdrant: `qdrant`
  - Redis: `redis`
  - Voice service: `voice-service`
- 移除生产环境 JWT 的默认弱密钥 fallback，避免误用默认 secret。

### 环境变量示例

修改 `.env.example`：

- 补充 `PORT`
- 补充 `LOG_LEVEL`
- 补充 `CORS_ORIGIN`
- 补充 `VOICE_SERVICE_URL`
- 调整 `PUBLIC_BASE_URL` 示例为本地开发可用地址。

## Prisma 与数据库

### Seed 修复

修改 `packages/prisma/prisma/seed.ts`：

- 旧 seed 仍在使用已经不存在的 `prisma.family` / elder 旧模型。
- 当前 schema 已切换到 `Pairing` / `Participant`。
- seed 已改为创建新版数据结构：
  - 创建一个 `Pairing`
  - 创建一个真实被陪伴者 participant：`张奶奶`
  - 创建一个 AI participant：`小暖`
  - 生成测试邀请码：`123456`

### 本地数据库重置

排查 WebSocket `1011 Server error` 时发现：

- Gateway 在 WebSocket 鉴权阶段会查询 `participants` 表。
- 本地 Postgres 中没有 `participants` 表。
- Postgres 日志报错：

```text
ERROR: relation "public.participants" does not exist
```

进一步排查发现：

- 仓库中的旧 migration 链会创建 `families`、`elder_profiles`、`child_profiles` 等旧表。
- 当前代码和 Prisma schema 已经使用新版 `pairings`、`participants` 等表。
- 最后一个 migration `20260520_rename_roles_to_companion_steward` 假设 `participants` 表已经存在，因此在本地执行 `prisma migrate deploy` 时失败并进入 P3009 状态。

已在获得明确授权后执行本地开发库重置：

```bash
pnpm --filter @xiaonuan/prisma reset:db
pnpm db:generate
pnpm db:seed
```

重置后确认存在新版表：

- `pairings`
- `participants`
- `sessions`
- `session_messages`
- `checkpoints`
- `daily_summaries`
- `feed_messages`
- `event_stream`
- `persona_profiles`
- `ai_personas`
- `voice_clones`
- `users`

seed 后确认测试数据：

```text
invite_code: 123456
companionee: 张奶奶
ai: 小暖
```

### 遗留说明

当前本地运行使用 `reset:db` 中的 `prisma db push` 对齐最新 schema，而不是旧 migration 链。`prisma migrate status` 仍会提示 migration 未应用，这是因为现有 migration 历史与当前 schema 不匹配。

生产部署前建议整理新的 baseline migration，避免继续依赖已过时的旧 migration 链。

## Gateway 后端

### 环境变量校验

修改 `apps/gateway/src/config/env.ts`：

- 增加生产环境校验。
- 生产环境必须显式配置关键变量。
- 禁止生产环境继续使用默认 JWT secret。
- 禁止生产环境 `CORS_ORIGIN=*`。

### 对话音频 URL

修改 `apps/gateway/src/conversation/loop.ts`：

- 移除硬编码局域网 IP。
- 音频 URL 改为优先使用 `PUBLIC_BASE_URL`。
- 未配置时按本地 `PORT` 推导。

### Event bus 可靠性

修改 `apps/gateway/src/events/event-bus.ts`：

- 批量写入事件失败时，不再直接丢弃事件。
- 会把事件放回 buffer，并在短延迟后重试。

### AI tool 参数校验

修改 `apps/gateway/src/agent/pi-agent.ts`：

- 为工具调用参数增加 zod schema。
- 覆盖工具：
  - `memory_context`
  - `memory_recall`
  - `memory_note`
  - `emergency_alert`
- 当 LLM 返回坏 JSON 或参数不符合 schema 时，返回结构化错误，避免异常打穿。

### Pairing / Feed 接口兼容

修改 `apps/gateway/src/routes/pairing.ts`：

- Feed 创建接口的 `type` 默认值改为 `TEXT`。
- 兼容移动端只提交 `{ content }` 的文本留言调用。

## 移动端

### Expo 真机 API 地址

修改 `apps/xiaonuan-app/.env.development.local`：

```env
EXPO_PUBLIC_API_URL=http://192.168.2.19:3000
```

说明：

- 真机 Expo 不能使用 `localhost` 访问电脑上的 Gateway。
- 手机里的 `localhost` 指向手机自己，不是开发机。
- 真机调试应使用电脑在同一 Wi-Fi 下的局域网 IP。

修改 `apps/xiaonuan-app/src/utils/constants.ts`：

- API 地址优先读取 `EXPO_PUBLIC_API_URL`。
- 如果未配置，则尝试从 Expo dev server 的 `hostUri` / `debuggerHost` 推导电脑 IP。
- 最后才 fallback 到 `http://localhost:3000`。
- WebSocket 地址基于 API host 推导为 `ws://<host>:3000/ws`。
- 避免测试环境直接静态加载 Expo 原生包，保证 Vitest 可正常运行。

实际优先级：

```text
EXPO_PUBLIC_API_URL
-> Expo dev server 推导电脑 IP
-> localhost fallback
```

### Feed service

修改 `apps/xiaonuan-app/src/services/feed.ts`：

- `listFeeds` 兼容后端直接返回数组，以及返回 `{ data, nextCursor }` 的分页对象。
- `createFeed` 改为提交 `{ content }`，配合后端默认 `type=TEXT`。
- `expo-file-system` 改为动态导入，避免测试环境加载问题。
- 补充字段类型：
  - `type`
  - `audioUrl`
  - `createdAt`

### Events service

修改 `apps/xiaonuan-app/src/services/events.ts`：

- 补齐 `getDailySummary`
- 补齐 `getEvents`
- 补齐 `getTodayEvents`

### Voice clone service

修改 `apps/xiaonuan-app/src/services/voice-clone.ts`：

- 补齐 `getVoiceCloneStatus`
- 补齐 `resetVoiceClone`

### Theme token

修改 `apps/xiaonuan-app/src/utils/theme.ts`：

- 补充组件引用到但原先不存在的 token：
  - `surfaceContainerLowest`
  - `headlineSm`
  - `bodyLg`
  - `bodySm`

### 输入组件测试兼容

修改以下组件：

- `apps/xiaonuan-app/src/components/shared/TextInputPanel.tsx`
- `apps/xiaonuan-app/src/components/shared/VoiceInputPanel.tsx`
- `apps/xiaonuan-app/src/components/shared/VoiceInputOverlay.tsx`

调整内容：

- 避免测试环境对 `StyleSheet` 的静态分析问题。
- 修复 animation value 在测试环境下的类型问题。

## Voice service

修改 `apps/voice-service/tests/test_clone.py`：

- 测试不再硬编码旧 TTS model。
- 改为跟随配置读取当前 `tts_model`。
- 更新 mock voice id，以匹配当前配置预期。

## 文档

修改 `README.md`：

- 补充本地 Docker / Colima 运行说明。
- 补充 Qdrant 版本说明。
- 补充 Prisma 本地重置说明。
- 补充 Voice service 本地安装与启动说明。
- 补充 Expo 真机调试时 `EXPO_PUBLIC_API_URL` 的配置说明。
- 说明当前 migration 链与新版 schema 不匹配，生产前需要整理 baseline migration。

## 问题排查记录

### WebSocket 1011 Server error

现象：

```text
LOG [WS] Connected
LOG [WS] Disconnected code=1011 reason=Server error
```

根因：

- WebSocket 握手成功。
- 后端进入鉴权逻辑。
- 对 `COMPANIONEE` 设备校验时查询 `participants` 表。
- 本地数据库缺少 `participants` 表。
- Prisma 查询失败后服务端关闭连接：

```ts
socket.close(1011, 'Server error')
```

修复：

- 重置本地数据库为当前 schema。
- 修复 seed。
- 重新绑定生成新 token。

验证：

WebSocket 客户端测试结果：

```text
open
message {"type":"session:created", ...}
still-open
close 1000 test done
```

说明 WebSocket 已能正常连接、创建 session，并以 `1000` 正常关闭。

### Expo 真机连接失败

问题：

- 把移动端默认 API fallback 改成 `localhost:3000` 后，真机 Expo 无法访问 Gateway。

原因：

- 真机上的 `localhost` 指向手机自己，不是电脑。

修复：

- `.env.development.local` 使用电脑局域网 IP。
- `constants.ts` 增加 Expo host 推导兜底逻辑。

## 对话响应时间优化

### 目标

原链路中，Gateway 会等 LLM 回复、保存 AI 消息、TTS 合成、下载音频并写入 `public/tts` 后，才把文本和音频一起发给移动端。这样 TTS 会阻塞用户看到第一句回复。

本轮将目标调整为：

- 优先降低“用户松手到看到文字”的首响时间。
- 音频可以稍后到达。
- TTS 失败不能影响文本回复。

### 后端调整

修改 `apps/gateway/src/conversation/loop.ts`：

- `handleVoiceText` 在 LLM 返回并清洗文本后，立即发送 `message:ai_text`。
- TTS 改为 `setImmediate` 异步执行，完成后再发送 `ai:audio`。
- TTS 失败时发送 `ai:audio_unavailable`，不影响已发出的文本。
- TTS 文本使用清洗后的可见回复，而不是包含内部结构的原始 LLM 输出。
- 长回复会优先合成第一段较短文本，降低音频首包等待时间。
- 增加 `[Perf]` 耗时日志：
  - `db.save_user_message`
  - `db.increment_turn`
  - `db.get_phase`
  - `agent.create`
  - `agent.process_message`
  - `db.save_ai_message`
  - `ws.send.text`
  - `turn.text_ready`
  - `tts.synthesize`
  - `tts.write_file`
  - `ws.send.audio`
  - `tts.total`

修改 `apps/gateway/src/websocket/session-handler.ts`：

- 为 `message:voice_audio` 增加 ASR 链路耗时：
  - base64 decode
  - m4a -> wav
  - ASR transcribe
- 为 `message:voice_text` / `message:voice_audio` 增加整体处理耗时日志。

修改 `apps/gateway/src/services/voice.ts`：

- 如果 voice-service 返回公网 HTTP URL，Gateway 直接转发。
- 如果是本地或内部 URL，Gateway 仍下载音频并写入 `public/tts`，保证真机可访问。

### Agent 与 Prompt 优化

修改 `apps/gateway/src/agent/skill-loader.ts`：

- 缓存已读取和解析过的技能 Markdown，避免每轮对话重复读文件。

修改 `apps/gateway/src/agent/prompt-builder.ts`：

- 缓存 pairing 下的 companionee、AI participant、steward 基础资料。
- 缓存 TTL 为 60 秒。
- Vitest 环境关闭该缓存，避免测试数据复用同一 pairingId 时互相污染。

修改 `apps/gateway/src/agent/pi-agent.ts`：

- 增加 history、memory context、prompt、LLM、tool call、agent total 的 `[Perf]` 日志。
- 普通输入默认不启用 tools，减少 LLM 工具模式成本。
- 只有输入中出现记忆、家人、健康不适、危机等关键词时启用 tools。
- 普通场景最多 1 轮 tool call，紧急场景最多 2 轮。

### 移动端调整

修改 `apps/xiaonuan-app/app/(companionee)/home.tsx`：

- 增加 `RESPONDING` 状态。
- 收到 `message:ai_text` 后立即更新文本，并从“思考中”切换到“准备播放/回应中”。
- 收到 `ai:audio` 后才进入 `SPEAKING` 并播放音频。
- 收到 `ai:audio_unavailable` 后回到 `IDLE`，允许用户继续说话。
- WebSocket 连接成功后提前发送 `session:create` 预热会话，减少第一次按住说话时等待会话创建的概率。

### Worker 开关

修改 `apps/gateway/src/config/env.ts`、`apps/gateway/src/server.ts`、`.env.example`：

- 新增 `ENABLE_EXTRACTION_WORKER`。
- 默认 `true`。
- 本地开发可设置为 `false`，避免 Gateway 启动时消费 Redis 历史任务并触发真实 LLM 调用。

```env
ENABLE_EXTRACTION_WORKER=false
```

### 测试覆盖

新增/调整 `apps/gateway/src/conversation/loop.test.ts`：

- 覆盖 `message:ai_text` 先于 `ai:audio` 发送。
- 覆盖 TTS 未完成时文本已发送。
- 覆盖 TTS 失败时文本仍保留，并发送 `ai:audio_unavailable`。

## 已执行验证

以下验证通过：

```bash
pnpm build
pnpm test
pnpm --filter @xiaonuan/xiaonuan-app exec tsc --noEmit
pnpm --filter @xiaonuan/xiaonuan-app test
python3 -m pytest
pnpm --filter @xiaonuan/prisma test
pnpm --filter @xiaonuan/gateway test
docker compose config --quiet
```

运行态验证：

- Gateway 实际启动成功。
- `GET /health` 返回正常。
- Voice service 实际启动成功。
- `GET /health` 返回正常。
- Expo / Metro 实际启动成功。
- WebSocket 实际连接成功并创建 session。

## 当前遗留事项

### ESLint 配置

`pnpm lint` 当前失败原因是：

- 项目使用 ESLint 9。
- 仓库仍是旧 `.eslintrc.json` 配置格式。

后续可选方案：

- 迁移到 `eslint.config.js`
- 或把 ESLint 固定回 v8

### Prisma migration baseline

当前旧 migration 链与新版 schema 不匹配。开发环境已可通过 `reset:db` 正常运行，但生产部署前需要整理新的 baseline migration。

### Gateway worker 启动行为

Gateway 启动时会启动 extraction worker，并消费 Redis 中已有任务。这在本地开发时可能触发真实 DashScope 调用。后续建议增加环境变量开关，例如：

```env
ENABLE_EXTRACTION_WORKER=false
```

用于本地开发时关闭后台 worker。

### Expo SDK 依赖版本提示

Expo 启动时提示以下依赖版本与 SDK 55 推荐版本略有偏差：

- `expo-router`
- `react-native-safe-area-context`
- `react-native-screens`

当前测试和启动可用，但后续可用 `expo install` 对齐推荐版本。
