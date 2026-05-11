# 小暖 (XiaoNuan) - AI 居家养老陪伴机器人

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)

**小暖** 是一款专为高龄老人设计的 AI 居家养老陪伴小程序。它不仅是一个聊天机器人，更是一个具备情感深度、记忆能力和安全守候能力的智能伙伴。

## 🌟 核心特性

- **分层记忆系统 (Layered Memory)**：模拟人类记忆逻辑，包含回话记忆、当天回顾、短期动态及基于向量检索的中短期记忆。让 AI 能够“记住”老人的喜好、健康状况和家庭琐事。
- **情感化对话策略 (Emotional Intelligence)**：内置多种对话 Skill，支持方言风格、情感共鸣和委婉引导，提供温暖、不生硬的陪伴体验。
- **会话状态机 (Session State Machine)**：智能识别对话阶段（问候、活跃、结束），根据不同阶段动态调整 AI 的行为和召回策略。
- **安全守候 (Safety Guardrails)**：集成紧急告警工具，能够识别潜在的健康风险或求助信号并及时响应。
- **全栈国产化适配**：深度集成阿里通义千问 (DashScope) 大模型，确保中文语境下的极佳表现。

## 🏗️ 项目架构

本项目采用 PNPM Workspace 组织的单体仓库 (Monorepo) 结构：

```text
xiaonuan/
├── apps/
│   ├── gateway/          # AI Agent 网关 (Fastify + WebSocket)
│   └── mini-program/     # 微信小程序前端
├── packages/
│   ├── prisma/           # 数据库模型与持久化层 (PostgreSQL)
│   └── skills/           # 模块化 AI 技能定义 (Prompt Engineering)
└── infrastructure/       # 基础设施配置 (Docker, Qdrant 等)
```

## 🛠️ 技术栈

- **语言**: TypeScript
- **后端**: Node.js, Fastify
- **数据库**: PostgreSQL, Prisma
- **向量数据库**: Qdrant (用于语义记忆检索)
- **大模型**: DashScope (Qwen-Plus)
- **缓存**: Redis
- **前端**: 微信小程序

## 🚀 快速启动

### 环境要求

- Node.js >= 22
- PNPM >= 9
- Docker (用于运行 PostgreSQL 和 Qdrant)

### 安装与运行

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd xiaonuan
   ```

2. **配置环境**
   复制根目录下的 `.env.example` 为 `.env`，并根据需要填写 API Key（如 `DASHSCOPE_API_KEY`）。

3. **一键启动（推荐）**
   本项目已实现全栈 Docker 化，并提供管理脚本简化操作：
   ```bash
   ./manager.sh start
   ```
   该脚本封装了 `docker-compose` 命令，支持 `start`, `stop`, `restart`, `status`, `logs` 等常用操作。

4. **手动开发模式**
   如果您需要进行后端代码开发，可以先启动基础设施：
   ```bash
   docker-compose up -d postgres qdrant redis
   pnpm install
   pnpm db:generate
   pnpm dev
   ```

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 协议。
