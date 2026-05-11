# SPEC: 记忆系统优化 v3.0（P0+P1）

*Spec Version: 3.0*
*Base Spec: SPEC.md v2.0*
*Last Updated: 2026-05-11*
*Scope: 性能、召回质量、记忆固化、鲁棒性、主动性优化*

---

## 1. Objective

**目标**：在 SPEC v2.0 分层记忆系统的基础上，针对实际运行中暴露的 6 个高优先级问题（P0+P1）进行优化，提升对话的流畅度、召回准确度和个性化体验，同时保持改动范围可控，不引入新的外部服务。

**目标用户**：
- **主要受益用户**：老人（Elder）。减少记忆重复引用、提升跨零点时的日期准确性、在冷启动时感受到更温暖的主动问候。
- **间接用户**：子女（Child）。FamilyFeed 分类更准确，长期静态信息与动态记忆的衔接更自然。

**成功标准**：
- 记忆查询总耗时从串行累加降至并发取最大值（目标 ≤ 100ms）。
- 中短期记忆召回不再依赖硬编码正则，漏召率显著下降。
- 同一天内 Daily Memory 与向量召回结果去重，prompt 中不再出现重复内容。
- Checkpoint 中的 keyFact 分类从关键词匹配升级为 LLM 语义分类，准确率提升。
- 跨零点聊天时，"今天"和"昨天"的判断以老人所在时区为准，不再错乱。
- 老人超过 3 天未聊天，再次进入时 AI 能从 short-term memory 中提取未尽话题主动破冰。

---

## 2. Core Features & Acceptance Criteria

### Feature 1: 并发查询（性能 P0）

**描述**：将 `context-builder.ts` 中串行的记忆层查询改为并发执行，降低查询延迟。

**实现要求**：
- 改造 `buildMemoryContext`：
  - 当 `turnCount <= 3` 时，使用 `Promise.all` 并发执行 `getDailyMemory` 和 `getShortTermMemory`。
  - `getMidTermMemory` 的触发判断（`shouldTrigger`）较轻量，仍可在并发组之前或之后执行，但确保整体路径中的 IO 操作尽可能并发。
- 保持现有接口签名不变，各层记忆函数仍返回 `Promise<string>`。
- 并发失败处理：任一查询失败不应阻塞其他查询，失败层返回空字符串并记录 `console.error`。

**AC**：
- [ ] `buildMemoryContext` 在前 3 轮对话中，daily 和 shortTerm 查询是并发执行的（可通过测试 mock 的调用时序验证）。
- [ ] 任一记忆层查询抛异常时，其他层的正常结果仍能正确拼接。
- [ ] 单元测试验证：mock `getDailyMemory` 延迟 50ms、`getShortTermMemory` 延迟 60ms，总耗时 ≤ 70ms（而非 110ms）。

---

### Feature 2: 时区感知的时间窗口（鲁棒性 P0）

**描述**：`daily-memory.ts` 和 `short-term-memory.ts` 中基于服务器本地时间的日期计算，改为以老人所在时区为准。

**实现要求**：
- 在 `ElderProfile` 表中新增 `timezone` 字段（`String?`，默认 `'Asia/Shanghai'`）。
  - Prisma schema 变更：`ElderProfile.timezone String? @map("timezone")`
  - 生成并执行 migration。
- 新建 `apps/gateway/src/utils/timezone.ts`：
  - `getElderTimezone(familyId: string): Promise<string>`：查询 `ElderProfile.timezone`，未设置时返回 `'Asia/Shanghai'`。
  - `getStartOfDay(date: Date, timezone: string): Date`：返回指定时区当天的 00:00:00（UTC）。
  - `getEndOfDay(date: Date, timezone: string): Date`：返回指定时区当天的 23:59:59.999（UTC）。
- 改造 `daily-memory.ts` 和 `short-term-memory.ts`：
  - 查询前通过 `getElderTimezone(familyId)` 获取时区。
  - 使用 `getStartOfDay` / `getEndOfDay` 替换现有的 `new Date(now.getFullYear(), ...)` 本地时间逻辑。
- 依赖：引入 `date-fns-tz`（轻量，已广泛用于时区处理），或直接用原生 `Intl.DateTimeFormat` + 手动计算。推荐 `date-fns-tz` 的 `fromZonedTime` / `toZonedTime` 以保持可读性。

