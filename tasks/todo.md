# 小暖 MVP 任务清单

## Phase 0: Foundation
- [x] **P0.1** Monorepo & Dev Environment
- [x] **P0.2** Database Schema (Prisma)
- [x] **P0.3** Gateway Skeleton

## Phase 1: Family Binding & Auth
- [x] **P1.1** Child Phone Login & Role Selection UI
- [x] **P1.2** Family Creation & Elder Info
- [x] **P1.3** Elder Binding & No-Login Flow
- [x] **P1.4** Role-Based Auth & User Info

## Phase 1.5: WeChat Auth Login
- [x] **P1.5.1** Database Schema Update (openid, optional name)
- [x] **P1.5.2** WeChat Login Infrastructure
- [x] **P1.5.3** WeChat Registration / Login Endpoint
- [x] **P1.5.4** Mini-Program Login Page
- [x] **P1.5.5** Entry Logic Update
- [x] **P1.5.6** First-Time Family Guide
- [x] **P1.5.7** Backend Tests

## Phase 2: Basic Elder Conversation Loop
- [x] **Task #1** WebSocket Real-Time Session Infrastructure
- [x] **Task #2** Qdrant Memory Tools
- [x] **Task #3** Pi Agent Basic Integration
- [x] **Task #4** Text-Based Conversation Loop
- [x] **Task #5** Elder UI WebSocket Client & States

---

## 新阶段：子女个人信息 + AI 人设动态生成 + 家庭设定

### Task 1: Schema Migration & API Routes
- [ ] **T1.1** Prisma Schema 扩展
  - [ ] ElderProfile 新增 `hobbies`, `healthNotes`, `topicsToAvoid`, `greetingPreference`
  - [ ] ChildProfile 新增 `relationshipToElder`, `customNotes`
  - [ ] `prisma migrate dev` 生成并执行
- [ ] **T1.2** `PUT /api/me` 实现与测试
  - [ ] 更新子女 `name`, `relationshipToElder`, `customNotes`
  - [ ] 权限校验（只能改自己）
  - [ ] `me.test.ts` 补测试
- [ ] **T1.3** `PUT /api/family/elder` 实现与测试
  - [ ] 更新老人所有字段
  - [ ] 权限校验（只能改自己家庭）
  - [ ] `family.test.ts` 补测试
- [ ] **T1.4** `GET /api/family/settings` 实现与测试
  - [ ] 返回 `{ family, elder, children }`
  - [ ] `family.test.ts` 补测试

### Task 2: AI 动态人设生成
- [ ] **T2.1** 新建 `prompt-builder.ts`
  - [ ] `buildSystemPrompt(familyId)` 实现
  - [ ] 查询 Family + Elder + Children
  - [ ] 模板拼接，空字段省略
  - [ ] 方言指令、aiTone 映射
- [ ] **T2.2** 改造 `pi-agent.ts`
  - [ ] 删除硬编码 `SYSTEM_PROMPT`
  - [ ] `createPiAgent` 接入 `buildSystemPrompt`
- [ ] **T2.3** 改造 `agent.test.ts`
  - [ ] Mock prisma + chatCompletion
  - [ ] 验证 prompt 包含所有个性化字段
  - [ ] 验证空字段不出现占位文本

**Checkpoint 1**: 后端测试全绿，Prompt 生成正确

### Task 3: 子女端设置页
- [ ] **T3.1** 新建 `pages/child-settings/`
  - [ ] `child-settings.js`（页面逻辑、API 调用）
  - [ ] `child-settings.wxml`（表单 UI：子女卡片、老人卡片、家庭管理）
  - [ ] `child-settings.wxss`（设计稿风格）
  - [ ] `child-settings.json`
- [ ] **T3.2** `child-home` 增加设置入口
  - [ ] `child-home.js` 增加 navigateTo settings
  - [ ] `child-home.wxml` 增加设置按钮/图标
- [ ] **T3.3** `app.json` 注册新页面
- [ ] **T3.4** 前端测试
  - [ ] 新建 `child-settings.test.ts`
  - [ ] 验证加载回填、保存提交、表单校验

### Task 4: 家庭设定闭环
- [ ] **T4.1** 改造 `child-home` 引导弹窗
  - [ ] 「去完善」按钮跳转 `child-settings`
  - [ ] 完善信息后弹窗消失
- [ ] **T4.2** 改造 `bind-family`
  - [ ] 创建家庭后若信息不完整，引导至 `child-settings`

**Checkpoint 2 (MVP Complete)**: 
- [ ] 子女设置 → AI Prompt 动态 → 老人对话体现个性化
- [ ] 首次引导闭环正常
- [ ] 所有测试通过
- [ ] 老人端无任何修改

---

## 后续阶段（保持原规划）

### Phase 3: Voice Pipeline (剩余)
- [ ] **P3.3** Sentence-Level Streaming Pipeline
- [ ] **P3.4** VAD Silence Detection
- [ ] **P3.5** Avatar State Synchronization

### Phase 4: Proactive Greeting
- [ ] **P4.1** Habit Tracking Service
- [ ] **P4.2** Greeting Protocol & Topic Selection
- [ ] **P4.3** Phase State Machine
- [ ] **P4.4** Greeting TTS & Timing

### Phase 5-8: 保持原规划不变
