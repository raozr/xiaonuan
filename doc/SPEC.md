# XiaoNuan (小暖) Technical Specification

> Version: 0.2.0  
> Last Updated: 2026-05-12  
> Source of truth: this document reflects the actual code implementation in the repository.

---

## 1. Overview

**XiaoNuan** is an AI-powered elderly companion mini-program. It connects senior citizens with a warm, emotionally intelligent AI agent through voice-based conversation on WeChat Mini-Program, while allowing adult children to manage family profiles and monitor wellbeing via a companion app.

### Core Value Proposition
- **Emotional Companionship**: Not a task-oriented assistant, but a "long-time family friend" with memory and emotional depth.
- **Layered Memory System**: Simulates human memory — session, daily recap, short-term updates, and vector-based mid-to-long-term retrieval.
- **Safety Guardrails**: Emergency detection with alert tooling for critical health or emotional distress signals.
- **Localized for Chinese Elders**: Built on Alibaba DashScope (Qwen-Plus) for superior Chinese linguistic and cultural context.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (ES2022, Node >= 22) |
| Package Manager | pnpm (workspace monorepo) |
| Backend Framework | Fastify (HTTP + WebSocket via `@fastify/websocket`) |
| Database | PostgreSQL + Prisma ORM |
| Vector DB | Qdrant (Cosine distance, 1024-dim vectors) |
| Cache | Redis |
| LLM | Alibaba DashScope (`qwen3.6-plus`) |
| Embedding | DashScope `text-embedding-v4` |
| Speech (ASR/TTS) | Alibaba NLS (一句话识别 + 语音合成) |
| Auth | JWT (Fastify JWT), WeChat Mini-Program silent login |
| Frontend | WeChat Mini-Program (native WXML/WXSS/JS) |
| Containerization | Docker Compose |

---

## 3. Project Structure

```text
xiaonuan/
├── apps/
│   ├── gateway/              # AI Agent Gateway (Fastify + WebSocket)
│   │   src/
│   │   ├── agent/            # PiAgent: prompt builder, skill loader, tone adapter
│   │   ├── checkpoint/       # Session checkpoint persistence (placeholder)
│   │   ├── config/           # env.ts — typed environment variables
│   │   ├── conversation/     # Turn manager, conversation loop
│   │   ├── memory/           # Layered memory system (daily, short-term, mid-term, session)
│   │   ├── middleware/       # Auth middleware
│   │   ├── qdrant/           # Qdrant client + collection bootstrap
│   │   ├── routes/           # HTTP API routes (auth, family, me, session, asr, tts)
│   │   ├── services/         # External service clients (dashscope, nls, embedding)
│   │   ├── state-machine/    # Session phase transition logic
│   │   ├── tools/            # Agent tools (memory recall/note, emergency alert)
│   │   ├── types/            # Shared TypeScript types
│   │   ├── utils/            # Utilities (timezone, invite code, wechat)
│   │   ├── vad/              # Voice Activity Detection (placeholder)
│   │   ├── websocket/        # WebSocket session handler
│   │   ├── server.ts         # Fastify bootstrap
│   │   └── test-tool-calling.ts
│   └── mini-program/         # WeChat Mini-Program Frontend
│       pages/
│       ├── index/            # Entry splash page
│       ├── role-select/      # Choose Elder or Child role
│       ├── child-register/   # Child registration form
│       ├── child-home/       # Child dashboard
│       ├── child-settings/   # Family profile management
│       ├── elder-home/       # Elder voice chat interface (3-state UI)
│       └── bind-family/      # Bind elder to family via invite code
├── packages/
│   ├── prisma/               # Prisma schema + generated client
│   └── skills/               # Modular AI Skill Definitions (Markdown)
│       ├── companion-persona/
│       ├── conversation-flow/
│       ├── conversation-strategy/
│       ├── greeting-protocol/
│       └── memory-protocol/
├── doc/                      # Design specs and documentation
│   └── SPEC.md               # This file
├── docs/                     # Manual testing guides
├── tasks/                    # Development task tracking
└── infrastructure/           # Docker Compose, scripts
```

---

## 4. Data Model

### 4.1 Prisma Schema (PostgreSQL)

