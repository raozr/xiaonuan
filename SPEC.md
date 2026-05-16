# Spec: PC 端子女端（child-pc）

## Objective

为「小暖」AI 老人陪伴平台开发 PC 端子女端口，替代微信小程序审核等待期，让子女用户通过浏览器即可管理老人信息、查看陪伴动态、发送家庭动态、配置 AI 音色等。

**目标用户：** 老人子女（家庭管理者）
**成功标准：**
- 子女可通过手机号+密码注册/登录
- 完整复刻微信小程序子女端所有功能（见下方页面清单）
- 复用现有 gateway 业务 API，仅需新增 2 个 PC 认证接口
- 在新分支 `feat/pc-child-client` 下开发，不污染现有小程序代码

## Tech Stack

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS + shadcn/ui（或同类组件库） |
| 状态管理 | React Context + hooks（无需 Redux/Zustand，复杂度可控） |
| HTTP 客户端 | fetch（原生） |
| 构建输出 | Static Export (`output: 'export'`) |

## Commands

```bash
# 开发
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm type-check

# 代码检查
pnpm lint
```

## Project Structure

```
apps/child-pc/                 → PC 端子女端（新增应用）
  src/
    app/                       → Next.js App Router
      (auth)/                  → 登录/注册相关（无侧边栏布局）
        login/page.tsx
        register/page.tsx
      (dashboard)/             → 主界面（带侧边栏/导航布局）
        layout.tsx
        page.tsx               → 首页：我的老人（child-home）
        elders/
          [id]/page.tsx        → 老人详情（child-elder-detail）
          add/page.tsx         → 添加老人（child-add-elder）
        settings/page.tsx      → 设置（child-settings）
        feed/page.tsx          → 告诉小暖一件事（child-feed）
        voice-clone/page.tsx   → 声音复刻（child-voice-clone）
    components/                → 共享组件
      ui/                      → 基础 UI 组件（Button, Input, Card 等）
      layout/                  → 布局组件（Sidebar, Header, BottomNav 等）
      elder-card.tsx
      invite-code-card.tsx
    hooks/                     → 自定义 hooks
      use-auth.ts
      use-api.ts
    lib/
      api.ts                   → API 请求封装
      auth.ts                  → token 存取
      utils.ts                 → 通用工具
  public/
  package.json
  next.config.js
  tsconfig.json
  tailwind.config.ts
```

## Code Style

**命名规范：**
- 文件/目录：kebab-case（`child-home.tsx`）
- 组件：PascalCase（`ElderCard`）
- hooks：camelCase 前缀 `use`（`useAuth`）
- API 函数：camelCase（`fetchFamilies`）

**示例（API 请求封装）：**

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const fetchFamilies = () => request('/family');
```

**UI 组件示例：**

```typescript
// components/ui/button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, children, ...props }: ButtonProps) {
  const base = 'px-4 py-2 rounded-lg font-medium transition-colors';
  const styles = {
    primary: 'bg-orange-500 text-white hover:bg-orange-600',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };
  return (
    <button className={`${base} ${styles[variant]} disabled:opacity-50`} disabled={loading} {...props}>
      {loading ? '加载中...' : children}
    </button>
  );
}
```

## Testing Strategy

- **框架：** Vitest（与 monorepo 保持一致）
- **测试位置：** `apps/child-pc/src/**/*.test.ts`
- **测试级别：**
  - 单元测试：hooks（`useAuth`, `useApi`）和工具函数
  - 组件测试：关键交互组件（表单验证、按钮状态）
- **覆盖率目标：** 核心 hooks 和 API 层达到 70%+
- **不测试：** UI 快照、页面级 E2E（时间成本过高，以人工走查为主）

## Boundaries

**Always：**
- 调用 API 时统一通过 `lib/api.ts`，不直接写裸 `fetch`
- 登录态统一读取 `localStorage` 中的 `token`，并在 API 层自动注入 `Authorization` header
- 表单提交前做前端校验（手机号格式、必填项）
- 提交代码前运行 `pnpm lint` 和 `pnpm type-check`

**Ask first：**
- 修改 `packages/prisma` schema（如给 User 表新增 `password` 字段）
- 修改 `apps/gateway` 现有业务接口（建议只新增，不改旧逻辑）
- 引入新的 npm 依赖（尤其是 UI 组件库选择）
- 变更 PC 端的部署方式或输出目录

**Never：**
- 修改 `apps/mini-program/` 或 `apps/elder-app/` 的现有代码
- 在 PC 端代码中硬编码小程序特有的 API（如 `wx.login`）
- 提交测试账号密码或本地配置到仓库
- 将 `node_modules` 或构建产物提交到 git

## Success Criteria

1. **登录注册：** 子女可通过手机号+密码完成注册和登录，登录后获取与小程序格式兼容的 JWT token
2. **首页：** 展示「我的老人」列表，包含老人姓名、在线状态、最后活跃时间；支持点击进入详情和添加老人
3. **老人详情：** 展示今日总结（情绪、时长、高光时刻）、邀请码（可复制/刷新）、快捷入口到「告诉小暖一件事」
4. **添加老人：** 输入老人姓名，调用 API 创建新家庭
5. **家庭动态：** 支持文字和语音两种方式发送消息给 AI，展示历史记录列表
6. **设置：** 可编辑子女信息（姓名、关系、备注）和老人信息（姓名、年龄、方言、爱好、健康注意事项、回避话题、问候偏好），管理邀请码
7. **声音复刻：** 支持录制/上传语音样本、创建复刻音色、查看已复刻音色列表、激活指定音色
8. **样式：** PC 端界面适配桌面屏幕，布局合理，不直接照搬小程序竖屏布局
9. **复用验证：** 所有业务功能均通过现有 gateway API 实现，不重复造轮子

## Decisions

| 决策项 | 确定方案 |
|---|---|
| 后端认证接口 | 在 `packages/prisma` schema 中给 `User` 表新增 nullable `password` 字段；在 `apps/gateway` 新增 `POST /api/pc-auth/register` 和 `POST /api/pc-auth/login` |
| UI 组件库 | `shadcn/ui`（基于 Tailwind + Radix UI，可拷贝组件源码） |
| 语音录制 | 浏览器原生 `MediaRecorder` API |
