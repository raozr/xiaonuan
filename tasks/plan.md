# 小暖 MVP 实施计划

## Context
小暖是一款面向空巢老人的 AI 情感陪伴微信小程序。当前从零开始，仅有 PRD、技术架构文档和 11 个 HTML 原型页面。

## Architecture
- **端层**: 微信小程序（老人端纯语音 / 子女端投喂+感知）
- **网关层**: Node.js + Fastify + WebSocket（Phase 状态机主权 + checkpoint 强制注入）
- **AI Core**: Pi Coding Agent SDK（Skill 按 phase 动态加载）
- **持久化**: PostgreSQL + Prisma（业务数据）、Qdrant（向量记忆 + UUID checkpoint）、Redis Streams（队列）

## Tech Stack
| 模块 | 选型 |
|------|------|
| 前端 | 微信小程序 |
| 网关 | Node.js + Fastify |
| Agent | Pi Coding Agent SDK |
| LLM | Qwen-Plus / Claude（Week 2 测试后定） |
| ASR | 阿里云流式语音识别 |
| TTS | 阿里云 CosyVoice |
| 向量库 | Qdrant |
| 关系库 | PostgreSQL + Prisma |
| 队列 | Redis Streams |
| 推送 | 微信模板消息 |

## Phases

### Phase 0: Foundation
- P0.1 Monorepo & Dev Environment (`docker compose up`, `pnpm dev`)
- P0.2 Database Schema (Prisma: Family/User/Session/Checkpoint/Feed/DailySummary)
- P0.3 Gateway Skeleton (Fastify + WebSocket + JWT)

**Checkpoint 0**: `docker compose up` 成功，health check 通过，seed 数据可插入

### Phase 1: Family Binding & Auth
- P1.1 Child phone login + role selection UI
- P1.2 Family creation + 6-digit invite code
- P1.3 Elder binding (invite code) + permanent no-login
- P1.4 Role-based UI routing

**Checkpoint 1**: 子女创建家庭 → 老人绑定 → 双角色入口正确

### Phase 2: Basic Elder Conversation Loop
- P2.1 Elder UI states (default/listening/speaking)
- P2.2 WebSocket real-time session management
- P2.3 Pi Agent integration (companion-persona + memory-protocol Skills)
- P2.4 Memory Tools (memory_context, memory_recall with Qdrant)
- P2.5 Text-based conversation loop (mock ASR/TTS)

**Checkpoint 2**: 老人端 UI 正常，WebSocket 稳定，AI 能召回家庭记忆

### Phase 3: Voice Pipeline
- P3.1 ASR integration (Aliyun streaming)
- P3.2 TTS integration (Aliyun CosyVoice)
- P3.3 Sentence-level streaming pipeline
- P3.4 VAD silence detection (30s / 10min)
- P3.5 Avatar state synchronization

**Checkpoint 3**: ASR + TTS 打通，首句延迟 <= 1.5s，Avatar 同步

### Phase 4: Proactive Greeting
- P4.1 Habit tracking service (first open, >2h, <2h, 3-day anomaly)
- P4.2 Greeting protocol + greeting_topic_select (P1-P4 priority)
- P4.3 Phase state machine (greeting -> active_chat on ASR first output)
- P4.4 Greeting TTS + timing (<= 800ms)

**Checkpoint 4**: 打开小程序，AI 800ms 内主动问候，话题个性化

### Phase 5: Context Checkpoint & Memory Segmentation
- P5.1 context_checkpoint Tool with UUID + idempotency
- P5.2 UUID Sliding Window (recent 3 topics in system prompt)
- P5.3 Gateway-enforced triggers (VAD 30s, farewell, topic shift, turn 20)
- P5.4 Closing phase + session archive (memory_write -> emotion_sensing -> notify_family)
- P5.5 Session compaction hook

**Checkpoint 5**: 长对话自动分段，checkpoint 无感知，UUID 精准召回

### Phase 6: Family Content Feeding
- P6.1 Child feed UI (text, voice memo, photo description)
- P6.2 Feed API + process_family_content subagent + Qdrant storage
- P6.3 Feed -> greeting priority (48h feed = P1 topic)

**Checkpoint 6**: 子女可投喂三种内容，次日问候引用