```prisma
model Family {
  id                String   @id @default(cuid())
  inviteCode        String   @unique
  inviteCodeExpiresAt DateTime?
  elder             ElderProfile?
  children          ChildProfile[]
  sessions          Session[]
  feeds             FamilyFeed[]
  dailySummaries    DailySummary[]
  habitLogs         HabitLog[]
}

model ElderProfile {
  id                  String   @id @default(cuid())
  familyId            String   @unique
  name                String
  age                 Int?
  dialect             String?
  deviceId            String?
  openid              String?  @unique
  hobbies             String?
  healthNotes         String?
  topicsToAvoid       String?
  greetingPreference  String?
  timezone            String   @default("Asia/Shanghai")
}

model ChildProfile {
  id                  String   @id @default(cuid())
  familyId            String
  userId              String   @unique
  name                String?
  phone               String   @unique
  openid              String?  @unique
  isPrimary           Boolean  @default(false)
  relationshipToElder String?
  customNotes         String?
}

model User {
  id    String   @id @default(cuid())
  phone String   @unique
  role  UserRole // ELDER | CHILD
}

model Session {
  id        String       @id @default(cuid())
  familyId  String
  phase     SessionPhase @default(GREETING)
  startedAt DateTime     @default(now())
  endedAt   DateTime?
  turnCount Int          @default(0)
  messages  SessionMessage[]
  checkpoints Checkpoint[]
}

model SessionMessage {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // ELDER | AI
  content   String
}

model Checkpoint {
  id            String   @id @default(cuid())
  sessionId     String   @unique
  topicSummary  String
  keyFacts      String[]
  moodSnapshot  String
  nextTopicHint String?
  checkpointId  String   @unique
}

model FamilyFeed {
  id       String       @id @default(cuid())
  familyId String
  type     FeedType     // TEXT | VOICE | PHOTO
  content  String
  category FeedCategory // PERSON | PLACE | EVENT | PREFERENCE | HEALTH
  isRecent Boolean      @default(false)
  audioUrl String?
  photoUrl String?
}

model DailySummary {
  id         String   @id @default(cuid())
  familyId   String
  date       DateTime @db.Date
  moodLabel  String
  duration   Int      @default(0)
  topicCount Int      @default(0)
  highlights String[]
  concerns   String?
  @@unique([familyId, date])
}

model HabitLog {
  id         String   @id @default(cuid())
  familyId   String
  openedAt   DateTime
  closedAt   DateTime?
  duration   Int      @default(0)
  topicCount Int      @default(0)
}
```

### 4.2 Qdrant Schema (`family_memories`)

| Field | Type | Description |
|-------|------|-------------|
| vector | `float[1024]` | `text-embedding-v4` embedding |
| payload.familyId | keyword | Filter scope |
| payload.sessionId | keyword | Source session |
| payload.checkpointId | keyword | Source checkpoint |
| payload.content | text | Human-readable memory text |
| payload.type | keyword | `checkpoint` |
| payload.createdAt | keyword | ISO timestamp |

---

## 5. Backend API

### 5.1 HTTP Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/health` | GET | No | Liveness probe |
| `/api/auth/debug-appid` | GET | No | Debug WeChat app config |
| `/api/auth/wechat-code` | POST | No | Exchange WeChat `js_code` for `openid` |
| `/api/auth/silent-login` | POST | No | Auto-login via WeChat `code`; returns JWT if known user |
| `/api/auth/register` | POST | No | Register new ELDER or CHILD |
| `/api/family` | GET | JWT | Get current family profile |
| `/api/family` | POST | JWT | Create new family (with elder profile) |
| `/api/family/invite-code` | POST | JWT | Regenerate family invite code |
| `/api/family/elder` | PUT | JWT | Update elder profile |
| `/api/family/settings` | GET | JWT | Get family settings (elder + children) |
| `/api/family/bind` | POST | No | Bind elder device via invite code |
| `/api/me` | GET | JWT | Get current user profile |
| `/api/asr/transcribe` | POST | JWT | Speech-to-text (base64 WAV -> text) |
| `/api/tts/synthesize` | POST | JWT | Text-to-speech (text -> MP3 URL) |

### 5.2 Authentication

- **Elder**: WeChat silent login -> JWT with `familyId`, `role: ELDER`, `deviceId`; expires in **365 days**.
- **Child**: WeChat silent login or phone code -> JWT with `phone`, `role: CHILD`, `familyId`; expires in **7 days**.
- **Registration Flow**:
  1. Child registers first -> auto-creates Family with placeholder Elder.
  2. Child generates invite code (24h expiry).
  3. Elder enters invite code on their device -> binds to Family.

