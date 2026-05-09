# 小暖 MVP 任务清单

## Phase 0: Foundation
- [x] **P0.1** Monorepo & Dev Environment
  - [x] `apps/gateway/` Node.js Fastify 网关
  - [x] `apps/mini-program/` 微信小程序
  - [x] `packages/prisma/` 共享 schema
  - [x] `packages/skills/` Pi Agent Skills
  - [x] `docker-compose.yml` (PostgreSQL + Qdrant + Redis)
  - [x] `pnpm dev` 同时启动
  - [x] ESLint + Prettier + TypeScript 严格模式
- [x] **P0.2** Database Schema (Prisma)
  - [x] Family, User, ElderProfile, ChildProfile
  - [x] Session, SessionPhase
  - [x] Checkpoint, MemoryVector
  - [x] FamilyFeed, DailySummary, HabitLog
  - [x] 索引与家庭隔离
  - [x] Seed 脚本
- [x] **P0.3** Gateway Skeleton
  - [x] Fastify + @fastify/websocket
  - [x] JWT 认证插件
  - [x] WebSocket session 管理
  - [x] 路由结构 `/api/auth/*`, `/api/family/*`, `/api/session/*`, `/api/feed/*`

**Checkpoint 0**: `docker compose up` 成功，health check 通过，seed 数据可插入

## Phase 1: Family Binding & Auth
- [x] **P1.1** Child Phone Login & Role Selection UI
  - [x] 手机号验证码 API (mock SMS)
  - [x] JWT 签发 (7 天)
  - [ ] 身份选择入口页 (WXML 适配)
  - [ ] 子女登录页
- [ ] **P1.2** Family Creation & Elder Info
  - [ ] `POST /api/family`
  - [ ] `POST /api/family/invite-code` (6 位数字, 24h 有效)
  - [ ] ElderProfile 存储
  - [ ] 子女端绑定与引导页 (WXML 适配)
- [ ] **P1.3** Elder Binding & No-Login Flow
  - [ ] `POST /api/family/bind` (设备标识)
  - [ ] 设备绑定 token
  - [ ] 老人端首次绑定页 (WXML 适配)
  - [ ] 免登录自动进入
- [ ] **P1.4** Role-Based UI Routing
  - [ ] 入口角色判断逻辑
  - [ ] 老人端默认态页 (WXML 适配)
  - [ ] 子女端今日状态页 (WXML 适配)

**Checkpoint 1**: 子女创建家庭 → 老人绑定 → 双角色入口正确

## Phase 2: Basic Elder Conversation Loop
- [ ] **P2.1** Elder UI States
  - [ ] 默认态 (Avatar 呼吸 + 大按钮)
  - [ ] 倾听态 (按下 + 专注表情)
  - [ ] 说话态 (嘴部动画 + 情绪表情)
  - [ ] 按钮 120px+，热区 140px+
- [ ] **P2.2** WebSocket Real-Time Session
  - [ ] Message protocol (语音帧 / ASR / AI 回复 / 状态)
  - [ ] Session 创建/恢复
  - [ ] 心跳 + 断线重连
- [ ] **P2.3** Pi Agent Basic Integration
  - [ ] Pi Session 初始化
  - [ ] `companion-persona` Skill (全局)
  - [ ] `memory-protocol` Skill (active_chat)
  - [ ] Tool 注册: memory_context, memory_recall
- [ ] **P2.4** Memory Tools (Qdrant)
  - [ ] `memory_context` Tool
  - [ ] `memory_recall` Tool (语义检索)
  - [ ] Qdrant `family_memories` collection
- [ ] **P2.5** Text-Based Conversation Loop
  - [ ] 网关消息路由
  - [ ] 对话回合计数
  - [ ] 对话历史记录

**Checkpoint 2**: 老人端 UI 正常，WebSocket 稳定，AI 能召回家庭记忆

## Phase 3: Voice Pipeline
- [ ] **P3.1** ASR Integration
  - [ ] 阿里云流式 ASR SDK
  - [ ] 前端 VAD 静音截断
  - [ ] 单次 60 秒上限
- [ ] **P3.2** TTS Integration
  - [ ] 阿里云 CosyVoice SDK
  - [ ] Sentence Buffer (中文标点切割)
  - [ ] 单句合成 <= 400ms
- [ ] **P3.3** Sentence-Level Streaming Pipeline
  - [ ] Sentence Buffer 服务
  - [ ] TTS Queue (并发合成, 串行播放)
  - [ ] Redis Streams 队列
- [ ] **P3.4** VAD Silence Detection
  - [ ] 网关层 VAD 模块
  - [ ] 30s 静默检测 (checkpoint 信号)
  - [ ] 10min 静默检测 (closing 信号)
- [ ] **P3.5** Avatar State Synchronization
  - [ ] 播放开始 -> 嘴部动画
  - [ ] 播放结束 -> 静息
  - [ ] 按住打断 -> 倾听态 + 震动

**Checkpoint 3**: ASR + TTS 打通，首句延迟 <= 1.5s，Avatar 同步

