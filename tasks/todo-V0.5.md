# V0.5 Todo List: 小暖移动端统一应用

> 对应计划文件：`plan-V0.5.md`
> Spec：`docs/SPEC-V0.5.md`
> 设计稿：`docs/xiaonuanApp/`
> 优先级：P0 = 必须完成，P1 = 应该有，P2 = 可以有

---

## Phase 0: 基建（依赖安装 + 项目结构改造）

### T0.1 安装核心依赖
- [ ] `expo-router` — 文件路由
- [ ] `nativewind` + `tailwindcss` — Tailwind for RN
- [ ] `react-native-reanimated` — 动画
- [ ] `zustand` — 状态管理
- [ ] `@react-native-async-storage/async-storage` — 已有，确认版本
- [ ] `vitest` + `@testing-library/react-native` — 测试
- **Priority**: P0
- **Dependencies**: None

### T0.2 配置 NativeWind + Tailwind
- [ ] `tailwind.config.ts` — 色板/字体/间距（对齐 DESIGN.md）
- [ ] `global.css` — 导入 nativewind
- [ ] `babel.config.js` — 添加 nativewind/babel 插件
- [ ] `nativewind-env.d.ts` — 类型声明
- **Priority**: P0
- **Files**: `apps/elder-app/tailwind.config.ts`, `apps/elder-app/global.css`, `apps/elder-app/babel.config.js`, `apps/elder-app/nativewind-env.d.ts`

### T0.3 创建 Expo Router 目录结构
- [ ] `app/_layout.tsx` — 根布局（Stack + TokenStack 守卫）
- [ ] `app/index.tsx` — 入口分流（stub，Phase 7 完成实际逻辑）
- [ ] `app/(auth)/_layout.tsx` — 认证路由布局
- [ ] `app/(companionee)/_layout.tsx` — COMPANIONEE 路由布局
- [ ] `app/(steward)/_layout.tsx` — STEWARD 路由布局
- **Priority**: P0
- **Files**: `apps/elder-app/app/` 目录下所有 _layout 文件

### T0.4 更新 app.json
- [ ] `name` 从"小暖长辈端"改为"小暖"
- [ ] `slug` 更新
- **Priority**: P0
- **Files**: `apps/elder-app/app.json`

**Checkpoint 0: 基建就绪**
- [ ] `pnpm install` 无报错
- [ ] `expo start` 能启动
- [ ] `className` 在组件中可用（NativeWind 生效）

---

## Phase 1: 设计系统落地

### T1.1 主题常量
- [ ] `theme.ts` — 色板（surface/primary/secondary/error 全套）
- [ ] `theme.ts` — 圆角/间距/触摸目标常量
- [ ] `theme.ts` — 字体样式映射
- **Priority**: P0
- **Files**: `apps/elder-app/src/utils/theme.ts`

### T1.2 图标方案
- [ ] 确认使用 Lucide React Native（已有）还是 Material Symbols
- [ ] 如用 Material Symbols：安装 `react-native-vector-icons` 或导入字体
- [ ] 创建图标组件封装
- **Priority**: P0
- **Ask first**: 图标方案选择

### T1.3 吉祥物资源
- [ ] 从设计稿 HTML 中提取吉祥物 PNG 到 `assets/images/mascot.png`
- [ ] 或替换为本地可用版本
- **Priority**: P1
- **Files**: `apps/elder-app/assets/images/mascot.png`

**Checkpoint 1: 设计系统可用**
- [ ] `theme.ts` 可在组件中 import
- [ ] Tailwind 色板 class 可用（如 `bg-primary-container`）
- [ ] 图标组件可正常渲染

---

## Phase 2: COMPANIONEE 端迁移