---

## 6. WebSocket Protocol

Endpoint: `ws://<host>:<port>/ws?token=<JWT>`

### 6.1 Client -> Server Messages

| Type | Payload | Description |
|------|---------|-------------|
| `session:create` | `{}` | Create a new session (phase = GREETING) |
| `session:resume` | `{ sessionId }` | Resume an existing session |
| `message:voice_text` | `{ text }` | Send transcribed elder speech |
| `pong` | `{}` | Heartbeat response |

### 6.2 Server -> Client Messages

| Type | Payload | Description |
|------|---------|-------------|
| `session:created` | `{ sessionId }` | Session created successfully |
| `session:resumed` | `{ sessionId }` | Session resumed successfully |
| `message:ai_text` | `{ text }` | AI text reply (client then calls TTS) |
| `phase:changed` | `{ phase }` | Session phase transitioned |
| `ping` | `{}` | Heartbeat probe (every 30s) |
| `error` | `{ message }` | Error message |

### 6.3 Session State Machine

```text
GREETING --(first_message_received)--> ACTIVE_CHAT
GREETING --(elder_silent_30s)-------> CLOSING
ACTIVE_CHAT --(elder_silent_30s)-----> CLOSING
CLOSING --(elder_speaks_again)-------> ACTIVE_CHAT
CLOSING --(session_close)------------> ENDED
```

- **Silence Detection**: 30s timeout after last elder message. If triggered in GREETING or ACTIVE_CHAT, auto-transition to CLOSING and send a gentle closing remark.
- **Heartbeat**: Server sends `ping` every 30s. Disconnects after 2 missed `pong` responses (60s).
- **Session Close**: On WebSocket disconnect, session ends after a 5-minute grace period. A checkpoint is generated asynchronously.

---

## 7. AI Agent Architecture (PiAgent)

### 7.1 Agent Lifecycle

```
1. createPiAgent({ familyId, phase })
   -> loadSkillsForPhase(phase)          // Load relevant skills
   -> buildSystemPrompt(familyId, skills, state)
      -> Fetch family profile (elder + children)
      -> Inject tone adapter (dialect, preferences)
      -> Inject hidden goals (based on turn count)
      -> Assemble XML-structured prompt
   -> Process message via LLM
      -> Build message array: [system, ...history(10), user]
      -> Call DashScope with tools
      -> Handle tool call loop (max 3 turns)
      -> Extract <response> content
```

### 7.2 System Prompt Structure

The system prompt is assembled dynamically from 7 sections:

1. **Role & Persona**: "You are XiaoNuan, a warm, patient companion..."
2. **Directive Priority** (P0 > P1 > P2 > P3):
   - P0: Medical / life safety (stop chat, alert)
   - P1: Emotional resonance (abandon memory tasks, empathize)
   - P2: Fact & memory retrieval (when emotionally stable)
   - P3: Hidden goal achievement (subtle objectives)
3. **Current State**: `current_time`, `turn_count`, `current_context`
4. **Skills Aggregation**: Phase-relevant skills injected verbatim
5. **Tone & Personalization**: Elder name, age, dialect, hobbies, health notes, children info
6. **Anti-Patterns**: Medical advice prohibition, mechanical language ban
7. **Output Format**: Mandatory XML `<thought>` + `<response>` structure

### 7.3 Agent Tools

| Tool | Function | Trigger |
|------|----------|---------|
| `memory_recall` | Vector search + feed lookup by query | Specific entities, vague time references, contradiction verification |
| `memory_note` | Write new fact to `FamilyFeed` | New preferences, health events, life events |
| `emergency_alert` | Log critical alert (SMS/push TODO) | Self-harm keywords, severe physical distress |

### 7.4 Skills (packages/skills)

| Skill | Phase | Priority | Description |
|-------|-------|----------|-------------|
| `companion-persona` | all | L3 | Global persona, speaking style, safety boundaries |
| `conversation-strategy` | all | L1 | Emotional echo, medical redline, crisis detection, cognitive support |
| `conversation-flow` | active_chat | L2 | Topic transitions, silence handling, pacing |
| `greeting-protocol` | greeting | L2 | Time-aware greeting logic, topic triage |
| `memory-protocol` | active_chat, closing | L2 | memory_recall / memory_note usage guidelines |

