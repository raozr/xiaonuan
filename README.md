# 小暖 (XiaoNuan) - AI 居家养老陪伴

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.6.0-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)

**小暖**是一个 AI 养老陪伴平台，专为老年人和他们的家庭设计。它不仅仅是一个聊天机器人，更是一个具备情感深度、分层记忆、主动关怀和安全监控能力的智能伙伴。

## 🌟 核心特性

- **分层记忆系统**：模拟人类记忆逻辑，共七层——会话（当前上下文）、日记忆（每日回顾摘要）、短期（最近对话）、中期（基于 Qdrant 向量的语义搜索）、关系层（Top 人格画像）、情感状态（近 5 天情绪追踪）、家人留言（子女最近投喂）。AI 能"记住"老人的偏好、健康状况和家庭轶事。
- **情绪智能**：从对话中追踪情绪信号，使用 40+ 情绪标签映射呈现当前情绪上下文，并根据情绪调整对话语气。支持跨会话的情感回溯，让老人感受到"被惦记着"。
- **关系画像**：跨分类（爱好、健康、偏好、关系、习惯）维护结构化人格画像，含置信度评分和时间标签（如"2周前"），并支持从对话中自动提取。
- **主动外呼**：自动识别超过 72 小时无互动的配对，于每日上午 10:00 生成主动关怀消息，24 小时冷却。
- **事件流架构**：所有交互通过统一事件总线流转（Feed、对话、提取、情绪变化、关系转变、外呼、人格更新），替代了原先的基于家庭的 feed 模型。
- **Token 预算控制**：记忆上下文注入上限约 2700 token（4096 字符），按优先级截断以防止上下文溢出。
- **会话状态机**：智能识别对话阶段（问候 → 活跃聊天 → 结束 → 已结束），动态调整 AI 行为和上下文检索策略。
- **家人留言**：子女可通过消息标签页给老人留言或投喂内容，AI 在对话中自然引用，打通家人与 AI 的沟通桥梁。
- **对话历史**：老人端首页可进入“对话历史”，按聊天气泡展示已保存的一问一答文字记录，支持按日期分组与分页加载更早记录。
- **安全护栏**：集成紧急告警工具，能识别潜在的健康风险或求救信号并及时响应。
- **语音交互**：基于阿里云语音合成与识别实现全双工语音对话，让老人能够自然地进行免提交互。
- **统一移动端**：单个 React Native 应用（Expo SDK 55），同时服务老人（COMPANIONEE——大字体、语音优先 UI）和监护人（STEWARD——配对管理、每日摘要、Feed、声音克隆）。基于 Expo Router 的角色路由。
- **本地化集成**：深度集成阿里云 DashScope (Qwen-Plus) LLM，在中文语境下性能卓越。支持多种方言风格（普通话、四川话、东北话、北京话、上海话、河南话、粤语），AI 身份使用注册名称而非固定名字。

## 🏗️ 项目架构

本项目采用 PNPM Workspace 组织的 Monorepo 结构：

```text
xiaonuan/
├── apps/
│   ├── gateway/          # AI Agent 网关 (Fastify + WebSocket)
│   ├── xiaonuan-app/     # 统一 React Native 移动端（COMPANIONEE + STEWARD，Expo SDK 55）
│   └── voice-service/    # Python FastAPI 语音处理服务
├── packages/
│   ├── prisma/           # 数据库 Schema 与持久化层（PostgreSQL）
│   └── skills/           # 模块化 AI 技能定义（Prompt 工程）
├── deploy/
│   └── nginx/            # 生产 Nginx 反向代理配置
├── doc/                  # 架构文档与设计文档
├── scripts/
│   └── doctor.mjs        # 本地开发环境自检脚本
├── docker-compose.yml    # 后端服务编排
├── Dockerfile            # 网关服务镜像
└── manager.sh            # 生产部署管理脚本
```

## 🛠️ 技术栈

- **语言**：TypeScript, Python
- **后端**：Node.js 22+, Fastify 5, BullMQ
- **数据库**：PostgreSQL 17, Prisma ORM
- **向量数据库**：Qdrant v1.17（语义记忆检索）
- **LLM**：DashScope (Qwen-Plus)
- **缓存**：Redis 7
- **语音**：阿里云 NLS (TTS / ASR)
- **移动端**：React Native（Expo SDK 55, NativeWind v4, Reanimated 4, Zustand）

## 🚀 快速开始

### 前置条件

- Node.js >= 22
- PNPM >= 9
- Docker / Colima（运行 PostgreSQL、Qdrant、Redis）
- Python 3.11+（如需本地开发语音服务）

