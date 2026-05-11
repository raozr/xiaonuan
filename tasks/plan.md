# Implementation Plan: 分层记忆系统收尾与验证

## Overview

基于 SPEC.md（分层记忆系统 v2.0），当前 8 个 Feature 的核心代码均已实现，97 个单元测试全绿，TypeScript 构建通过。本计划聚焦于**集成清理、代码提交、端到端验证、性能与 Token 预算确认**，确保记忆系统从"代码完成"达到"可交付状态"，然后平稳过渡到 Phase 3（Voice Pipeline）。

## Current State

| 模块 | 状态 | 备注 |
|------|------|------|
| 回话记忆 (session) | ✅ 已实现 | `turn-manager.ts` 的 `getRecentMessages` 已接入 `pi-agent.ts` |
| 当天记忆 (daily) | ✅ 已实现 | `daily-memory.ts` + `context-builder.ts` 注入 |
| 短期记忆 (short-term) | ✅ 已实现 | `short-term-memory.ts` 聚合 3 天 keyFacts |
| 中短期记忆 (mid-term) | ✅ 已实现 | `mid-term-memory.ts` 按需触发，Qdrant + FamilyFeed |
| 长期记忆 (long-term) | ✅ 已实现 | `prompt-builder.ts` 动态生成 System Prompt |
| Checkpoint 自动生成 | ✅ 已实现 | 双保险：断开 5 分钟延迟 + 每 5 轮增量更新 |
| Session Phase 状态机 | ✅ 已实现 | GREETING → ACTIVE_CHAT → CLOSING → ENDED |
| Qdrant Collection 初始化 | ✅ 已实现 | 启动时幂等创建 `family_memories` + `familyId` 索引 |
| 单元测试 | ✅ 97 tests pass | 覆盖记忆层、checkpoint、状态机、qdrant、agent |
| 代码提交 | ⚠️ 未提交 | 大量新文件在 working tree 中 |
| 手动 E2E 验证 | ⚠️ 未执行 | SPEC 要求 6 组手动验证场景 |
| 性能/Token 预算 | ⚠️ 未验证 | SPEC 约束：查询 ≤ 200ms，Token 有明确上限 |

## Architecture Decisions

1. **Context Injection 为主**：各层记忆整理为自然语言文本注入 System Prompt，不依赖 LLM 主动调用 `memory_context` 工具。当前 `pi-agent.ts` 的 `processMessage` 已按此实现。
2. **Session 历史走 messages 数组**：回话记忆以结构化 `{role, content}` 数组形式注入 LLM messages，而非拼接为 prompt 文本。`session-memory.ts` 中的文本格式化版本已废弃，由 `turn-manager.ts` 的 `getRecentMessages` 取代。
3. **Checkpoint 双保险**：WebSocket 断开启动 5 分钟延迟任务，`session:resume` 取消该任务；同时每 5 轮对话异步增量更新，防异常丢失。

## Dependency Graph

```
集成清理（死代码移除、测试补全）
    │
    ├── 代码提交（git commit）
    │       │
    │       └── 手动 E2E 验证
    │               │
    │               └── 性能与 Token 预算验证
    │                       │
    │                       └── 进入 Phase 3: Voice Pipeline
    │
    └── 测试回归（pnpm test + pnpm build）
```

## Task List

### Phase 1: 集成清理与后端验证

#### Task 1: 清理死代码与集成缺口

**Description**: 移除未使用的 `session-memory.ts`，确认 `pi-agent.ts` 与各层记忆的集成无冲突，确认 token 预算在代码层面已受控。

**Scope**:
- 删除 `apps/gateway/src/memory/session-memory.ts`（功能已被 `turn-manager.ts` 的 `getRecentMessages` 完全覆盖）
- 从 `apps/gateway/src/memory/index.ts` 移除 `getSessionMemory` 导出
- 确认 `pi-agent.ts` 的 `fullSystemPrompt` 拼接顺序：System Prompt（长期记忆）→ Skill → 动态记忆上下文（当天/短期/中短期）→ messages 数组（回话历史）→ user message
- 确认各层记忆返回空字符串时不会产生空行或多余换行

**Acceptance criteria**:
- [ ] `session-memory.ts` 已删除，`pnpm build` 无报错
- [ ] `memory/index.ts` 不再导出 `getSessionMemory`
- [ ] `pnpm test` 全绿（97+ tests）
- [ ] `context-builder.ts` 的空层省略逻辑经代码审查确认

