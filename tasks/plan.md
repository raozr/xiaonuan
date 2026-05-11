# Implementation Plan: 子女个人信息 + AI 人设动态生成 + 家庭设定

## Overview

基于 SPEC.md，实现子女端设置页 → 动态 AI System Prompt 生成 → 家庭管理闭环。所有老人信息由子女代管，老人端零新增功能。

## Architecture Decisions

1. **Schema 一次迁移**：所有新增字段（ElderProfile 4 个 + ChildProfile 2 个）在一个 migration 中完成，避免多次 migrate dev 打断开发流。
2. **Prompt Builder 独立模块**：新建 `prompt-builder.ts`，与 `pi-agent.ts` 解耦，方便后续独立测试和迭代 prompt 模板。
3. **Settings 页面单文件垂直实现**：一个设置页内同时完成子女信息、老人信息、家庭管理三个区块的 UI 与 API 对接，避免页面跳转带来的状态同步问题。
4. **老人端零侵入**：`elder-home` 在本次计划中**不做任何修改**，AI 个性化通过后端 Prompt 生成透明生效。

## Dependency Graph

```
Schema Migration (ElderProfile + ChildProfile 扩展)
    │
    ├── API Routes
    │   ├── PUT /api/me
    │   ├── PUT /api/family/elder
    │   └── GET /api/family/settings
    │       │
    │       ├── Prompt Builder
    │       │   └── buildSystemPrompt(familyId)
    │       │       └── AI Agent (替换硬编码 SYSTEM_PROMPT)
    │       │
    │       └── Settings UI (child-settings)
    │           └── Setup Guide Flow (child-home 引导弹窗)
```

## Task List

### Phase 1: Backend Foundation

#### Task 1: Schema Migration & API Routes

**Description**: 扩展 Prisma Schema，生成 migration；新增/改造 API 路由，支持子女信息和老人信息的读写。

**Scope**: 
- `packages/prisma/prisma/schema.prisma`：ElderProfile 新增 `hobbies`, `healthNotes`, `topicsToAvoid`, `greetingPreference`；ChildProfile 新增 `relationshipToElder`, `customNotes`。
- `packages/prisma/prisma/migrations/`：生成并执行 migration。
- `apps/gateway/src/routes/me.ts`：新增 `PUT /api/me`（更新 `name`, `relationshipToElder`, `customNotes`）。
- `apps/gateway/src/routes/family.ts`：新增 `PUT /api/family/elder`（更新所有 ElderProfile 字段）；新增 `GET /api/family/settings`（返回 `{ family, elder, children }` 完整结构）。
- 测试：`me.test.ts` 补 PUT 测试；`family.test.ts` 补 PUT /api/family/elder 和 GET /api/family/settings 测试。

**Acceptance criteria**:
- [ ] `prisma migrate dev` 成功，现有数据不丢失。
- [ ] `PUT /api/me` 只能修改当前登录子女的资料，修改他人返回 403。
- [ ] `PUT /api/family/elder` 只能修改当前家庭老人资料，跨家庭返回 403。
- [ ] `GET /api/family/settings` 返回完整家庭配置，包含子女列表和老人详情。
- [ ] 所有新 endpoint 有 Vitest 测试覆盖，且测试通过。

**Verification**:
- [ ] `cd apps/gateway && pnpm test` 中 `me.test.ts` 和 `family.test.ts` 全绿。
- [ ] 手动 curl：`GET /api/family/settings` 返回 JSON 包含 `elder.hobbies` 等新增字段。

**Dependencies**: None
**Files likely touched**:
- `packages/prisma/prisma/schema.prisma`
- `packages/prisma/prisma/migrations/*`
- `apps/gateway/src/routes/me.ts`
- `apps/gateway/src/routes/family.ts`
- `apps/gateway/src/routes/me.test.ts`
- `apps/gateway/src/routes/family.test.ts`
**Estimated scope**: L（6 个文件，涉及 DB + API + 测试）

---

### Phase 2: AI Core

#### Task 2: AI 动态人设生成

