# SPEC: 子女个人信息 + AI 人设动态生成 + 家庭设定

## 1. Objective

**目标**：让子女（子女端）能够完善自己和老人的个人信息，系统根据这些信息动态生成 AI 陪伴助手的个性化人设（System Prompt），使小暖在对话中能准确称呼老人、使用合适的方言风格、回避敏感话题、提及家人与爱好，从而提供更温暖、更真实的陪伴体验。

**目标用户**：
- **主要用户**：子女（Child），通过小程序设置页管理家庭信息与 AI 偏好。
- **间接受益用户**：老人（Elder），感受到更个性化的 AI 对话，但**不直接操作设置页**。

**成功标准**：
- 子女可以在一个设置页内完成「自己信息 + 老人信息 + 家庭管理」的配置。
- AI 的 System Prompt 不再硬编码，而是根据家庭数据动态拼接。
- 老人端对话中，AI 能准确使用老人姓名、提及家人关系、回避禁忌话题、引用爱好。

---

## 2. Core Features & Acceptance Criteria

### Feature 1: Schema & API 扩展（Backend）

**描述**：扩展数据库模型，新增/修改个人与家庭信息字段；提供 CRUD API 供设置页调用。

**Schema 变更**：
- `ElderProfile` 新增：
  - `hobbies` String? — 爱好（如"养花、听京剧"）
  - `healthNotes` String? — 健康注意事项（如"腰不好，避免剧烈运动"）
  - `topicsToAvoid` String? — 回避话题（如"已故的老伴"）
  - `greetingPreference` String? — 喜欢的问候方式（如"称呼我老王就行"）
- `ChildProfile` 新增：
  - `relationshipToElder` String? — 与老人关系（如"女儿"、"儿子"）
  - `customNotes` String? — 子女自定义个人信息（如"我在北京工作，每两周回家一次"、"我是大学老师"等，自由填写，供 AI 在对话中引用）
- `Family` 新增（可选，预留）：
  - `aiTone` String? @default("gentle") — AI 语气偏好（gentle / lively / calm）

**API 设计**：
- `PUT /api/me` — 更新当前子女信息（`name`, `relationshipToElder`）
- `PUT /api/family/elder` — 更新老人信息（所有 ElderProfile 字段）
- `GET /api/family/settings` — 返回完整家庭设置（含子女列表、老人详情、家庭配置）
- 复用 `GET /api/family` 与 `POST /api/family/invite-code`

**AC**：
- [ ] Prisma migration 生成并成功应用，现有数据不丢失。
- [ ] `PUT /api/me` 只允许修改当前登录子女的资料，不可篡改他人。
- [ ] `PUT /api/family/elder` 只允许该家庭的子女操作，数据隔离正确。
- [ ] 所有新 endpoint 有对应的单元测试，覆盖正常流程与权限错误。

---

### Feature 2: AI 动态人设生成（AI Core）

**描述**：改造 Pi Agent 的 System Prompt 生成逻辑，从硬编码字符串改为基于家庭数据的动态拼接。

**Prompt 模板结构**：
```
你是小暖，一位温暖、耐心、贴心的老人陪伴助手。

【基本信息】
- 你要陪伴的是：{elderName}，今年 {elderAge} 岁。
- 她的 {relationshipToElder} {childName} 会经常来看她。
- 关于 {childName}：{childCustomNotes}

【交流风格】
- 用简单、亲切、口语化的中文交流，避免复杂术语。
- 每次回复控制在 3-5 句话以内，不要太长。
- {dialectInstruction}
- {toneInstruction}

【个性化记忆】
- 她喜欢：{hobbies}。
- 健康注意：{healthNotes}。
- 回避话题：{topicsToAvoid}。
- 问候偏好：{greetingPreference}。

【职责】
1. 陪伴老人聊天，倾听他们的心声
2. 语气要像家人一样温暖...
3. 如果老人提到身体不适，温和建议联系子女或医生...
```

**实现要求**：
- 新建 `apps/gateway/src/agent/prompt-builder.ts`，负责从数据库读取家庭信息并生成 prompt。
- `createPiAgent(config)` 中调用 `buildSystemPrompt(familyId)` 替代硬编码字符串。
- 若某项信息为空，则在 prompt 中省略该行，避免产生空内容。

**AC**：
- [ ] `buildSystemPrompt` 能根据 `familyId` 查询数据库并生成完整 prompt。
- [ ] prompt 中包含所有已填写字段，省略未填写字段。
- [ ] 方言字段非空时，prompt 中附加"尽量使用 {方言} 风格的表达"。
- [ ] `aiTone` 映射到不同语气描述（gentle→温柔亲切, lively→活泼热情, calm→沉稳平和）。
- [ ] agent 测试 mock 掉 LLM 调用，仅验证 prompt 字符串内容是否正确，需包含子女 `customNotes` 内容。
- [ ] 老人端真实对话中，AI 能准确称呼老人姓名并引用爱好/家人/子女背景信息。

