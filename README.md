# XiaoNuan (小暖) - AI Home-Based Elderly Companion

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.4.0-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)

**XiaoNuan** is an AI elderly companion platform designed specifically for senior citizens and their families. It is not just a chatbot, but an intelligent partner with emotional depth, layered memory, proactive care, and safety monitoring features.

## 🌟 Key Features

- **Layered Memory System**: Simulates human memory logic with four layers — session (current context), daily (recap summaries), short-term (recent conversations), and mid-term (vector-based semantic search via Qdrant). The AI "remembers" the elder's preferences, health status, and family anecdotes.
- **Relationship Profiles**: Maintains structured persona profiles across categories (hobbies, health, preferences, relationships, habits) with confidence scoring and automatic extraction from conversations.
- **Emotional Intelligence**: Tracks mood signals from conversations, surfaces current mood context, and adapts conversation tone accordingly. Supports dialect styles, emotional resonance, and gentle guidance.
- **Proactive Outreach**: Automatically identifies inactive pairings (72h no conversation) and generates proactive care messages at 10:00 AM daily with 24h cooldown.
- **Event Stream Architecture**: All interactions flow through a unified event bus (Feed, Conversation, Extraction, Mood Change, Relationship Shift, Outreach, Persona Update), replacing the previous family-based feed model.
- **Token Budget Control**: Memory context injection capped at ~2700 tokens (4096 chars) with priority-based truncation to prevent context overflow.
- **Session State Machine**: Intelligently identifies conversational phases (Greeting → Active Chat → Closing → Ended) to dynamically adjust AI behavior and context retrieval strategies.
- **Safety Guardrails**: Integrated emergency alerting tools that recognize potential health risks or distress signals and respond promptly.
- **Voice Interaction**: Full-duplex voice conversation powered by Alibaba Cloud speech synthesis and recognition, enabling natural hands-free interaction for elders.
- **Multi-Client Support**: Family members connect via WeChat Mini-program or Child PC Web; elders use a dedicated React Native app with large fonts and simplified UI.
- **Localized Integration**: Deeply integrated with Alibaba's DashScope (Qwen-Plus) LLM for superior performance in Chinese linguistic contexts.

## 🏗️ Project Architecture

This project uses a PNPM Workspace-organized Monorepo structure:

```text
xiaonuan/
├── apps/
│   ├── gateway/          # AI Agent Gateway (Fastify + WebSocket)
│   ├── child-pc/         # Next.js 16+ Web App (Family Member PC Client)
│   ├── mini-program/     # WeChat Mini-program (Family Member Mobile Client)
│   ├── xiaonuan-app/     # Unified React Native Mobile App (Elder + Caregiver, Expo)
│   └── voice-service/    # Python FastAPI Voice Processing Service
├── packages/
│   ├── prisma/           # DB Schema & Persistence Layer (PostgreSQL)
│   └── skills/           # Modular AI Skill Definitions (Prompt Engineering)
├── deploy/
│   └── nginx/            # Production Nginx Reverse Proxy Config
├── docker-compose.yml    # Backend services orchestration
├── Dockerfile            # Gateway service image
└── manager.sh            # Production deployment management script
```

## 🛠️ Tech Stack

- **Language**: TypeScript, Python
- **Backend**: Node.js, Fastify, FastAPI
- **Database**: PostgreSQL, Prisma
- **Vector DB**: Qdrant (for semantic memory retrieval)
- **LLM**: DashScope (Qwen-Plus)
- **Cache**: Redis
- **Speech**: Alibaba Cloud NLS (TTS / ASR)
- **Frontend**:
  - Family: WeChat Mini-program (mobile), Child PC Web (desktop, Next.js 16)
  - Elder: React Native (Expo)

## 🚀 Quick Start

### Prerequisites

- Node.js >= 22
- PNPM >= 9
- Docker (to run PostgreSQL, Qdrant, Redis)
- Python 3.11+ (for voice-service local development)