**AC**：
- [ ] 当服务器时区为 UTC，老人时区为 `Asia/Shanghai`（UTC+8），在 UTC 前一天 16:00（即北京时间当天 00:00）发起对话时，`getDailyMemory` 能正确查到北京时间"当天"的 session。
- [ ] `getShortTermMemory` 的"最近 3 天"同样以老人时区为准，跨零点逻辑正确。
- [ ] 测试验证：mock `ElderProfile.timezone` 为 `America/New_York`，验证日期边界计算正确。

---

### Feature 3: LLM 语义分类替代关键词匹配（记忆固化 P0）

**描述**：`checkpoint-service.ts` 中的 `classifyKeyFact` 使用硬编码关键词匹配，误分类率高。改为在 LLM 生成 checkpoint 时直接返回带 category 的 JSON。

**实现要求**：
- 改造 `checkpoint-service.ts` 的 prompt：
  ```
  请根据以下对话记录生成 checkpoint 摘要，JSON 格式：
  {
    "topicSummary": "30字以内",
    "keyFacts": [
      {"fact": "关键事实1", "category": "PREFERENCE|HEALTH|PERSON|PLACE|EVENT"},
      {"fact": "关键事实2", "category": "..."}
    ],
    "moodSnapshot": "20字以内",
    "nextTopicHint": "可选"
  }
  ```
- 更新 `checkpointData` 类型，使 `keyFacts` 从 `string[]` 变为 `{ fact: string; category: FeedCategory }[]`。
- 在写入 `Checkpoint` 表前，将 `keyFacts` 转换为纯字符串数组（保持 schema 兼容，仅提取 `.fact`）。
- 在写入 `FamilyFeed` 时，直接使用 LLM 返回的 `category`，删除旧的 `classifyKeyFact` 函数及所有关键词常量（`HEALTH_KEYWORDS`、`PREFERENCE_KEYWORDS` 等）。
- LLM 返回非法 category 时，fallback 为 `'EVENT'`。

**AC**：
- [ ] mock LLM 返回带 category 的 JSON，验证 `FamilyFeed` 写入时 category 与 LLM 返回一致。
- [ ] 当 LLM 返回的 category 不在 `FeedCategory` enum 中时，自动 fallback 为 `EVENT`。
- [ ] 旧的 `classifyKeyFact` 函数及关键词常量已从代码中删除。
- [ ] 测试验证：mock LLM 返回 `"category": "PREFERENCE"`，验证 `prisma.familyFeed.create` 被调用且 `category: 'PREFERENCE'`。

---

### Feature 4: GREETING 阶段主动引导（主动性 P0）

**描述**：当老人超过 N 天未聊天（如 3 天），AI 在 GREETING 阶段主动从 Short-term Memory 中提取一个 `nextTopicHint` 来破冰。

**实现要求**：
- 新建 `apps/gateway/src/memory/greeting-hint.ts`：
  - `getGreetingHint(familyId: string, lastSessionAt?: Date): Promise<string>`：
    - 若 `lastSessionAt` 存在且距离现在 ≤ 3 天，返回空字符串（正常问候，不强行破冰）。
    - 若超过 3 天或无历史 session：
      - 查询该家庭最近 1 个有 `nextTopicHint` 的 `Checkpoint`（按 `createdAt` desc，取 1 条）。
      - 若找到，返回格式化文本（如 `"上次您提到想聊聊孙子的事，今天咱们接着说？"`）。
      - 若未找到，返回空字符串。
- 改造 `context-builder.ts`：
  - 新增可选参数 `phase?: SessionPhase` 和 `lastSessionAt?: Date`。
  - 当 `phase === 'GREETING'` 时，调用 `getGreetingHint`，将结果作为独立区块插入（如 `【未尽话题】...`），放在当天/短期记忆之后。
- 改造 `pi-agent.ts` 或调用方：在构造 GREETING 阶段的上下文时，传入 `phase` 和 `lastSessionAt`。
- 保持现有 System Prompt 中的问候风格，`【未尽话题】`仅作为可选补充，不强制 AI 必须引用。