**Description**: 新建 Prompt Builder，根据家庭数据动态生成 System Prompt，替代 `pi-agent.ts` 中的硬编码字符串。

**Scope**:
- 新建 `apps/gateway/src/agent/prompt-builder.ts`：
  - `buildSystemPrompt(familyId: string): Promise<string>`
  - 查询 `Family`（含 `elder`、`children`）
  - 按模板拼接，空字段自动省略
  - `dialect` → "尽量使用 {方言} 风格的表达"
  - `aiTone` 映射：gentle→温柔亲切, lively→活泼热情, calm→沉稳平和
- 改造 `apps/gateway/src/agent/pi-agent.ts`：
  - 删除硬编码 `SYSTEM_PROMPT`
  - `createPiAgent` 中调用 `buildSystemPrompt(config.familyId)`
- 改造 `apps/gateway/src/agent/agent.test.ts`：
  - Mock `prisma` 与 `chatCompletion`
  - 验证 prompt 字符串包含老人姓名、爱好、回避话题、子女 `customNotes`
  - 验证空字段时 prompt 中不出现占位文本

**Acceptance criteria**:
- [ ] `buildSystemPrompt` 能根据 `familyId` 生成完整 prompt。
- [ ] prompt 包含已填写字段（elderName, age, hobbies, healthNotes, topicsToAvoid, greetingPreference, childName, relationshipToElder, childCustomNotes）。
- [ ] 未填写字段在 prompt 中完全省略，不产生空行。
- [ ] 方言非空时 prompt 附加方言风格指令。
- [ ] `agent.test.ts` 不调用真实 LLM，仅验证 prompt 字符串内容，测试通过。

**Verification**:
- [ ] `cd apps/gateway && pnpm test src/agent/agent.test.ts` 全绿。
- [ ] 打印 `buildSystemPrompt` 输出，人工检查格式自然、无空字段残留。

**Dependencies**: Task 1（需要 Schema 和 Prisma Client 支持新字段）
**Files likely touched**:
- `apps/gateway/src/agent/prompt-builder.ts`（新建）
- `apps/gateway/src/agent/pi-agent.ts`
- `apps/gateway/src/agent/agent.test.ts`
**Estimated scope**: M（3 个文件，逻辑密集）

---

### Checkpoint 1: Backend Complete
- [ ] 所有后端测试通过（`gateway` 测试全绿）
- [ ] API 能正确读写新字段
- [ ] AI Prompt 动态生成且内容正确

---

### Phase 3: Frontend

#### Task 3: 子女端设置页

**Description**: 新建 `child-settings` 页面，子女可在一个页面内完成自己信息、老人信息、家庭管理的配置。

**Scope**:
- 新建 `apps/mini-program/pages/child-settings/`：
  - `child-settings.js`：Page 逻辑，onLoad 调用 `GET /api/family/settings` 回填，保存时调用 `PUT /api/me` + `PUT /api/family/elder`
  - `child-settings.wxml`：表单 UI
    - 子女信息卡片：姓名 input、关系 picker（女儿/儿子/儿媳/女婿/其他）、customNotes textarea
    - 老人信息卡片：姓名 input、年龄 picker(50-120)、方言 picker、爱好 textarea、健康注意事项 textarea、回避话题 textarea、问候偏好 input
    - AI 语气设置（预留 UI，不绑定实际保存）
    - 通知设置（预留 UI 占位）
    - 家庭管理：邀请码展示/复制/刷新、成员列表
  - `child-settings.wxss`：视觉风格参照 `doc/design/子女端设置页`（奶油色、大圆角、暖橙主色）
  - `child-settings.json`：页面配置
- 改造 `apps/mini-program/app.json`：注册新页面
- 改造 `apps/mini-program/pages/child-home/child-home.js` + `.wxml`：增加「设置」入口（右上角或底部导航）

**Acceptance criteria**:
- [ ] 设置页加载时正确回填当前家庭信息（含新增字段）。
- [ ] 编辑后点击保存，同时调用 `PUT /api/me` 和 `PUT /api/family/elder`，成功后 toast "保存成功"。
- [ ] 姓名为必填，年龄范围 50-120，其他字段允许为空。
- [ ] 邀请码可复制、可刷新（复用已有 API）。
- [ ] 视觉风格与现有设计稿一致。