### Installation & Execution

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd xiaonuan
   ```

2. **Configure Environment**
   Copy `.env.example` in the root to `.env` and fill in necessary API Keys (e.g., `DASHSCOPE_API_KEY`, `WECHAT_APPID`, `WECHAT_SECRET`, `NLS_*` credentials).

3. **One-Command Start (Recommended for Server Deploy)**
   The project is fully Dockerized. Start everything with the management script:
   ```bash
   ./manager.sh start
   ```
   This script wraps `docker compose` and supports `start`, `stop`, `restart`, `update`, `status`, `logs`, `backup`, and `health`.

4. **Manual Development Mode**
   If you need to develop backend code, start the infrastructure first:
   ```bash
   docker-compose up -d postgres qdrant redis
   pnpm install
   pnpm db:generate
   pnpm dev
   ```

## 📱 Client Deployment

### WeChat Mini-program (Family Mobile Client)

The mini-program is developed with native WeChat Mini-program framework.

- **Development**: Open `apps/mini-program/` in WeChat DevTools.
- **Build**: Use WeChat DevTools to upload and publish.
- **Backend**: Ensure the gateway is deployed and the domain is whitelisted in WeChat MP Admin.

### Child PC Web (Family Desktop Client)

A Next.js 16+ web application for family members managing elders from PC.

- **Development**:
  ```bash
  cd apps/child-pc
  pnpm install
  pnpm dev
  ```
- **Build**: `pnpm build` (Next.js App Router, static export)
- **Features**: Pairing management, event timeline, feed posting, voice cloning, elder settings.

### Elder App (Elder Client)

The XiaoNuan app is a unified React Native application built with **Expo**, serving both elderly users (COMPANIONEE) and caregivers (STEWARD).

- **Development**:
  ```bash
  cd apps/xiaonuan-app
  pnpm install
  pnpm start        # Expo dev server
  pnpm android      # or pnpm ios
  ```
- **Build & Deploy via EAS**:
  ```bash
  cd apps/xiaonuan-app
  eas build --profile preview    # Build APK for internal testing
  eas build --profile production # Build AAB for Play Store
  ```
- **Environment Variables**: The `EXPO_PUBLIC_API_URL` is configured in `eas.json` for each build profile.
- **Download Page**: A static landing page for APK download is served from `apps/gateway/public/` (e.g., `https://your-domain/downloads/xiaonuan-elder.apk`).

## ☁️ Backend Deployment

### Architecture

The backend runs as a set of Docker containers orchestrated by `docker-compose.yml`:

| Service | Image / Build | Description |
|---------|--------------|-------------|
| postgres | `postgres:17-alpine` | Main relational database |
| qdrant | `qdrant/qdrant:v1.12.0` | Vector database for memory retrieval |
| redis | `redis:7-alpine` | Cache & session store |
| voice-service | `./apps/voice-service/Dockerfile` | Python FastAPI voice processing |
| gateway | `./Dockerfile` | Node.js AI gateway & API server |

### Production Deployment Steps

1. **Prepare Server**
   - Install Docker & Docker Compose
   - Clone the repository
   - Copy and edit `.env` with production secrets

2. **Start Services**
   ```bash
   ./manager.sh start
   ```
   This builds images and starts all containers on the shared `app-network`.

3. **Reverse Proxy (Nginx)**
   A separate Nginx container configuration is provided in `deploy/nginx/`:
   ```bash
   cd deploy/nginx
   docker compose up -d
   ```
   - Nginx listens on `80` and `443`
   - SSL certificates should be mounted at `./certs/`
   - API requests to `/xiaonuan/` are proxied to the gateway container
   - Static files (landing page, APK) are served from `./www/`

4. **Update & Maintenance**
   ```bash
   ./manager.sh update    # Pull code, rebuild, and restart
   ./manager.sh backup    # Backup PostgreSQL and data directories
   ./manager.sh logs gateway   # Tail gateway logs
   ./manager.sh health    # Check container health status
   ```

## 📄 License

This project is licensed under the [MIT License](LICENSE).