**Verification**:
- [ ] `pnpm build` 成功
- [ ] `pnpm test` 通过
- [ ] `grep -r "getSessionMemory" src/` 无结果（除 `.test.ts` 外）

**Dependencies**: None
**Files likely touched**:
- `apps/gateway/src/memory/session-memory.ts`（删除）
- `apps/gateway/src/memory/index.ts`
**Estimated scope**: XS（1-2 个文件）

---

#### Task 2: 补全后端测试覆盖

**Description**: 确保 `agent.test.ts` 验证完整的 messages 数组结构，确认性能相关断言就位。

**Scope**:
- 在 `agent.test.ts` 中新增/强化测试：验证 `processMessage` 构造的 messages 数组严格符合 `system → history → user` 顺序
- 验证当 `turnCount = 1, 2, 3` 时 `buildMemoryContext` 被调用，当 `turnCount >= 4` 时 `daily`/`short-term` 不被调用
- 验证 `pi-agent.ts` 在 `buildMemoryContext` 抛错时不会崩溃，仍能正常回复

**Acceptance criteria**:
- [ ] `agent.test.ts` 包含对完整 messages 数组顺序的断言
- [ ] `agent.test.ts` 包含 turnCount 边界的 mock 验证
- [ ] `agent.test.ts` 包含记忆构建失败时的降级断言
- [ ] 全量测试通过，无回归

**Verification**:
- [ ] `pnpm test src/agent/agent.test.ts` 全绿
- [ ] `pnpm test` 全绿

**Dependencies**: Task 1
**Files likely touched**:
- `apps/gateway/src/agent/agent.test.ts`
**Estimated scope**: S（1 个文件，逻辑密集）

---

### Checkpoint 1: Backend Code Complete
- [ ] 死代码已清理
- [ ] 所有测试通过
- [ ] TypeScript 构建无错误
- [ ] 人类 Review 通过（可选）

---

### Phase 2: 代码提交

#### Task 3: 提交分层记忆系统

**Description**: 将当前 working tree 中所有与分层记忆系统相关的修改整理为清晰的 commit。

**Scope**:
- 按逻辑分组提交（建议 3-4 个 commit）：
  1. `feat(memory): 分层记忆模块（daily/short-term/mid-term/context-builder）`
  2. `feat(memory): checkpoint 自动生成与 Qdrant family_memories 初始化`
  3. `feat(websocket): Session Phase 状态机与静默检测`
  4. `feat(agent): PiAgent 接入动态记忆上下文`
- 每个 commit 附带 `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`

**Acceptance criteria**:
- [ ] 所有新文件已 staged
- [ ] Commit message 符合项目风格（参考 `git log` 历史）
- [ ] `git status` 无未提交的 memory/state-machine/qdrant/agent/websocket 变更

**Verification**:
- [ ] `git log --oneline -5` 显示新 commits
- [ ] `pnpm test` 在干净工作区中通过
- [ ] `pnpm build` 通过

**Dependencies**: Checkpoint 1
**Files likely touched**: git only
**Estimated scope**: S（提交操作，需仔细分组）

---

### Checkpoint 2: Committed & Build Clean
- [ ] 代码已提交至本地仓库
- [ ] 干净工作区可重建并测试通过

---

### Phase 3: 手动端到端验证

#### Task 4: 执行 SPEC 手动验证清单

**Description**: 按照 SPEC.md 第 6 节"Manual Verification"，在本地或测试环境执行 6 组端到端验证。

**Scope**:
1. **单次对话记忆**：同一 session 内连续多轮，AI 能引用之前说过的话。
2. **跨 session（同一天）**：上午聊"儿子周末回来"，关闭小程序，下午进入，AI 能提及此话题。
3. **跨天短期记忆**：3 天内聊到"膝盖不舒服"，后续对话 AI 自然引用。
4. **中短期召回**：老人说"我喜欢打太极"，之后提到"太极"，AI 能召回"早上去公园打太极"。
5. **状态机**：新 session 第一句为问候（GREETING skill 生效）；静默 30s 后 AI 道别（CLOSING）。
6. **Checkpoint 生成**：断开后 5 分钟内未恢复，数据库出现 checkpoint；5 轮对话后 checkpoint 被更新。

**Acceptance criteria**:
- [ ] 6 组场景全部通过，结果记录到 `docs/manual-testing-memory.md`
- [ ] 若某场景失败，记录复现步骤并创建修复任务

