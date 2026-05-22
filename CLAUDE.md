# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**XiaoNuan (小暖)** is an AI elderly companion platform with a monorepo structure organized by PNPM workspaces. It consists of:
- **AI Gateway** (`apps/gateway`): Fastify-based Node.js backend with WebSocket support
- **XiaoNuan App** (`apps/xiaonuan-app`): Unified React Native mobile app (Expo) for elderly users (COMPANIONEE) and caregivers (STEWARD)
- **Family Mini-Program** (`apps/mini-program`): WeChat mini-program for family members
- **Child PC** (`apps/child-pc`): Next.js 16+ web application (see its own CLAUDE.md)
- **Voice Service** (`apps/voice-service`): Python FastAPI service for speech processing
- **Shared Packages** (`packages/prisma`, `packages/skills`): Database schema and AI skill definitions

## Common Commands

### Development
```bash
# Install dependencies
pnpm install

# Start all development servers (requires Docker infrastructure)
docker-compose up -d postgres qdrant redis  # Start infrastructure first
pnpm db:generate                            # Generate Prisma client
pnpm dev                                    # Start all apps in dev mode

# Build and lint
pnpm build
pnpm lint

# Testing
pnpm test                    # Run all tests
pnpm --filter @xiaonuan/gateway test   # Run gateway tests only
```

### Database
```bash
pnpm db:migrate      # Run migrations (dev)
pnpm db:generate     # Generate Prisma client
pnpm db:seed         # Seed database
pnpm db:studio       # Open Prisma Studio
```

### Production Deployment
```bash
./manager.sh start     # Start all services with Docker
./manager.sh update    # Full deploy: backup, pull, rebuild, restart
./manager.sh logs gateway    # Tail gateway logs
./manager.sh health  # Check service health
./manager.sh backup  # Backup database
```

## Architecture Overview

### AI Gateway (`apps/gateway`)
The main backend service built on Fastify with these key modules:

**Conversation System** (`src/conversation/`)
- `loop.ts`: Main conversation orchestrator integrating LLM, memory, and tools
- `turn-manager.ts`: Manages turn-taking between user and AI

**Memory System** (`src/memory/`)
Layered memory architecture simulating human memory:
- Session memory: Current conversation context
- Daily memory: Daily recap summaries
- Short-term memory: Recent conversation summary
- Mid-term memory: Vector-based semantic search (Qdrant)
- Relationship layer: Top 5 PersonaProfile facts across categories
- Emotion tracker: Mood signals extracted from conversation events
- Context builder: Three-layer injection with 4096-char token budget control

**Event System** (`src/events/`)
Unified event-driven architecture:
- `event-bus.ts`: Central event dispatcher (write buffer, 10 events or 30s flush)
- `event-types.ts`: Type-safe event definitions
- `event-archiver.ts`: Periodic event archival to long-term storage
- `checkpoint-persistence.ts`: Redis-backed checkpoint pending key management

**Extraction Services** (`src/services/`)
- `extraction-queue.ts`: BullMQ-based async LLM extraction queue
- `extraction-service.ts`: Enqueue wrapper for extraction jobs

**Persona Service** (`src/memory/`)
Centralized PersonaProfile operations:
- `getTopProfiles()`: Top N profiles by confidence
- `getProfilesByCategories()`: Category-filtered profiles
- `addProfiles()`: Batch profile creation

**Agent System** (`src/agent/`)
- `pi-agent.ts`: Primary AI agent with tool calling capabilities
- `prompt-builder.ts`: Constructs prompts from skill files
- `skill-loader.ts`: Loads modular skills from `packages/skills/`

**State Machine** (`src/state-machine/`)
Session states: `greeting` → `active-chat` → `closing` → `ended`

**Tools** (`src/tools/`)
- Emergency alert tool for safety monitoring
- WebSocket handler for real-time voice streaming

### Database Schema (`packages/prisma`)
Key entities (V0.4 uses Pairing model, replacing the old Family model):
- `Pairing`: Core entity linking elder, child, and AI persona
- `Participant`: Members of a pairing (ELDER role, CHILD role, AI companion)
- `Elder`: Elderly user profile (embedded as Participant with role=ELDER)
- `PersonaProfile`: Structured persona facts with categories and confidence
- `Session`: Conversation session with state tracking
- `EventStream`: Unified event log (feed_message, conversation_turn, conversation_extracted, info_extracted, mood_change, relationship_shift, proactive_outreach, persona_updated)
- `Checkpoint`: Conversation checkpoint with pending status
- `VoiceClone`: Voice cloning records linked to pairing

### Voice Processing (`apps/voice-service`)
Python FastAPI service handling:
- Real-time ASR (Alibaba Cloud NLS)
- TTS with voice cloning support
- Audio file management

### AI Skills (`packages/skills/`)
Modular prompt engineering in markdown format:
- `companion-persona/`: Core personality definition
- `conversation-flow/`: Phase-based conversation guidance
- `conversation-strategy/`: Dialect and tone strategies
- `greeting-protocol/`: Opening conversation patterns
- `memory-protocol/`: Memory summarization prompts

## Key Development Patterns

### Adding a New API Route
Routes are in `apps/gateway/src/routes/`. Pattern:
```typescript
import { FastifyInstance } from 'fastify';

export async function myRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    // Implementation
  });
}
```

Register in `server.ts` with optional authentication middleware.

### Adding a Tool
Tools extend AI capabilities in `apps/gateway/src/tools/`:
1. Define tool schema in `tool-schemas.ts`
2. Implement handler in `tool-handlers.ts`
3. Tool is automatically available to the PI agent

### Database Changes
1. Edit `packages/prisma/prisma/schema.prisma`
2. Run `pnpm db:migrate` to create migration
3. Run `pnpm db:generate` to update client
4. Access via `import { prisma } from '@xiaonuan/prisma'`

### Testing
Uses Vitest. Test files co-located with source (`.test.ts` suffix):
```bash
pnpm --filter @xiaonuan/gateway test       # Run once
pnpm --filter @xiaonuan/gateway test:watch  # Watch mode
```

## Environment Setup

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL`, `QDRANT_URL`, `REDIS_URL`: Infrastructure
- `DASHSCOPE_API_KEY`: LLM access (required)
- `WECHAT_APPID`, `WECHAT_SECRET`: WeChat OAuth
- `NLS_*`: Alibaba Cloud speech credentials (for voice features)
- `PUBLIC_BASE_URL`: Public URL prefix for external audio URLs (e.g. `https://www.example.com/xiaonuan`)

## TypeScript Configuration

Strict mode enabled in root `tsconfig.json`:
- `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`
- `noUncheckedIndexedAccess` for array safety
- `moduleResolution: NodeNext` for ES modules

## Important Notes

- **child-pc** app uses Next.js 16 with breaking API changes from training data; see its own CLAUDE.md
- V0.4 migrated from Family-based to Pairing-based data model; all routes use `/api/pairings/*`
- Gateway requires external Docker network `app-network` for production
- Voice service uses Python 3.11+ with `requirements.txt`
- Mini-program is native WeChat framework (not Taro/uni-app)
- Elder-app uses Expo SDK 55 with React Native 0.83
- Elder-app includes `expo-updates` for OTA updates; configure `updates.url` in `app.json`