### T2.1 绑定页（companionee_binding_screen → app/(companionee)/index.tsx）
- [ ] 6 位数字输入槽（3-3 分隔符设计）
- [ ] 12 键数字键盘（64px 触摸目标）
- [ ] 按键按压反馈 + haptic 震动
- [ ] 确认按钮（未满禁用，满格激活）
- [ ] 右上角"Switch to Caregiver side"切换按钮
- [ ] 吉祥物头像 + 脉冲指示
- [ ] 背景装饰渐变 blob
- [ ] 保留现有 `/api/pairings/bind` fetch 逻辑
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/companionee_binding_screen/`
- **Files**: `apps/elder-app/app/(companionee)/index.tsx`, `src/components/companionee/CodeInput.tsx`

### T2.2 语音主页（companionee_home_default → app/(companionee)/home.tsx）
- [ ] 顶部 AppBar：动态标题 + 历史按钮
- [ ] 标题从"Xiao Nuan"替换为 `{{stewardName}}的陪伴`（SPEC 要求）
- [ ] 大圆形吉祥物（Reanimated 呼吸动画：scale 1.0→1.05，4s 循环）
- [ ] 底部圆形语音按钮（120x120px，脉冲环动画）
- [ ] 右下角退出按钮
- [ ] **保留现有全部逻辑**：WebSocket 连接、长按录音、语音播放、状态切换、错误处理
- [ ] 用 Reanimated 3 替换 RN Animated API
- [ ] 用 NativeWind 替换 StyleSheet
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/companionee_home_default/`
- **Files**: `apps/elder-app/app/(companionee)/home.tsx`, `src/components/companionee/MascotAvatar.tsx`, `src/components/companionee/VoiceButton.tsx`

### T2.3 提取认证逻辑为 hook
- [ ] `use-auth.ts` — 从 App.tsx 抽出 token/pairingId/deviceId 管理
- [ ] Zustand `auth-store.ts` 存储认证状态
- **Priority**: P0
- **Files**: `apps/elder-app/src/hooks/use-auth.ts`, `src/store/auth-store.ts`

### T2.4 清理旧文件
- [ ] 确认 `App.tsx` 逻辑已完全迁移
- [ ] 标记 `src/screens/BindScreen.tsx`、`src/screens/HomeScreen.tsx` 为废弃
- **Priority**: P1
- **Files**: `apps/elder-app/App.tsx`, `src/screens/`

**Checkpoint 2: COMPANIONEE 端完成**
- [ ] 绑定页：输入 6 位码 → 绑定成功 → 跳转语音主页
- [ ] 语音主页：长按说话 → TTS 播放 → 脉冲/呼吸动画正常
- [ ] 与改造前功能完全一致（手动走查通过）
- [ ] 标题显示 `{{stewardName}}的陪伴`

---

## Phase 3: STEWARD 端基建（auth + store）

### T3.1 登录页（caregiver_login_screen → app/(auth)/login.tsx）
- [ ] 居中白色卡片 + 吉祥物
- [ ] 手机号输入（浮动标签 + phone 图标）
- [ ] 密码输入（浮动标签 + lock 图标 + 显示/隐藏切换）
- [ ] "Forgot Password?"链接
- [ ] 登录按钮（Pill 形 + 箭头图标）
- [ ] "Register here"链接 → 跳转注册
- [ ] "Switch back to Elderly side"链接 → 跳转 COMPANIONEE
- [ ] 装饰背景 blob
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/caregiver_login_screen_logo_sync/`
- **Files**: `apps/elder-app/app/(auth)/login.tsx`

### T3.2 注册页（caregiver_registration_screen → app/(auth)/register.tsx）
- [ ] 居中白色卡片 + 吉祥物
- [ ] Full Name 输入
- [ ] Mobile Number 输入
- [ ] Password 输入
- [ ] Confirm Password 输入
- [ ] 注册按钮（Pill 形 + hover 变色）
- [ ] "Already have an account? Login"链接
- [ ] 浮动标签动画（focus 时移动到顶部边框）
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/caregiver_registration_screen_added_password_confirm/`
- **Files**: `apps/elder-app/app/(auth)/register.tsx`

### T3.3 Zustand Store 创建
- [ ] `auth-store.ts` — token / 用户信息 / 登录状态
- [ ] `role-store.ts` — 当前角色（COMPANIONEE / STEWARD）
- [ ] AsyncStorage 持久化
- **Priority**: P0
- **Files**: `apps/elder-app/src/store/auth-store.ts`, `src/store/role-store.ts`