## Phase 4: Proactive Greeting
- [ ] **P4.1** Habit Tracking Service
  - [ ] HabitLog 记录
  - [ ] 习惯分析 (活跃时段)
  - [ ] 3 天未打开异常检测
- [ ] **P4.2** Greeting Protocol & Topic Selection
  - [ ] `greeting-protocol/SKILL.md`
  - [ ] `greeting_topic_select` Tool (P1-P4)
  - [ ] 关怀语气模式
- [ ] **P4.3** Phase State Machine (Greeting -> Active Chat)
  - [ ] `PhaseStateMachine` 类
  - [ ] `onASRFirstOutput` 切换
  - [ ] `resources_discover` 热更新 Skill
- [ ] **P4.4** Greeting TTS & Timing
  - [ ] onShow -> greeting -> TTS 链路
  - [ ] <= 800ms
  - [ ] 网络失败降级

**Checkpoint 4**: 打开小程序，AI 800ms 内主动问候，话题个性化

## Phase 5: Context Checkpoint & Memory Segmentation
- [ ] **P5.1** context_checkpoint Tool with UUID
  - [ ] UUID v4 生成
  - [ ] 幂等性检查 (semantic hash)
  - [ ] Qdrant upsert
- [ ] **P5.2** UUID Sliding Window
  - [ ] 保留最近 3 个话题
  - [ ] 注入 system prompt
  - [ ] `memory_recall` checkpoint_id 参数
- [ ] **P5.3** Gateway-Enforced Checkpoint Triggers
  - [ ] VAD 30s -> inject
  - [ ] 收尾语词典 -> inject
  - [ ] 话题切换检测 (embedding < 0.6)
  - [ ] 轮次阈值 20 轮 -> inject
  - [ ] 注入队列 (避免 turn 竞争)
- [ ] **P5.4** Closing Phase & Session Archive
  - [ ] 道别检测 / 10min 静默 -> closing
  - [ ] memory_write -> emotion_sensing -> notify_family
  - [ ] Session 归档
- [ ] **P5.5** Session Compaction Hook
  - [ ] `session_before_compact` 事件
  - [ ] Sliding Window + checkpoint 摘要 + 最近 5 轮

**Checkpoint 5**: 长对话自动分段，checkpoint 无感知，UUID 精准召回

## Phase 6: Family Content Feeding
- [ ] **P6.1** Child Feed UI
  - [ ] 首页快速入口浮层
  - [ ] 文字故事 (500字, 分类标签)
  - [ ] 时效标注 (P1 话题池)
  - [ ] 语音备忘 (3分钟, ASR 转写)
  - [ ] 照片描述 (10MB, 引导问题)
- [ ] **P6.2** Feed API & Storage
  - [ ] `POST /api/feed`
  - [ ] `process_family_content` Subagent
  - [ ] Qdrant 存储 (时效/来源标记)
  - [ ] 原始音频 24h 删除
- [ ] **P6.3** Feed -> Greeting Priority
  - [ ] 48h 内投喂 = P1 来源
  - [ ] 次日问候生效

**Checkpoint 6**: 子女可投喂三种内容，次日问候引用

## Phase 7: Emotion Sensing & Daily Push
- [ ] **P7.1** emotion_sensing Tool
  - [ ] 5 档情绪标签
  - [ ] 需关注信号
  - [ ] 3 条对话亮点
- [ ] **P7.2** Daily Summary Generation
  - [ ] Summary 结构
  - [ ] DailySummary 表存储
  - [ ] 无对话日不生成
- [ ] **P7.3** WeChat Push Notification
  - [ ] 模板消息/订阅消息接入
  - [ ] <= 2 分钟推送
  - [ ] 习惯异常通知
- [ ] **P7.4** Child Status Page
  - [ ] 今日状态卡片
  - [ ] 需关注高亮
  - [ ] 空状态引导
- [ ] **P7.5** History Page
  - [ ] 近期摘要列表
  - [ ] 情绪趋势图 (7天)

**Checkpoint 7**: 对话结束自动生成摘要，子女收到推送

## Phase 8: Integration, Polish & Launch Prep
- [ ] **P8.1** Child Settings & Memory Management
  - [ ] 设置页
  - [ ] 记忆库 CRUD
  - [ ] 编辑后重新 embedding
- [ ] **P8.2** Error Handling & Fallbacks
  - [ ] 老人端无技术错误提示
  - [ ] ASR 失败语音降级
  - [ ] AI 生成失败兜底回复
  - [ ] checkpoint 失败后台重试
- [ ] **P8.3** Performance Optimization
  - [ ] 首句延迟 <= 1.5s
  - [ ] checkpoint <= 500ms
  - [ ] Phase 切换 <= 100ms
  - [ ] 50 轮内存检查
- [ ] **P8.4** Security & Privacy Compliance
  - [ ] 家庭数据隔离审计
  - [ ] 音频不留存确认
  - [ ] 注销后 30 天清除
  - [ ] AI 身份透明告知

**Checkpoint 8 (MVP Complete)**: All P0 features end-to-end, performance targets met, privacy compliant