### 安装与运行

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd xiaonuan
   ```

2. **配置环境变量**
   复制根目录下的 `.env.example` 为 `.env`，填写必要的 API 密钥（如 `DASHSCOPE_API_KEY`、`WECHAT_APPID`、`WECHAT_SECRET`、`NLS_*` 凭据）。

3. **启动 Docker 与基础设施**
   如果使用 Colima：
   ```bash
   colima start
   ```
   首次本地运行如果没有共享网络，先创建一次：
   ```bash
   docker network create app-network
   ```
   然后启动基础设施：
   ```bash
   docker compose up -d postgres qdrant redis
   ```

4. **初始化数据库与依赖**
   ```bash
   pnpm install
   pnpm db:generate
   pnpm --filter @xiaonuan/prisma exec prisma migrate status
   ```
   如果是全新的开发库，继续执行：
   ```bash
   pnpm db:migrate
   ```
   如果本地已有旧库但 migration history 不一致，先备份数据，再选择重建开发库或使用 Prisma 的 `migrate resolve` 标记历史迁移。

5. **本地环境自检**
   ```bash
   pnpm run doctor
   ```
   该脚本会检查 `.env`、PostgreSQL、Redis、Qdrant、Gateway health、Voice service health，并输出移动端当前使用的 `EXPO_PUBLIC_API_URL`。如果 Gateway 或 voice-service 尚未启动，对应 health 检查会失败，这是预期的排障信号。

6. **一键启动（推荐服务器部署）**
   项目已完全 Docker 化。使用管理脚本一键启动：
   ```bash
   ./manager.sh start
   ```
   该脚本封装了 `docker compose`，固定使用 `xiaonuan` 作为 Compose project name，并使用 `xiaonuan-*` 容器名，避免不同目录名启动出多套容器；支持 `start`、`stop`、`restart`、`update`、`status`、`logs`、`backup` 和 `health`。

7. **手动开发模式**
   如需开发后端代码，先启动基础设施：
   ```bash
   pnpm --filter @xiaonuan/gateway dev
   ```
   本地只调试 API 或 WebSocket 时，可在 `.env` 中设置 `ENABLE_EXTRACTION_WORKER=false`，避免启动时消费 Redis 中的历史提取任务并触发真实 LLM 调用。
   语音服务可单独启动：
   ```bash
   cd apps/voice-service
   python3 -m pip install -r requirements.txt
   python3 main.py
   ```
也可使用 `./manager.sh dev` 一键启动本地开发环境。该命令会自动寻找已安装 `uvicorn` 的 Python 解释器；如本机有多个 Python，可显式指定：
```bash
PYTHON_BIN=/usr/bin/python3 ./manager.sh dev
```

### 对话响应链路

Gateway 在处理对话时会优先把 LLM 文本通过 WebSocket 发给移动端，然后异步执行 TTS，音频生成完成后再发送 `ai:audio`。如果 TTS 失败，后端会发送 `ai:audio_unavailable`，移动端保留文本回复并回到可继续对话状态。

对话链路已加入 `[Perf]` 分段耗时日志，覆盖 ASR 转换/识别、记忆上下文、prompt、LLM、tool call、TTS、文件写入和 WebSocket send，可用来定位首响和音频延迟。

### 近期工程变更

- **老人端对话历史**：新增 `GET /api/conversation/history`，仅允许 COMPANIONEE token 读取当前配对的 `SessionMessage`；移动端新增 `/(companionee)/history` 页面，首页“对话历史”按钮进入聊天气泡式记录。AI 回复落库改为保存清洗后的用户可见文本。
- **对话首响优化**：Gateway 在 LLM 回复清洗完成后立即发送 `message:ai_text`，TTS 改为后续异步发送 `ai:audio`；TTS 失败时发送 `ai:audio_unavailable`，不再阻塞文本回复。
- **可观测性整理**：新增统一观测工具，`[Perf]` 日志固定携带 `sessionId`、`pairingId`、`turnCount`、`stage`、`elapsedMs` 等字段；WebSocket send、ASR、LLM、TTS 等关键阶段都可追踪。
- **WebSocket 契约类型化**：Gateway 侧新增服务端消息类型和发送 helper，移动端新增 WebSocket 消息类型，减少事件名和 payload 漂移。
- **老人端状态收敛**：将老人端首页的连接、录音、处理、播放、错误恢复等逻辑抽入 `useCompanioneeConversation`，页面组件回归渲染与动画。
- **语音服务本地启动修复**：`manager.sh dev` 支持自动选择可用 Python；voice-service 依赖改为 `httpx[socks]`，修复 SOCKS 代理环境下 ASR 请求缺少 `socksio` 导致的 500。
- **本地自检脚本**：新增 `pnpm run doctor`，用于快速确认基础设施、Gateway、voice-service 和移动端 API 地址配置。

## 🔧 AI 名字迁移

V0.5+ 版本中，AI 陪伴使用注册的参与者名称而非固定的"小暖"。如已有生产数据，需运行迁移脚本：
```bash
pnpm --filter @xiaonuan/gateway migrate:ai-names
```
该脚本会将所有 AI 参与者的名字更新为 Pairing 的 `name` 字段值。

## 📱 小暖 App（老人 + 监护统一客户端）

小暖 App 是一个统一的 React Native 应用，基于 **Expo SDK 55** 构建，通过基于角色的路由同时服务于老人（COMPANIONEE）和监护人（STEWARD）。

- **开发**：
  ```bash
  cd apps/xiaonuan-app
  pnpm start        # Expo 开发服务器
  pnpm android      # 或 pnpm ios
  ```
- **通过 EAS 构建与发布**：
  ```bash
  cd apps/xiaonuan-app
  eas build --profile preview    # 构建 APK 用于内部测试
  eas build --profile production # 构建 AAB 用于 Play 商店
  ```
- **环境变量**：开发环境优先读取 `apps/xiaonuan-app/.env.development.local` 中的 `EXPO_PUBLIC_API_URL`；真机调试时应使用电脑在同一局域网内的可访问地址。若未配置，App 会尝试从 Expo dev server 推导电脑 IP，最后才回退到 `localhost`。
- **下载页面**：APK 下载的静态落地页位于 `apps/gateway/public/index.html`（如 `https://your-domain/`）。
- **注意**：早期版本的微信小程序 (`apps/mini-program/`) 和子女 PC 端 (`apps/child-pc/`) 已移除，统一由 `xiaonuan-app` 覆盖所有用户角色。