**Verification**:
- [ ] 微信开发者工具中打开设置页，所有字段能正常显示和编辑。
- [ ] 保存后重新进入设置页，数据正确回填。
- [ ] `cd apps/mini-program && pnpm test` 中新增 `child-settings.test.ts` 通过。

**Dependencies**: Task 1（依赖 API）
**Files likely touched**:
- `apps/mini-program/pages/child-settings/child-settings.js`（新建）
- `apps/mini-program/pages/child-settings/child-settings.wxml`（新建）
- `apps/mini-program/pages/child-settings/child-settings.wxss`（新建）
- `apps/mini-program/pages/child-settings/child-settings.json`（新建）
- `apps/mini-program/pages/child-settings/child-settings.test.ts`（新建）
- `apps/mini-program/pages/child-home/child-home.js`
- `apps/mini-program/pages/child-home/child-home.wxml`
- `apps/mini-program/app.json`
**Estimated scope**: L（7-8 个文件，UI + 交互 + 测试）

---

### Phase 4: Integration

#### Task 4: 家庭设定闭环

**Description**: 将家庭创建、首次引导、信息完善串联为完整流程。

**Scope**:
- 改造 `apps/mini-program/pages/child-home/child-home.js`：
  - 已有逻辑：检测到 `elderName === "老人"` 时弹出引导弹窗
  - 改造：弹窗按钮「去完善」跳转 `child-settings` 而非 `bind-family`
  - 完善信息后返回，`showGuide` 消失
- 改造 `apps/mini-program/pages/bind-family/bind-family.js`：
  - 创建家庭成功后，若老人信息不完整，提示「下一步：完善老人信息」并引导至 `child-settings`

**Acceptance criteria**:
- [ ] 新用户首次登录 → child-home 弹窗 → 点击「去完善」→ child-settings。
- [ ] 在 settings 保存真实老人姓名后返回 child-home，弹窗不再出现。
- [ ] bind-family 创建家庭成功后，若 elderName 为默认值，引导至 settings。

**Verification**:
- [ ] 手动 E2E：新注册账号 → 自动创建家庭 → 进入 child-home 看到引导 → 设置页填写 → 返回后引导消失。

**Dependencies**: Task 3（依赖 Settings UI 存在）
**Files likely touched**:
- `apps/mini-program/pages/child-home/child-home.js`
- `apps/mini-program/pages/child-home/child-home.wxml`
- `apps/mini-program/pages/bind-family/bind-family.js`
**Estimated scope**: S（3 个文件，轻量导航逻辑）

---

### Checkpoint 2: MVP Complete
- [ ] 子女可完整设置自己和老人信息
- [ ] AI Prompt 动态生成，对话体现个性化
- [ ] 首次引导闭环正常
- [ ] 所有测试通过
- [ ] 老人端无任何新增功能或修改

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prisma migration 与现有开发环境冲突 | Med | 在迁移前确认 docker postgres 已启动；migration 文件命名使用当前时间戳 |
| Prompt 过长导致 LLM token 浪费 | Med | 所有长文本字段前端限制字数；空字段自动省略；如仍过长后续可拆分为「核心 prompt + 记忆召回」 |
| 设置页字段过多导致 UI 拥挤 | Low | 按卡片分组（子女/老人/家庭），滚动布局；保留设计稿的呼吸感间距 |
| `child-settings.test.ts` 小程序测试环境复杂 | Low | 复用 `elder-home.test.ts` 中的 mock 模式（mock wx API + vitest） |

## Open Questions

- `customNotes` 放在子女信息卡片最下方，是否需要在保存时给子女一个提示："这些信息会用于 AI 对话"？（建议：placeholder 已说明，MVP 先不加额外提示）
- AI 语气设置 UI 已预留但暂不保存，是否需要在 settings 页面隐藏该区块以避免困惑？（建议：保留但置灰，标注"即将上线"）
