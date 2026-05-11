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

## Phase 2.5: 子女个人信息 + AI 人设动态生成 + 家庭设定

### Task 1: Schema Migration & API Routes
- [x] **T1.1** Prisma Schema 扩展
- [x] **T1.2** `PUT /api/me` 实现与测试
- [x] **T1.3** `PUT /api/family/elder` 实现与测试
- [x] **T1.4** `GET /api/family/settings` 实现与测试

### Task 2: AI 动态人设生成
- [x] **T2.1** 新建 `prompt-builder.ts`
- [x] **T2.2** 改造 `pi-agent.ts`
- [x] **T2.3** 改造 `agent.test.ts`

**Checkpoint 1**: 后端测试全绿，Prompt 生成正确

### Task 3: 子女端设置页
- [x] **T3.1** 新建 `pages/child-settings/`
- [x] **T3.2** `child-home` 增加设置入口
- [x] **T3.3** `app.json` 注册新页面
- [x] **T3.4** 前端测试

### Task 4: 家庭设定闭环
- [x] **T4.1** 改造 `child-home` 引导弹窗
- [x] **T4.2** 改造 `bind-family`

**Checkpoint 2 (MVP Complete)**: 
- [x] 子女设置 → AI Prompt 动态 → 老人对话体现个性化
- [x] 首次引导闭环正常
- [x] 所有测试通过
- [x] 老人端无任何修改

---

## Phase 2.6: 分层记忆系统（当前阶段）

> 详细计划见 `tasks/plan.md`

### Phase 2.6.1: 集成清理与后端验证
- [ ] **M1** 清理死代码（删除 `session-memory.ts`）
- [ ] **M2** 补全 `agent.test.ts` 边界测试（turnCount、降级、messages 顺序）

**Checkpoint A**: 后端代码干净、测试全绿、构建通过

### Phase 2.6.2: 代码提交
- [ ] **M3** 分组提交分层记忆系统代码（memory / checkpoint / state-machine / agent）

**Checkpoint B**: 本地仓库已提交，工作区干净

### Phase 2.6.3: 手动 E2E 验证
- [ ] **M4** 单次对话多轮记忆验证
- [ ] **M5** 跨 session（同一天）记忆验证
- [ ] **M6** 跨天短期记忆验证
- [ ] **M7** 中短期向量召回验证
- [ ] **M8** Phase 状态机验证（GREETING → CLOSING → ENDED）
- [ ] **M9** Checkpoint 生成验证（断开 + 5 轮增量）

**Checkpoint C**: 所有手动验证场景通过，结果记录到 `docs/manual-testing-memory.md`

### Phase 2.6.4: 性能与 Token 预算验证
- [ ] **M10** 记忆查询耗时 ≤ 200ms 验证
- [ ] **M11** Token 预算估算与截断保护

**Checkpoint D (分层记忆系统 MVP Complete)**:
- [ ] 手动验证全通过
- [ ] 性能达标
- [ ] Token 预算可控
- [ ] 代码已提交
- [ ] 准备进入 Phase 3

---

## 后续阶段（保持原规划）

### Phase 3: Voice Pipeline
- [ ] **P3.3** Sentence-Level Streaming Pipeline
- [ ] **P3.4** VAD Silence Detection
- [ ] **P3.5** Avatar State Synchronization

### Phase 4: Proactive Greeting
- [ ] **P4.1** Habit Tracking Service
- [ ] **P4.2** Greeting Protocol & Topic Selection
- [ ] **P4.3** Phase State Machine（已在分层记忆中实现基础版，后续扩展）
- [ ] **P4.4** Greeting TTS & Timing

### Phase 5-8: 保持原规划不变