#### COMPANIONEE（老人端）功能
- **语音优先界面**：大麦克风按钮，按住说话，AI 语音+文字回复
- **对话历史**：首页右上角历史按钮进入完整文字记录，按日期分组、聊天气泡展示，默认定位最近记录并支持加载更早内容
- **文字输入**：麦克风旁提供文字输入入口，语音不便时可直接发送文本消息
- **简易绑定**：6 位邀请码键盘，快速配对
- **动态标题**：显示监护人姓名，增加个性化
- **呼吸吉祥物**：动画陪伴头像，温暖友好的设计

#### STEWARD（监护端）功能
- **配对管理**：列表视图展示在线状态，创建新配对
- **概览标签页**：实时状态 + 每日摘要（情绪、时长、亮点、关注事项）
- **日志标签页**：按日期分组的对话历史，含情绪快照
- **消息标签页**：社交时间线，支持文字/语音输入、分页、删除确认
- **声音标签页**：单次录音的声音克隆，含引导文本
- **设置页面**：账号管理、密码修改、通知开关、帮助中心、隐私政策

## ☁️ 后端部署

### 架构

后端以 Docker 容器组形式运行，由 `docker-compose.yml` 编排。数据使用 Docker 命名卷（named volumes）持久化：

| 服务 | 镜像 / 构建 | 描述 |
|------|-------------|------|
| postgres | `postgres:17-alpine` | 主关系数据库 |
| qdrant | `qdrant/qdrant:v1.17.0` | 向量数据库，用于记忆检索 |
| redis | `redis:7-alpine` | 缓存与会话存储 |
| voice-service | `./apps/voice-service/Dockerfile` | Python FastAPI 语音处理 |
| gateway | `./Dockerfile` | Node.js AI 网关与 API 服务器 |

### 生产部署步骤

1. **准备服务器**
   - 安装 Docker 和 Docker Compose
   - 克隆仓库到 `main` 分支
   - 复制并编辑 `.env` 填写生产环境密钥

2. **创建 Docker 网络**
   ```bash
   docker network create app-network
   ```

3. **首次部署：重置数据库**
   ```bash
   ./manager.sh db-reset
   ```
   这会删除所有现有表和数据库，然后创建全新的空表。仅首次部署时需要。

4. **启动服务**
   ```bash
   ./manager.sh start
   ```
   这会构建镜像并在共享的 `app-network` 上启动所有容器。

5. **Nginx 反向代理**
   Nginx 应配置为将 `/xiaonuan/` 代理到 3000 端口的网关容器。配置模板位于 `deploy/nginx/prd/`。

6. **更新与维护**
   ```bash
   ./manager.sh update    # 拉取代码、重建、重启
   ./manager.sh backup    # 备份 PostgreSQL 和数据目录
   ./manager.sh logs gateway   # 查看网关日志
   ./manager.sh health    # 检查容器健康状态
   ./manager.sh dev       # 本地开发：启动基础设施 + 语音 + 网关
   ./manager.sh stop-dev  # 停止本地开发服务
   ```

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 发布。