### T3.4 基础 UI 组件
- [ ] `ui/Input.tsx` — 浮动标签输入框（支持图标、密码切换）
- [ ] `ui/Button.tsx` — Pill 按钮（变体：primary/secondary/outline/danger）
- [ ] `ui/Card.tsx` — 白色圆角卡片（带阴影）
- **Priority**: P0
- **Files**: `apps/elder-app/src/components/ui/Input.tsx`, `ui/Button.tsx`, `ui/Card.tsx`

**Checkpoint 3: STEWARD Auth 完成**
- [ ] 注册 → 登录 → token 存储 → 自动跳转配对列表
- [ ] 角色切换（STEWARD ↔ COMPANIONEE）正常
- [ ] UI 与设计稿一致

---

## Phase 4: STEWARD 配对列表 + Settings

### T4.1 配对列表页（steward_pairing_list → app/(steward)/index.tsx）
- [ ] 顶部 AppBar：头像 + "My Steward Team" + 齿轮设置按钮
- [ ] 配对卡片列表：头像、在线状态（绿点）、活跃时间
- [ ] 空状态插画 + "Add New Pairing"按钮
- [ ] 点击卡片 → 进入配对详情页
- [ ] 齿轮 → Settings 页
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/steward_pairing_list_global_view/`
- **Files**: `apps/elder-app/app/(steward)/index.tsx`, `src/components/steward/PairingCard.tsx`

### T4.2 设置页（steward_settings_profile → app/(steward)/settings.tsx）
- [ ] 顶部 AppBar：返回箭头 + "Settings"
- [ ] 账户信息卡片：头像（首字母）、姓名、手机号、编辑按钮
- [ ] 修改密码行
- [ ] 通知开关卡片：3 个 Toggle（Daily Summaries / Abnormal Alerts / Voice Feed）
- [ ] 家庭管理卡片
- [ ] 支持 & 关于行
- [ ] 退出登录按钮（红色背景）
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/steward_settings_profile/`
- **Files**: `apps/elder-app/app/(steward)/settings.tsx`, `src/components/steward/NotificationToggle.tsx`

### T4.3 共享组件
- [ ] `shared/TopAppBar.tsx` — 顶部导航栏（支持返回、标题、右侧操作）
- [ ] `shared/BottomTabBar.tsx` — 底部 Tab 导航（概览/日志/留言/声音）
- [ ] `steward/StatusBadge.tsx` — 在线状态指示（绿点/灰点）
- **Priority**: P0
- **Files**: `apps/elder-app/src/components/shared/TopAppBar.tsx`, `shared/BottomTabBar.tsx`, `src/components/steward/StatusBadge.tsx`

**Checkpoint 4: 配对管理完成**
- [ ] 登录后 → 配对列表页显示
- [ ] 点击卡片 → 进入配对详情（空 Tab 骨架）
- [ ] 齿轮 → Settings 页可正常编辑
- [ ] UI 与设计稿一致

---

## Phase 5: STEWARD 配对详情 4 Tab

### T5.1 Tab 布局骨架
- [ ] `[pairingId]/_layout.tsx` — 底部 Tab 导航布局
- [ ] 4 个 Tab：概览 / 日志 / 留言 / 声音
- [ ] Tab 切换动画（Reanimated shared transition）
- **Priority**: P0
- **Files**: `apps/elder-app/app/(steward)/[pairingId]/_layout.tsx`