---

## 8. Memory System

The memory system simulates human memory through 4 layers, queried concurrently with fault tolerance (`Promise.allSettled`).

### 8.1 Memory Layers

| Layer | Source | Trigger Condition | Content |
|-------|--------|-------------------|---------|
| **Session Memory** | `SessionMessage` table | Always | Recent 10 messages (turn manager) |
| **Daily Memory** | Checkpoints from today | `turnCount <= 3` | Today's ended session summaries |
| **Short-term Memory** | Checkpoints from past 3 days | `turnCount <= 3` | Recent facts (max 2 per day) |
| **Mid-term Memory** | Qdrant vectors + FamilyFeed | Input >= 10 chars or entity match | Semantic recall of long-term memories |
| **Greeting Hint** | `nextTopicHint` from last checkpoint | `phase === GREETING` | Suggested opening topic |

### 8.2 Cross-Layer Deduplication

Before injecting memory into the prompt, sections are parsed and deduplicated using **LCS (Longest Common Subsequence)** similarity with a threshold of `0.6`. This prevents redundant facts from appearing when daily and short-term memories overlap.

### 8.3 Checkpoint Generation

Triggered every **5 turns** and on session close:
1. Collect all session messages.
2. Prompt LLM to generate JSON: `{ topicSummary, keyFacts[], moodSnapshot, nextTopicHint }`.
3. **Triple-write** (async, best-effort):
   - **Prisma**: Upsert `Checkpoint` record.
   - **Qdrant**: Upsert vector embedding of summary + facts.
   - **FamilyFeed**: Insert each key fact as a typed feed entry.

### 8.4 Dynamic Entity Vocabulary

Mid-term memory retrieval is gated by `shouldTrigger()`. If the elder's input is short (< 10 chars), the system checks against a dynamically built vocabulary of family-specific entities (names, places, hobbies) before performing an expensive vector search.

---

## 9. Voice Interaction

### 9.1 Elder Flow (End-to-End)

```
[Hold FAB] -> Record WAV (16kHz, mono, 30s max)
   -> [Release] -> Stop Recording
      -> Base64 encode -> POST /api/asr/transcribe
         -> Text -> WS message:voice_text
            -> Backend: save message + AI process + save AI message
               -> WS message:ai_text
                  -> POST /api/tts/synthesize
                     -> MP3 file -> Play audio
                        -> [Show Interrupt Button]
                           -> [Tap Interrupt] -> Stop audio -> Return to idle
```

### 9.2 ASR (Automatic Speech Recognition)

- **Service**: Alibaba NLS (一句话识别)
- **Input**: Base64-encoded WAV, 16000Hz, mono
- **Output**: Plain text
- **Error Handling**: Toast "未能识别到语音内容" if empty result

### 9.3 TTS (Text-to-Speech)

- **Service**: Alibaba NLS (语音合成)
- **Voice**: `xiaoyun` (female, warm)
- **Format**: MP3, 16000Hz
- **Storage**: Saved to `apps/gateway/public/tts/<uuid>.mp3`
- **Serving**: Static file via Fastify `public/` directory
- **Cleanup**: Files accumulate; no automated cleanup in v0.2.

### 9.4 Elder UI States (3-State Design)

| State | Visual Cues | Interaction |
|-------|-------------|-------------|
| **Idle** | Large avatar (440rpx), orange FAB (240rpx), shadow | Hold FAB to record |
| **Listening** | Dual pulse rings, pressed FAB (scale 0.95), animated waveform, hint "我在听…" | Release to stop |
| **Processing** | Avatar static, FAB muted gray, hint "小暖在想…" | Wait |
| **Speaking** | Ambient glow, breathing avatar, waveform, transcript bubble, interrupt button | Tap interrupt to stop |

### 9.5 Waveform Animation

Simulated via `setInterval(150ms)` with random bar heights (10-70rpx). Activated during listening and speaking; reset to baseline on state change.

---

## 10. Frontend Mini-Program

### 10.1 Pages