**AC**：
- [ ] 老人 3 天内有过 session，GREETING 阶段不注入 `【未尽话题】`。
- [ ] 老人超过 3 天未聊天，且最近 checkpoint 有 `nextTopicHint`，GREETING 阶段注入该提示。
- [ ] 老人超过 3 天未聊天，但无 `nextTopicHint`，GREETING 阶段正常问候，不产生空区块。
- [ ] 测试验证：mock checkpoint 数据，验证 `getGreetingHint` 的返回逻辑。

---

### Feature 5: 语义触发器替代硬编码正则（召回质量 P1）

**描述**：`mid-term-memory.ts` 的 `shouldTrigger` 使用硬编码正则匹配实体词，漏召率高且难以维护。改为基于输入长度 + 轻量级语义判断。

**实现要求**：
- 保留长度判断：`input.length >= 10` 时直接触发（作为保底策略）。
- 替换正则：删除 `ENTITY_PATTERN` 常量。
- 引入轻量级语义判断：
  - **方案 A（推荐，成本低）**：维护一个动态实体词表（从 `FamilyFeed` 中已知的 `PERSON`、`PLACE` 等实体词提取），`shouldTrigger` 检查输入是否包含该家庭词表中的词。
  - **方案 B（备选）**：调用一次轻量 LLM（或本地小模型）判断 `"是否需要检索历史记忆"`，返回 yes/no。但会增加一次 LLM 调用，延迟和成本上升。
  - **本 SPEC 采用方案 A**：
    - 新建 `apps/gateway/src/memory/entity-vocabulary.ts`：
      - `getFamilyEntities(familyId: string): Promise<Set<string>>`：从 `FamilyFeed` 中提取该家庭的高频实体词（`category` 为 `PERSON` 或 `PLACE` 的 `content` 分词后提取关键词），缓存于内存（简单 LRU，5 分钟 TTL，无需 Redis）。
    - `shouldTrigger(input, familyId)`：若输入包含该家庭词表中的任意词，返回 true。
- 词表更新：无需实时，checkpoint 生成后新写入的 FamilyFeed 会在最多 5 分钟后被纳入词表。

**AC**：
- [ ] 输入 "李阿姨今天来家里了"，若 "李阿姨" 在词表中，`shouldTrigger` 返回 true。
- [ ] 输入 "嗯"、"好的"，无论词表如何，`shouldTrigger` 返回 false。
- [ ] 新家庭（无历史 FamilyFeed）时，词表为空，仅依赖长度判断（`>= 10` 触发）。
- [ ] 测试验证：mock `FamilyFeed` 数据，验证 `shouldTrigger` 对词表命中/未命中的判断正确。

---

### Feature 6: 跨层去重逻辑（召回质量 P1）

**描述**：`Daily Memory` 和 `Mid-term Memory` 可能召回重复内容（如当天上午的"膝盖疼"在今日回顾中，下午提到"膝盖"又从向量库召回）。在 `context-builder.ts` 中对各层返回的文本进行相似度过滤。

**实现要求**：
- 新建 `apps/gateway/src/memory/dedup.ts`：
  - `deduplicateLines(lines: string[], threshold?: number): string[]`：
    - 对输入的文本列表（每条以 `"- "` 开头的 bullet point），使用简单字符级相似度算法（如最长公共子串比例，或编辑距离比例）。
    - 若两条文本的相似度 ≥ `threshold`（默认 0.6），保留较长的那条，丢弃较短的。
    - 保持原有顺序。
- 改造 `context-builder.ts`：
  - 在拼接完 `sections` 后、返回前，将所有 bullet point 展平为一维数组，调用 `deduplicateLines`。
  - 去重后按原有区块标题重新分组（若某区块的去重后内容为空，则省略该区块）。
- 性能约束：去重算法必须是同步的、O(n²) 以内（因为 bullet point 总量通常 < 20 条），总耗时 < 1ms。
- 不引入外部 NLP 库（如 `@nlpjs/similarity` 等），使用纯字符串操作即可。

**AC**：
- [ ] 输入 `["- 您提到最近膝盖不太舒服", "- 关于您的膝盖：建议避免久坐"]`，两条相似度低于阈值，均保留。
- [ ] 输入 `["- 您提到最近膝盖不太舒服", "- 您提到膝盖不太舒服"]`，相似度高于阈值，保留较长的一条。
- [ ] 去重后若【今日回顾】区块内容为空，该区块标题不出现。
- [ ] 测试验证：构造多组重复/不重复文本，验证 `deduplicateLines` 输出符合预期。

