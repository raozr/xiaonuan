# XiaoNuan (小暖) - AI Home-Based Elderly Companion

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)

**XiaoNuan** is an AI elderly companion mini-program designed specifically for senior citizens. It is not just a chatbot, but an intelligent partner with emotional depth, memory capabilities, and safety monitoring features.

## 🌟 Key Features

- **Layered Memory System**: Simulates human memory logic, including session memory, daily recaps, short-term updates, and vector-based mid-to-long-term memory retrieval. This allows the AI to "remember" the elder's preferences, health status, and family anecdotes.
- **Emotional Intelligence Strategy**: Built-in conversational skills supporting dialect styles, emotional resonance, and gentle guidance to provide a warm and natural companionship experience.
- **Session State Machine**: Intelligently identifies conversational phases (Greeting, Active Chat, Closing) to dynamically adjust AI behavior and context retrieval strategies.
- **Safety Guardrails**: Integrated emergency alerting tools that can recognize potential health risks or distress signals and respond promptly.
- **Localized Integration**: Deeply integrated with Alibaba's DashScope (Qwen-Plus) LLM for superior performance in Chinese linguistic contexts.

## 🏗️ Project Architecture

This project uses a PNPM Workspace-organized Monorepo structure:

```text
xiaonuan/
├── apps/
│   ├── gateway/          # AI Agent Gateway (Fastify + WebSocket)
│   └── mini-program/     # WeChat Mini-program Frontend
├── packages/
│   ├── prisma/           # DB Schema & Persistence Layer (PostgreSQL)
│   └── skills/           # Modular AI Skill Definitions (Prompt Engineering)
└── infrastructure/       # Infrastructure configurations (Docker, Qdrant, etc.)
```

## 🛠️ Tech Stack

- **Language**: TypeScript
- **Backend**: Node.js, Fastify
- **Database**: PostgreSQL, Prisma
- **Vector DB**: Qdrant (for semantic memory retrieval)
- **LLM**: DashScope (Qwen-Plus)
- **Cache**: Redis
- **Frontend**: WeChat Mini-program

## 🚀 Quick Start

### Prerequisites

- Node.js >= 22
- PNPM >= 9
- Docker (to run PostgreSQL and Qdrant)

### Installation & Execution

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd xiaonuan
   ```

2. **Configure Environment**
   Copy `.env.example` in the root to `.env` and fill in necessary API Keys (e.g., `DASHSCOPE_API_KEY`).

3. **One-Command Start (Recommended)**
   The project is fully Dockerized. Start everything with the management script:
   ```bash
   ./manager.sh start
   ```
   This script wraps `docker-compose` and supports `start`, `stop`, `restart`, `status`, and `logs`.

4. **Manual Development Mode**
   If you need to develop backend code, start the infrastructure first:
   ```bash
   docker-compose up -d postgres qdrant redis
   pnpm install
   pnpm db:generate
   pnpm dev
   ```

## 📄 License

This project is licensed under the [MIT License](LICENSE).