### T5.2 概览 Tab（steward_status_member_selected → index.tsx）
- [ ] 顶部 AppBar：返回 + 标题 + "Xiao Nuan"副标题 + 头像
- [ ] 配对码管理栏：code 显示 + 刷新按钮
- [ ] 状态卡片：在线状态 + 最后活跃时间
- [ ] 每日总结卡片：情绪、对话时长、话题数、高光时刻、注意事项
- [ ] 今日日志时间线（简要）
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/steward_status_member_selected/`
- **Files**: `apps/elder-app/app/(steward)/[pairingId]/index.tsx`, `src/components/steward/DailySummaryCard.tsx`

### T5.3 日志 Tab（steward_logs_member_selected → logs.tsx）
- [ ] 顶部 AppBar
- [ ] 按日期分组（Today / Yesterday 等 badge）
- [ ] 玻璃拟态日志卡片：类型图标、标题、内容、时间
- [ ] 卡片样式区分：Action Required（红色左边框）、普通（底部橙色条）
- [ ] 滚动列表
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/steward_logs_member_selected/`
- **Files**: `apps/elder-app/app/(steward)/[pairingId]/logs.tsx`, `src/components/steward/LogCard.tsx`

### T5.4 留言 Tab（steward_feed_member_selected → feed.tsx）
- [ ] 顶部 AppBar
- [ ] 垂直时间线 + 圆点标记
- [ ] Feed 卡片：日期标签、类型徽章、标题、内容、删除按钮
- [ ] "Acknowledge"按钮（带心形图标）
- [ ] 底部悬浮输入栏：加号 + 文本输入 + 麦克风 + 发送按钮
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/steward_feed_member_selected/`
- **Files**: `apps/elder-app/app/(steward)/[pairingId]/feed.tsx`, `src/components/steward/FeedItem.tsx`, `src/components/steward/FeedInput.tsx`

### T5.5 声音 Tab（steward_voice_member_selected → voice.tsx）
- [ ] 顶部 AppBar
- [ ] 介绍文案
- [ ] 分步录音卡片：
  - 已完成（绿色勾 + 重录链接）
  - 进行中（橙色数字 + 录音按钮 + 脉冲动画 + 提示语）
  - 待完成（灰色数字 + Pending）
- [ ] 垂直连接线连接步骤
- [ ] "重新开始"按钮
- **Priority**: P0
- **Design**: `docs/xiaonuanApp/steward_voice_member_selected/`
- **Files**: `apps/elder-app/app/(steward)/[pairingId]/voice.tsx`, `src/components/steward/VoiceSampleRecorder.tsx`

### T5.6 空状态插画
- [ ] `EmptyStateIllustration.tsx` — 插画 + 文案 + 行动按钮
- [ ] 用于：配对列表为空、日志为空、Feed 为空等场景
- **Priority**: P1
- **Files**: `apps/elder-app/src/components/steward/EmptyStateIllustration.tsx`

**Checkpoint 5: 配对详情完成**
- [ ] 4 个 Tab 切换正常
- [ ] 每个 Tab 内容与设计稿视觉一致
- [ ] 滚动、空状态、加载态正常
- [ ] 人工走查通过

---

## Phase 6: API 服务层封装

### T6.1 HTTP 客户端
- [ ] `services/api.ts` — fetch 封装（拦截器注入 token、错误处理、超时）
- **Priority**: P0
- **Files**: `apps/elder-app/src/services/api.ts`

### T6.2 各模块 Service
- [ ] `services/auth.ts` — 注册/登录/me 更新
- [ ] `services/pairing.ts` — 配对 CRUD/邀请码刷新
- [ ] `services/feed.ts` — Feed 发送/列表/删除
- [ ] `services/voice-clone.ts` — 声音克隆列表/创建/激活/删除
- [ ] `services/events.ts` — 事件时间线/今日事件
- **Priority**: P0
- **Files**: `apps/elder-app/src/services/*.ts`

### T6.3 Hooks 对接 Service
- [ ] `hooks/use-pairing.ts` — 配对 CRUD hook
- [ ] `hooks/use-feed.ts` — Feed 操作 hook
- [ ] `hooks/use-events.ts` — 事件列表 hook
- **Priority**: P0
- **Files**: `apps/elder-app/src/hooks/use-pairing.ts`, `hooks/use-feed.ts`, `hooks/use-events.ts`

**Checkpoint 6: API 封装完成**
- [ ] 所有页面通过 hooks → services → api 调用后端
- [ ] 无裸写 fetch（除 WebSocket 外）
- [ ] token 自动注入
- [ ] 错误统一处理

---

## Phase 7: 路由整合 + 入口分流

### T7.1 入口分流逻辑
- [ ] `app/index.tsx` — 根据 auth 状态和角色决定跳转
- [ ] 未登录/无 token → COMPANIONEE 绑定页
- [ ] 有 COMPANIONEE token → 语音主页
- [ ] 有 STEWARD token → 配对列表
- **Priority**: P0
- **Files**: `apps/elder-app/app/index.tsx`

### T7.2 COMPANIONEE 标题动态替换
- [ ] 绑定成功后获取 stewardName
- [ ] home.tsx 标题显示 `{{stewardName}}的陪伴`
- [ ] 后端绑定响应需返回 stewardName（或单独 API 获取）
- **Priority**: P0
- **Ask first**: 后端绑定响应是否已返回 stewardName
- **Files**: `apps/elder-app/app/(companionee)/home.tsx`

### T7.3 角色切换流程
- [ ] COMPANIONEE 绑定页 → "Switch to Caregiver side" → STEWARD 登录页
- [ ] STEWARD 登录页 → "Switch back to Elderly side" → COMPANIONEE 绑定页
- [ ] 配对列表 Settings → 退出登录 → 清除 token → 回到入口
- **Priority**: P0
- **Files**: 各页面导航逻辑

**Checkpoint 7: 路由整合完成**
- [ ] 首次打开 → COMPANIONEE 绑定页
- [ ] 角色切换正常
- [ ] COMPANIONEE 标题正确显示 stewardName
- [ ] 退出后回到初始状态

---

## Phase 8: 测试 + 清理

### T8.1 关键测试
- [x] `stores.test.ts` — auth-store + role-store 状态管理
- [x] `services.test.ts` — API 服务层（api/auth/pairing/feed/voice-clone/events）
- [x] `routing.test.ts` — 入口分流、角色切换、COMPANIONEE 标题、STEWARD 注册流程
- [x] `code-style.test.ts` — NativeWind 强制、无裸 fetch、主题常量、项目结构
- **Priority**: P1
- **Files**: `apps/elder-app/src/__tests__/`

### T8.2 构建验证
- [x] TypeScript 编译无错误（elder-app tsconfig）
- [ ] `pnpm android` 模拟器运行正常（需手动验证）
- [ ] 性能：首屏加载时间、Bundle 体积（需手动验证）
- **Priority**: P0

### T8.3 旧文件清理
- [x] 删除 `App.tsx`（已迁移到 Expo Router）
- [x] 删除 `src/screens/BindScreen.tsx`
- [x] 删除 `src/screens/HomeScreen.tsx`
- [ ] 删除不再使用的旧依赖（需手动检查）
- **Priority**: P1

**Checkpoint 8: 最终验证**
- [x] 测试通过（43 tests, 4 files, 0 failures）
- [x] TypeScript 编译成功
- [ ] COMPANIONEE 完整流程走通（需手动验证）
- [ ] STEWARD 完整流程走通（需手动验证）
- [x] 无裸写 StyleSheet（code-style test 强制检查）
- [x] 无裸写 fetch（code-style test 强制检查）

---

## 依赖关系总结

```
Phase 0 (基建) ──────────────────────────────────────────────────────────────┐
    │                                                                        │
Phase 1 (设计系统) ──────────────────────────────────────────────────────────┤
    │                                                                        │
Phase 2 (COMPANIONEE) ─────────────────── 可部分并行 ── Phase 3 (STEWARD Auth)
    │                                                    │                   │
    │                                              Phase 4 (配对列表)         │
    │                                                    │                   │
    │                                              Phase 5 (4 Tab 详情)      │
    │                                                    │                   │
    └────────────────────────────────────────────────────┼───────────────────┘
                                                         │
Phase 6 (API 服务层) ────────────────────────────────────┘
    │
Phase 7 (路由整合) ──────────────────────────────────────┘
    │
Phase 8 (测试清理) ──────────────────────────────────────┘
```

Phase 0→1→2 是一条主链路（COMPANIONEE 先跑通）。Phase 3→4→5 是 STEWARD 端可并行推进。Phase 6-7-8 收尾。