**Verification**:
- [ ] 手动测试文档已创建并填写结果
- [ ] 无 P0/P1 阻塞问题

**Dependencies**: Checkpoint 2
**Files likely touched**:
- `docs/manual-testing-memory.md`（新建）
**Estimated scope**: M（6 组 E2E 场景，时间主要花在环境准备和观察上）

---

### Phase 4: 性能与 Token 预算验证

#### Task 5: 性能与 Token 预算确认

**Description**: 验证 SPEC 约束条件是否在实际运行中满足。

**Scope**:
- **查询耗时**：在 `context-builder.ts` 或 `pi-agent.ts` 中添加 `console.time/timeEnd` 或日志，记录 `buildMemoryContext` + `getRecentMessages` 总耗时，确认 ≤ 200ms
- **Token 预算估算**：
  - 日常轮次（≥ 第 4 轮）：System Prompt（长期，~500 tokens）+ 回话历史（10 条 × ~80 tokens）≈ 1300 tokens
  - 会话初期（前 3 轮）：额外叠加 当天记忆（~200）+ 短期记忆（~200）+ 中短期记忆（~200-400）≈ 2100 tokens，上限 2500
  - 为 AI 回复保留 ≥ 1000 tokens
- 若实测超出预算，在 `context-builder.ts` 中增加硬截断（如 `midTerm` 超过 400 tokens 时裁剪）

**Acceptance criteria**:
- [ ] 记忆查询 + 上下文构建平均耗时 ≤ 200ms（本地测试，允许网络波动）
- [ ] 注入文本总量估算在 SPEC 限制内
- [ ] 如有超支，已添加截断保护

**Verification**:
- [ ] 查看日志/手动计时，确认耗时合规
- [ ] 人工估算或采样检查 prompt 长度

**Dependencies**: Task 4（可在 Task 4 同时收集性能数据）
**Files likely touched**:
- `apps/gateway/src/memory/context-builder.ts`
- `apps/gateway/src/agent/pi-agent.ts`
**Estimated scope**: S（2 个文件，添加日志或截断逻辑）

---

### Checkpoint 3: 分层记忆系统 MVP Complete
- [ ] 所有手动验证场景通过
- [ ] 性能指标达标（或已记录基线）
- [ ] Token 预算在控制范围内
- [ ] 代码已提交，测试全绿
- [ ] 准备进入 Phase 3: Voice Pipeline

---

## 下一阶段预览（Phase 3: Voice Pipeline）

分层记忆系统完成后，下一个技术里程碑是：

| 任务 | 描述 |
|------|------|
| **P3.3** | Sentence-Level Streaming Pipeline —  sentence 级流式 TTS，降低首句延迟 |
| **P3.4** | VAD Silence Detection — 真正的语音活动检测，替代当前 WebSocket 30s 静默计时 |
| **P3.5** | Avatar State Synchronization — 前端虚拟形象状态与后端 phase 精确同步 |

> 注：P3.1（ASR 接入）和 P3.2（TTS 接入）若已完成，可直接进入 P3.3。

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `session-memory.ts` 删除后发现其他文件隐式依赖 | Med | 删除前全局 grep 确认；build + test 双重验证 |
| 手动 E2E 验证依赖本地环境（PostgreSQL + Qdrant） | Med | 使用 `docker-compose.yml` 一键启动；或直接在已配置好的 dev 环境测试 |
| Token 预算实测超出预期 | Med | 在 `context-builder.ts` 预留截断逻辑，超限即裁剪 |
| 性能测试因本地 Qdrant 延迟失真 | Low | 以多次采样平均值为准；生产环境使用独立 Qdrant 实例 |

## Open Questions

1. **`session-memory.ts` 是否保留作为备用方案？** 建议删除，功能已由 `getRecentMessages` 完全覆盖，保留会增加维护负担。
2. **是否需要在 `pi-agent.ts` 中实现 Tool-Calling Loop？** SPEC 项目结构中提到"工具调用循环"，但 Feature 描述明确采用 Context Injection。当前 `memory_recall` / `memory_context` 工具已注册但未在 `processMessage` 中自动调用。如后续需要 LLM 主动决策调用时机，可单独开任务实现，不阻塞本阶段收尾。
3. **性能日志是否长期保留？** 建议以 `debug` 级别日志保留，便于生产环境排查。