---

## 3. Tech Stack & Constraints

**技术栈**（复用现有，本次仅新增时区库）：
- 网关：Node.js + Fastify + TypeScript
- 数据库：PostgreSQL + Prisma
- 向量库：Qdrant（无变更）
- AI：DashScope (Qwen-Plus) HTTP API（仅修改 prompt）
- 时区处理：`date-fns-tz`（新增依赖，轻量）

**约束**：
- 所有记忆查询 + 上下文注入总耗时 ≤ 200ms（并发查询后应有显著余量）。
- 注入 LLM 的文本总量控制不变（SPEC v2.0 约束）：
  - 日常轮次 ≤ 1300 tokens。
  - 会话初期 ≤ 2500 tokens。
- 不引入 Redis、不引入新的 LLM 服务、不扩展 Checkpoint/FamilyFeed 的语义模型（提醒层级暂缓）。
- Prisma schema 仅允许新增 `ElderProfile.timezone` 一个字段。
- 所有数据操作严格按 `familyId` 隔离。

---

## 4. Project Structure

```
# [新建] 时区工具
apps/gateway/src/utils/
  └── timezone.ts                 # getElderTimezone, getStartOfDay, getEndOfDay

# [新建] 主动引导
apps/gateway/src/memory/
  └── greeting-hint.ts            # getGreetingHint

# [新建] 动态实体词表
apps/gateway/src/memory/
  └── entity-vocabulary.ts        # getFamilyEntities, 内存 LRU 缓存

# [新建] 去重工具
apps/gateway/src/memory/
  └── dedup.ts                    # deduplicateLines

# [改造] 核心记忆模块
apps/gateway/src/memory/
  ├── context-builder.ts          # 并发查询、去重、GREETING hint 注入
  ├── daily-memory.ts             # 时区感知
  ├── short-term-memory.ts        # 时区感知
  ├── mid-term-memory.ts          # 语义触发器替换正则
  └── checkpoint-service.ts       # LLM 语义分类，删除 classifyKeyFact

# [改造] Prisma Schema
packages/prisma/prisma/schema.prisma   # ElderProfile 新增 timezone 字段

# [改造] 调用方
apps/gateway/src/agent/pi-agent.ts     # 传入 phase / lastSessionAt

# [新建/改造] 测试
apps/gateway/src/memory/memory.test.ts        # 新增并发、去重、触发器测试
apps/gateway/src/utils/timezone.test.ts       # 时区边界测试
apps/gateway/src/memory/checkpoint-service.test.ts  # LLM 分类测试
```

---

## 5. Code Style & Conventions

- **TypeScript**：严格模式开启，所有新增函数必须有返回类型注解。
- **并发错误处理**：`Promise.allSettled` 优于 `Promise.all`，确保单点失败不拖垮整体上下文构建。
- **时区处理**：所有日期边界计算必须通过 `timezone.ts` 的统一入口，禁止在业务代码中直接 `new Date(...)` 构造当天零点。
- **字符串相似度**：`dedup.ts` 中的算法必须是纯函数、无副作用、同步执行，阈值可配置但默认 0.6。
- **内存缓存**：`entity-vocabulary.ts` 的 LRU 缓存使用 `Map` 实现即可（key: `familyId`，value: `{ entities: Set<string>; expiresAt: number }`），无需引入 `lru-cache` 库。
- **Prompt 变更**：`checkpoint-service.ts` 的 prompt 修改后，需在实际 LLM 上跑 3-5 条样本验证 JSON 输出稳定，再合入主干。

---

## 6. Testing Strategy

### Backend Tests

- `timezone.test.ts`（新建）：
  - mock `ElderProfile.timezone` 为 `Asia/Shanghai`、`America/New_York`、`UTC`，验证 `getStartOfDay` / `getEndOfDay` 返回的 UTC 时间正确。
  - 验证无 timezone 记录时 fallback 为 `Asia/Shanghai`。