| Page | Path | Role | Description |
|------|------|------|-------------|
| Entry | `pages/index/index` | All | Splash + auto-login check |
| Role Select | `pages/role-select/role-select` | All | Choose Elder or Child |
| Child Register | `pages/child-register/child-register` | Child | Phone + name registration |
| Child Home | `pages/child-home/child-home` | Child | Dashboard placeholder |
| Child Settings | `pages/child-settings/child-settings` | Child | Manage elder profile, regenerate invite code |
| Elder Home | `pages/elder-home/elder-home` | Elder | Voice chat interface |
| Bind Family | `pages/bind-family/bind-family` | Elder | Enter invite code |

### 10.2 Global State (app.js)

```javascript
globalData: {
  apiBase: 'http://localhost:3000',  // LAN IP for real-device debugging
  token: null,
  role: null,
  userInfo: null,
}
```

### 10.3 Networking

- **HTTP**: Wrapped `wx.request` with base URL and token injection.
- **WebSocket**: Auto-connect on `elder-home` load; exponential backoff reconnection (max 3 attempts); 30s ping/pong heartbeat.

---

## 11. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `3000` | Gateway HTTP port |
| `LOG_LEVEL` | `info` | Fastify logger level |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `JWT_SECRET` | `xiaonuan-dev-secret` | JWT signing secret |
| `DATABASE_URL` | `postgresql://xiaonuan:xiaonuan@localhost:5432/xiaonuan` | PostgreSQL connection |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST API |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `WECHAT_APPID` | — | WeChat Mini-Program AppID |
| `WECHAT_SECRET` | — | WeChat Mini-Program Secret |
| `DASHSCOPE_API_KEY` | — | Alibaba DashScope API key |
| `NLS_APP_KEY` | — | Alibaba NLS AppKey |
| `NLS_ACCESS_KEY_ID` | — | Alibaba Cloud AccessKey ID |
| `NLS_ACCESS_KEY_SECRET` | — | Alibaba Cloud AccessKey Secret |

---

## 12. Deployment

### 12.1 Docker Compose (Recommended)

```bash
./manager.sh start   # Start PostgreSQL + Qdrant + Redis + Gateway
./manager.sh stop    # Stop all
./manager.sh logs    # Tail logs
```

### 12.2 Manual Development

```bash
# 1. Start infrastructure
docker-compose up -d postgres qdrant redis

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client
pnpm db:generate

# 4. Run migrations
pnpm db:migrate

# 5. Start dev servers
pnpm dev              # Starts gateway + watches
```

### 12.3 WeChat Mini-Program DevTools

1. Import `apps/mini-program` directory.
2. Set **request domain** to your LAN IP or `localhost` (disable domain check in dev tools).
3. Set **WebSocket domain** accordingly.
4. Ensure `app.js` `apiBase` matches your LAN IP for real-device preview.

---

## 13. Testing

| Test Suite | Command | Coverage |
|------------|---------|----------|
| Gateway unit tests | `pnpm --filter @xiaonuan/gateway test` | Memory, conversation loop, agent, auth |
| Prisma tests | `pnpm --filter @xiaonuan/prisma test` | Schema validation |
| Mini-program tests | `pnpm --filter @xiaonuan/mini-program test` | Page logic, WebSocket mock, voice flow |
| E2E | `node apps/gateway/e2e-test.mjs` | Full WebSocket dialogue cycle |
| Manual | `docs/manual-testing-phase2.md` | Phase 2 feature checklist |

---

## 14. Known Limitations & TODOs

| Item | Status | Notes |
|------|--------|-------|
| Emergency Alert (SMS/Push) | TODO | `emergencyAlert()` logs only; no actual notification channel |
| TTS File Cleanup | TODO | MP3 files accumulate in `public/tts/` |
| Real-time ASR Streaming | Future | Currently batch ASR after recording stops |
| Voice Volume-based Waveform | Future | Waveform is simulated, not driven by actual audio amplitude |
| Child Dashboard | Partial | `child-home` is a placeholder; today-status, history, memory library UIs designed but not implemented |
| Elder History Page | Future | `goToHistory()` shows toast placeholder |
| Daily Summary Generation | Future | Schema exists; no automated generation pipeline |

---

## 15. Changelog

### v0.2.0 (2026-05-12)
- **Voice Interaction**: Redesigned elder-home with 3-state UI (idle / listening / speaking), waveform animation, interrupt button.
- **Docs**: Added this SPEC.md as living documentation.

### v0.1.0 (2026-05)
- Initial MVP release with layered memory, PiAgent, skill system, WebSocket session management, ASR/TTS integration, family profile management, and Docker deployment.