---

### Feature 3: 子女端设置页（Frontend）

**描述**：新建设置页，让子女在一个页面内管理所有个人与家庭信息。

**页面结构**（参考 `doc/design/子女端设置页`）：
- **子女信息卡片**：
  - 头像（预留）
  - 姓名（input）
  - 与老人关系（picker：女儿/儿子/儿媳/女婿/其他）
  - 其他信息（textarea，placeholder："如我在北京工作、我是大学老师、每两周回家一次等，供 AI 在陪伴中引用"）
- **老人信息卡片**：
  - 姓名（input）
  - 年龄（picker：50-120）
  - 方言（picker：普通话/四川话/广东话/上海话/东北话/其他）
  - 爱好（textarea）
  - 健康注意事项（textarea）
  - 回避话题（textarea）
  - 问候偏好（input，placeholder："称呼我老王就行"）
- **AI 语气设置**（可选，若 Family.aiTone 实现）：
  - 单选：温柔亲切 / 活泼热情 / 沉稳平和
- **通知设置**（UI 占位，后续 Phase 7 接入）：
  - 日报推送开关
  - 异常提醒开关
- **家庭管理卡片**：
  - 邀请码展示 + 复制按钮 + 刷新按钮
  - 家庭成员列表（展示所有 ChildProfile 的 name）
- **关于**：版本号

**导航**：
- 从 `child-home` 增加「设置」入口（底部导航栏第四个 tab 或右上角图标）。
- 保存成功后 `wx.showToast({ title: '保存成功' })`。

**AC**：
- [ ] 设置页加载时正确调用 `GET /api/family/settings` 回填数据。
- [ ] 编辑后调用对应 PUT API 保存，保存成功有反馈。
- [ ] 表单校验：姓名为必填，年龄范围 50-120。
- [ ] 未填写字段允许为空，不阻塞保存。
- [ ] 视觉风格与现有设计稿（奶油色、大圆角、暖橙主色）一致。

---

### Feature 4: 家庭设定闭环（Integration）

**描述**：将家庭创建、首次引导、信息完善串联成完整流程。

**流程**：
1. 子女微信授权登录 → 自动创建家庭 + 默认老人（name="老人"）。
2. 首次进入 `child-home` → 检测到 `elderName === "老人"` → 弹出引导弹窗（已有逻辑）。
3. 点击「去完善」→ 跳转到 `child-settings`。
4. 在设置页填写老人真实姓名、年龄、方言等 → 保存。
5. 保存后返回 `child-home`，引导弹窗消失，今日状态正常展示。

**AC**：
- [ ] 首次登录的新用户，引导弹窗正确指向设置页。
- [ ] 完善信息后，弹窗不再出现。
- [ ] 邀请码刷新后，设置页显示最新邀请码。
- [ ] 家庭成员列表随子女增多而更新。

---

## 3. Tech Stack & Constraints

**技术栈**（复用现有，不改选型）：
- 网关：Node.js + Fastify + TypeScript
- 数据库：PostgreSQL + Prisma
- 前端：微信小程序（WXML/WXSS/JS）
- AI：DashScope (Qwen-Plus) HTTP API
- 向量：Qdrant（memory_recall 已接入，本 Spec 不涉及变更）

**约束**：
- 所有变更必须在现有 monorepo 结构内完成，不引入新的服务或数据库。
- AI Prompt 生成必须在 100ms 内完成（数据库查询 + 字符串拼接）。
- 设置页表单字段必须考虑老年人视觉友好（子女操作，但设计语言需统一）。
- 个人敏感信息（健康、回避话题）必须严格家庭隔离，API 中不得泄露给其他家庭。

---

## 4. Project Structure

本次变更涉及文件清单：

```
packages/prisma/prisma/schema.prisma          # Schema 扩展
packages/prisma/prisma/migrations/*           # 新增 migration

apps/gateway/src/agent/prompt-builder.ts      # [新建] Prompt 生成器
apps/gateway/src/agent/pi-agent.ts            # 改造：接入 prompt-builder
apps/gateway/src/agent/agent.test.ts          # 改造：测试 prompt 内容
apps/gateway/src/routes/me.ts                 # 改造：新增 PUT /api/me
apps/gateway/src/routes/family.ts             # 改造：新增 PUT /api/family/elder, GET /api/family/settings
apps/gateway/src/routes/family.test.ts        # 改造：补全测试

apps/mini-program/pages/child-settings/       # [新建] 设置页
  ├── child-settings.js
  ├── child-settings.wxml
  ├── child-settings.wxss
  └── child-settings.json
apps/mini-program/pages/child-home/child-home.js    # 改造：增加设置入口
apps/mini-program/pages/child-home/child-home.wxml  # 改造：增加设置入口
apps/mini-program/pages/bind-family/bind-family.js  # 改造：引导到设置页
apps/mini-program/app.json                          # 改造：注册新页面
```