- `memory.test.ts`（新增用例）：
  - 并发查询：mock `getDailyMemory` 和 `getShortTermMemory` 各延迟 50ms，验证 `buildMemoryContext` 总耗时 < 70ms。
  - 并发容错：mock `getDailyMemory` reject，验证 `buildMemoryContext` 仍返回 `shortTerm` + `midTerm` 的结果。
  - 去重：构造 5-8 条 bullet point（含 2 组重复），验证 `deduplicateLines` 输出正确。
  - 触发器：mock `FamilyFeed` 含 "李阿姨"、"公园"，验证 `"李阿姨来了"` → true，`"嗯"` → false。
  - GREETING hint：mock checkpoint 有 `nextTopicHint`，验证超过 3 天未聊时返回破冰文本；3 天内返回空字符串。
- `checkpoint-service.test.ts`（扩展）：
  - mock LLM 返回带 category 的 JSON，验证 `FamilyFeed.create` 被调用且 category 正确。
  - mock LLM 返回非法 category（如 `"HOBBY"`），验证 fallback 为 `EVENT`。
  - 验证 `classifyKeyFact` 已不存在于代码中（可通过静态检查或 mock 验证）。

### Manual Verification

- 跨零点：将服务器时区设为 UTC，ElderProfile.timezone 设为 Asia/Shanghai，在北京时间 00:30（UTC 前一天 16:30）发起对话，验证 AI 能正确引用北京时间"今天"的记忆。
- 去重：上午聊"膝盖疼"，下午再次提到"膝盖"，验证 prompt 中【今日回顾】和【相关回忆】不重复出现相同内容。
- 主动引导：制造一个 4 天前结束且有 `nextTopicHint` 的 session，再次进入小程序，验证 GREETING 阶段 AI 主动提及该话题。

---

## 7. Boundaries

### Always Do
- 所有日期边界计算必须以老人时区为准，不能依赖服务器本地时间。
- 并发查询时必须使用 `Promise.allSettled`，单点失败不拖垮整体。
- 去重后若某记忆区块内容为空，必须在 prompt 中完全省略该区块。
- LLM 语义分类返回非法 category 时，必须 fallback 为 `EVENT`。
- `entity-vocabulary.ts` 的内存缓存必须有过期机制（TTL ≤ 5 分钟），防止 FamilyFeed 更新后词表长期不一致。

### Ask First About
- 引入 Redis 做 FamilyFeed 或实体词表的持久化缓存（本次明确暂缓）。
- 引入真实 embedding 模型替换 `embedText` 伪随机向量（SPEC v2.0 已有，仍维持 Ask First）。
- 扩展 Checkpoint/FamilyFeed 数据模型以支持"关键信息标记/待办提醒层级"（本次明确暂缓）。
- 修改 LLM 底层模型（从 Qwen-Plus 切换）。

### Never Do
- 在 Prompt 中泄露其他家庭的记忆数据。
- 做同步的长时间检索（> 500ms）再回复老人。
- 硬编码"AI 必须在每轮主动引用记忆"的规则。
- 在老人端展示技术错误信息。
- 引入新的数据库或服务（Redis、ES、Mongo 等）。
- 在 `dedup.ts` 中引入重型 NLP 库或外部 API 调用。

---

## 8. Open Questions / Decisions

| 决策项 | 确定方案 | 备注 |
|---|---|---|
| 时区字段默认策略 | `ElderProfile.timezone` 新增，默认 `'Asia/Shanghai'` | 产品主要面向中国老人；未来子女端可开放修改 |
| 并发失败策略 | `Promise.allSettled`，失败层返回空字符串 | 保证可用性优先，不因为一层查询失败就丢失全部上下文 |
| 实体词表更新频率 | 内存 LRU，5 分钟 TTL | 无需 Redis，实现简单；checkpoint 生成后新实体最多 5 分钟后生效 |
| 去重相似度阈值 | 0.6，字符级最长公共子串比例 | 保守阈值，避免误删相似但不重复的内容；可微调 |
| 主动引导触发条件 | 最近 session 距今 > 3 天 | 与 short-term memory 的 3 天窗口对齐，保持逻辑一致 |
| 主动引导数据来源 | 最近 1 条有 `nextTopicHint` 的 Checkpoint | 已有数据，零新增存储成本 |
| LLM 分类 Prompt 稳定性 | 修改后在实际 LLM 上跑 3-5 条样本验证 | 确保 JSON 输出格式和 category 枚举稳定 |

---

*Spec Version: 3.0*
*Scope: 记忆系统 P0+P1 优化（不含 Redis、不含提醒层级）*