### Phase 7: Emotion Sensing & Daily Push
- P7.1 emotion_sensing Tool (5-level mood + highlights)
- P7.2 Daily summary generation
- P7.3 WeChat push notification (<= 2min)
- P7.4 Child status page (today's summary)
- P7.5 History page (mood trend)

**Checkpoint 7**: 对话结束自动生成摘要，子女收到推送

### Phase 8: Integration, Polish & Launch Prep
- P8.1 Child settings + memory management CRUD
- P8.2 Error handling & fallbacks (elder never sees tech errors)
- P8.3 Performance optimization (latency targets)
- P8.4 Security & privacy compliance

**Checkpoint 8 (MVP Complete)**: All P0 features end-to-end, performance targets met, privacy compliant

## Key Files
- `apps/gateway/src/server.ts`
- `apps/gateway/src/websocket/session-manager.ts`
- `apps/gateway/src/state-machine/phase-state-machine.ts`
- `apps/gateway/src/vad/vad-module.ts`
- `apps/gateway/src/checkpoint/checkpoint-injector.ts`
- `apps/mini-program/pages/elder/home/*`
- `apps/mini-program/pages/child/home/*`
- `packages/prisma/schema.prisma`
- `packages/skills/*/SKILL.md`

## Reusable Assets
- `doc/design/*/code.html` -> WXML/WXSS adaptation base
- `doc/design/*/DESIGN.md` -> global design tokens (colors, typography, spacing)
- PRD & Tech Arch -> Tool signatures, Skill structures, state machine logic

---

# Plan: WeChat Auth Login + Auto Family Creation

## Overview

Replace the child phone-login flow (SMS verification code) with WeChat authorization (`wx.login` + `getPhoneNumber`). On first registration, the backend automatically creates a default family with a default elder profile, ensuring `ChildProfile.familyId` is never null.

## Architecture Decisions

1. **WeChat Login Method**: Use the traditional `wx.login` + `getPhoneNumber` flow (`encryptedData` + `iv` decryption).
   - Backend calls `jscode2session` with `code` to get `openid` + `session_key`
   - Backend decrypts the phone number using `session_key` (AES-128-CBC)
   - No `access_token` management required

2. **Schema Changes**:
   - `ChildProfile` adds `openid` (unique, optional) for WeChat identity binding
   - `ChildProfile.name` becomes optional, defaulting to `"家长"` on registration
   - `ElderProfile.name` defaults to `"老人"` when auto-created

3. **Auto Family Creation**:
   - After successful phone number authorization, backend auto-creates:
     - `Family` (with auto-generated `inviteCode`)
     - `ElderProfile` (default name `"老人"`, editable later)
     - `ChildProfile` (`openid`, decrypted `phone`, `name="家长"`, `isPrimary=true`)
   - `familyId` is always populated, satisfying the non-nullable constraint

4. **Legacy Cleanup**:
   - Remove old `/api/auth/verify-code` endpoint
   - Replace child login UI from phone-input + SMS-code to WeChat authorization button

## Task List

### Phase 1: Backend Foundation

#### Task 1: Database Migration
- Add `openid` to `ChildProfile` (`String? @unique`)
- Make `ChildProfile.name` optional (`String?`)
- Generate and apply Prisma migration

**AC:**
- [ ] `prisma migrate dev` succeeds
- [ ] Prisma Client types regenerate correctly

**Files:** `packages/prisma/prisma/schema.prisma`, `packages/prisma/prisma/migrations/*`
**Size:** S

---

#### Task 2: WeChat Login Infrastructure
- Add env vars `WECHAT_APPID` and `WECHAT_SECRET`
- New endpoint `POST /api/auth/wechat-code`:
  - Accept `{ code }`
  - Call WeChat `jscode2session` API
  - Return `{ openid, sessionKey }`
- New utility `decryptWechatData(sessionKey, encryptedData, iv)`:
  - AES-128-CBC decryption per WeChat spec
  - Return decrypted JSON (contains phone number)

**AC:**
- [ ] `wechat-code` endpoint returns openid/sessionKey for a valid code
- [ ] Decryption utility has unit tests for success and failure cases

**Files:** `apps/gateway/src/routes/auth.ts`, `apps/gateway/src/utils/wechat.ts` (new), `apps/gateway/.env.example`
**Size:** M

---

#### Task 3: WeChat Registration / Login Endpoint
- Refactor `POST /api/auth/login` to accept `{ openid, sessionKey, encryptedData, iv }`
- Decrypt phone number with `sessionKey`
- Query `ChildProfile` by `openid` or phone
- **If new user:**
  - Create `Family` + `ElderProfile` (default name) + `ChildProfile` (bind to new family)
- **If existing user:**
  - Update `openid` (if missing) and phone (if changed)
- Sign JWT with `{ phone, role: 'CHILD', familyId }`
- Remove old `/api/auth/verify-code`

**AC:**
- [ ] New user: Family + ElderProfile + ChildProfile all created in one transaction
- [ ] Existing user: no duplicate family created
- [ ] JWT contains `familyId`
- [ ] `/api/me` returns correct profile for new users

**Files:** `apps/gateway/src/routes/auth.ts`, `apps/gateway/src/routes/me.ts`, `apps/gateway/src/routes/family.ts`
**Size:** M

**Checkpoint 1:** All backend tests pass, DB migration clean

---

### Phase 2: Mini-Program Frontend

#### Task 4: WeChat Login Page
- On page load: call `wx.login()`, send `code` to `/api/auth/wechat-code`
- Cache `openid` + `sessionKey` in page data

**AC:**
- [ ] Network panel shows successful `wechat-code` request
- [ ] `openid` cached locally

**Files:** `apps/mini-program/pages/child-login/child-login.js` (new/modify)
**Size:** S

---

#### Task 5: Phone Number Authorization Button
- Display `<button open-type="getPhoneNumber">授权手机号登录</button>`
- `onGetPhoneNumber` callback:
  - Extract `encryptedData` + `iv` on success
  - Send to `/api/auth/login` with cached `openid` + `sessionKey`
  - Store returned JWT token
  - `wx.reLaunch` to `child-home`
- Show friendly message if user denies authorization

**AC:**
- [ ] WeChat authorization dialog pops up on button tap
- [ ] Successful auth navigates to child-home
- [ ] Denial shows a retry prompt

**Files:** `apps/mini-program/pages/child-login/child-login.js`, `*.wxml`, `*.wxss`
**Size:** M

---

#### Task 6: Entry Logic Update
- Update `role-select`: "我是子女" navigates to new `child-login` page
- Update `app.js` `checkLoginStatus`:
  - If `/api/me` returns user with `familyId`, go to `child-home`
  - Otherwise fallback to `child-login`

**AC:**
- [ ] Role selection routes to WeChat login
- [ ] Logged-in users auto-enter child-home on restart

**Files:** `apps/mini-program/pages/role-select/role-select.js`, `apps/mini-program/app.js`
**Size:** S

**Checkpoint 2:** End-to-end flow verified (auth -> auto family -> child-home)

---

### Phase 3: Testing & Polish

#### Task 7: Backend Tests
- Mock WeChat `jscode2session` API (using `nock` or manual stub)
- Mock decryption utility
- Test new-user auto-creation path
- Test existing-user login path
- Test decryption failure handling

**AC:**
- [ ] `npm test` auth suite passes

**Files:** `apps/gateway/src/routes/auth.test.ts`
**Size:** M

---

#### Task 8: First-Time Family Guide
- In `child-home`, detect if `elderName` is the default `"老人"`
- Show a banner/modal: "请完善老人信息，以便小暖更好地陪伴"
- Provide a quick link to edit elder info

**AC:**
- [ ] First visit shows the guide
- [ ] Guide disappears after info is updated

**Files:** `apps/mini-program/pages/child-home/child-home.js`, `*.wxml`
**Size:** S

**Checkpoint 3 (Final):** All tests pass, mini-program compiles, manual E2E verified

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `getPhoneNumber` requires certified mini-program (enterprise/individual business) | High | Confirm account type; fallback to manual phone input if not certified |
| `jscode2session` network instability | Med | Frontend retry logic; backend timeout handling |
| Auto-created default family feels abrupt | Low | Task 8 provides first-time guidance to customize elder info |
| `code` is single-use; retry requires fresh `wx.login()` | Med | Frontend ensures one `wx.login()` per flow; re-call on failure |