---

## 5. Code Style & Conventions

- **TypeScript**：严格模式开启，所有新增函数必须有返回类型注解。
- **API 规范**：RESTful，成功返回 JSON，错误返回 `{ success: false, message: "..." }`。
- **Prisma**：字段命名使用 snake_case（`@map`），模型命名 PascalCase。
- **小程序**：Page 数据使用 `data` 声明，异步操作使用 `async/await`，网络请求统一走 `app.request`。
- **Prompt 构建**：使用模板字符串拼接，禁止在 prompt 中注入未转义的用户输入（虽然 LLM prompt injection 风险在此场景较低，但仍需保证字段内容被合理包裹）。
- **测试**：
  - 后端：Vitest，所有新 API route 必须有测试，使用 Prisma test database（已配置）。
  - 前端：Vitest + mock wx API，设置页表单交互需有测试。

---

## 6. Testing Strategy

### Backend Tests
- `family.test.ts`：
  - `PUT /api/family/elder` 更新老人信息成功
  - `PUT /api/family/elder` 非本家庭成员禁止访问（返回 403 或 404）
  - `GET /api/family/settings` 返回完整家庭配置
- `me.test.ts`：
  - `PUT /api/me` 更新子女姓名与关系
  - `PUT /api/me` 未登录返回 401
- `agent.test.ts`：
  - mock `prisma` 与 `chatCompletion`，验证 `buildSystemPrompt` 输出字符串包含老人姓名、爱好、回避话题等。
  - 验证字段为空时，prompt 中不出现该字段的占位文本。

### Frontend Tests
- `child-settings.test.ts`（新建）：
  - 页面加载时表单正确回填 `GET /api/family/settings` 数据。
  - 点击保存时正确发起 PUT 请求。
  - 表单校验失败时阻止提交并提示。

### E2E / Manual Verification
- 子女端：创建新用户 → 进入设置页 → 填写老人信息 → 保存 → 返回首页弹窗消失。
- 老人端：发起对话 → AI 回复中应出现老人姓名与爱好引用。

---

## 7. Boundaries

### Always Do
- 每次修改数据库模型后必须生成并执行 `prisma migrate dev`。
- 每个新增 API endpoint 必须伴随测试文件更新。
- AI Prompt 中涉及用户输入的部分，使用自然语言包裹（如"她喜欢：{hobbies}"），避免裸字符串注入影响 LLM 语义。

### Ask First About
- 新增非文本字段（如老人头像上传、语音问候采样）。
- 修改 AI 底层模型（从 Qwen-Plus 切换到 Claude 等）。
- 涉及微信支付、微信订阅消息等需要微信平台审核的能力。
- 跨家庭数据共享或家庭成员权限分级（如只读成员、管理员）。

### Never Do
- 在 Prompt 中泄露其他家庭的隐私信息。
- 允许子女通过 API 修改其他家庭的老人资料（必须严格校验 `familyId` 归属）。
- 在设置页展示技术错误信息给子女（统一使用友好提示，如"保存失败，请重试"）。
- 为了 MVP 范围引入新的数据库（如 MongoDB）或新的服务（如独立的用户服务）。

---

## 8. Open Questions / Decisions

| 决策项 | 建议方案 | 备注 |
|---|---|---|
| AI 语气是否让子女手动选？ | MVP 先不做手动选择，由 `age` 和 `dialect` 自动推导（老人年龄大则偏温柔）。`Family.aiTone` 字段预留但不暴露 UI。 | 减少决策负担，后续根据反馈再开手动调。 |
| 老人能否修改自己的信息？ | MVP 不允许，全部由子女代管。老人端保持极简。 | 降低老人端复杂度。 |
| 长文本字段长度限制？ | `customNotes` 数据库限制 1000 字，前端 textarea 限制 500 字；其他字段（hobbies/healthNotes/topicsToAvoid）数据库限制 500 字，前端限制 200 字。 | `customNotes` 允许更长的自由输入，但仍需控制总量防止 prompt 过长。 |

---

*Spec Version: 1.0*
*Last Updated: 2026-05-11*
