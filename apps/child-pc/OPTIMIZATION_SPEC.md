# PC 子女端交互优化 Spec

## 现状问题

### 问题 1：功能优先于对象的导航逻辑
当前 Sidebar 是功能维度（我的老人 / 告诉小暖 / 声音复刻 / 设置）。用户先选功能，再在页面里选老人。这不符合真实心智模型——子女通常是"想为某位老人做某事"，而不是"想用某个功能，再看对谁用"。

### 问题 2：每页重复的老人选择器
`告诉小暖` 和 `声音复刻` 页面顶部都有一排老人选择按钮。这导致：
- 每次进入页面都要重新确认操作对象
- 选择器样式简陋（一排 Button），老人多时会换行或溢出
- 页面之间切换时，选择状态不共享

### 问题 3：设置页垂直堆叠
设置页把所有老人的信息用 Collapsible 纵向堆叠。老人超过 2 个时，页面极长，表单重复，视觉噪音大，难以快速定位。

---

## 优化目标

1. **全局上下文感知的老人选择**：一次选择，全站生效，各页不再重复造轮子。
2. **设置页按当前老人单态展示**：告别纵向堆叠，只看当前要管理的老人。
3. **保留功能入口的可发现性**：Sidebar 功能导航不变，降低学习成本。
4. **我的老人页承担"切换工作台"职责**：从列表进入某位老人的上下文。

---

## 优化方案

### 1. 全局 Current Family Context

新增 `CurrentFamilyProvider`，存储 `currentFamilyId`。

- 初始化顺序：URL query (`?familyId=xxx`) → localStorage → 用户第一个 family。
- 切换老人时同步到 localStorage。
- 提供 `useCurrentFamily()` hook，所有页面消费。

```typescript
// hooks/use-current-family.ts
export function useCurrentFamily() {
  const { currentFamilyId, setCurrentFamilyId } = useContext(CurrentFamilyContext);
  const { families } = useFamilies(); // 全局缓存的 family 列表
  const currentFamily = families.find(f => f.id === currentFamilyId) || families[0] || null;
  return { currentFamily, currentFamilyId, setCurrentFamilyId, families };
}
```

### 2. Header 老人切换器

在 `Header` 右侧、用户头像左侧增加一个老人切换 Dropdown。

- 常态显示当前老人名字 + Badge（在线/离线状态）。
- Dropdown 内列出全部老人，hover/click 切换。
- 底部常驻入口：「管理老人」→ 跳转 `/`。

这样用户在任何页面都能一眼看到"当前在为谁操作"，并随时切换。

**视觉示意：**

```
[小暖 Logo]          [张爷爷 ▼]   [测试用户 ▼]
                     在线状态      个人菜单
```

### 3. 告诉小暖 / 声音复刻 页改造

**删除页内的老人选择器。**

页面逻辑变为：

- 有 `currentFamily` → 正常展示功能（输入框 / 录音按钮 / 历史记录）。
- 无 `currentFamily`（用户尚未添加老人）→ 展示空状态：「您还没有关联老人，去添加」。

**告诉小暖页额外优化：**
- 历史记录按时间分组（今天 / 昨天 / 更早）。
- 发送成功后，输入框自动聚焦，减少二次操作成本。

### 4. 设置页改造

从「所有老人纵向堆叠」改为 **Tab 分栏 + 单老人展示**。

**顶部一级 Tab：**
- `我的账号`：子女姓名、手机号（只读）、修改密码（后续）。
- `老人信息`：仅展示 **currentFamily** 对应的老人表单 + 绑定码。

**老人信息区域：**
- 表单字段不变，但只渲染一个老人。
- 表单顶部增加一行面包屑 / 标识：「当前设置：张爷爷」，并附带一个小的切换按钮，点击后弹出老人选择浮层（与 Header 切换器共享组件）。

这样设置页永远只呈现一份表单，清爽且聚焦。

### 5. 我的老人页（首页）增强

首页不仅是列表，也是**进入老人工作台的入口**。

- 点击老人卡片 → **设置 currentFamilyId 为该老人** → 跳转到 `/elders/[id]` 详情页。
- 卡片 hover 态更明显，增加「进入」暗示（ChevronRight 保留）。
- 空状态不变。

### 6. 新增老人详情页 `/elders/[id]`

作为某位老人的"工作台"，聚合该老人相关的所有信息。

**页面结构：**
- **顶部摘要栏**：老人姓名、年龄、方言、在线状态、最后活跃时间、绑定码快捷复制。
- **二级 Tab 导航**：
  - `今日总结`：展示当天的 mood、duration、highlights、concerns。
  - `家庭动态`：该老人的 feed 历史（复用现有 Feed 组件，只是数据源固定）。
  - `声音复刻`：该老人的音色列表与录制入口（复用现有 VoiceClone 组件）。
  - `老人设置`：该老人的资料编辑（复用现有 ElderForm）。

**与 Sidebar 的关系：**
- Sidebar 的「告诉小暖」「声音复刻」保留，作为**快捷入口**。
- 点击时，若已存在 `currentFamily`，直接进入该功能的页面（自动带上下文）。
- 若未设置 `currentFamily`，提示先选择老人。

---

## 数据流变化

### 改造前
```
用户 → Sidebar → /feed
                → 页面内选老人 → fetchFeeds(familyId)
                → /voice-clone
                → 页面内选老人 → fetchVoiceClones(familyId)
                → /settings
                → 渲染所有老人表单
```

### 改造后
```
用户 → / (我的老人)
                → 点击卡片 → setCurrentFamily(id) → /elders/[id]
                                         ↓
                Header 切换器 ←─────────┘
                                         ↓
                /feed, /voice-clone, /settings 自动读取 currentFamily
```

---

## 组件复用与新增

| 组件 | 动作 | 说明 |
|------|------|------|
| `CurrentFamilyProvider` | 新增 | 全局 Context，包裹 layout |
| `FamilySwitcher` | 新增 | Header 上的老人下拉切换器 |
| `useCurrentFamily` | 新增 | hook |
| `FeedPage` | 修改 | 删除内联选择器，消费 context |
| `VoiceClonePage` | 修改 | 删除内联选择器，消费 context |
| `SettingsPage` | 修改 | 改为 Tab 分栏 + 单老人 |
| `ElderDetailPage` | 新增 | `/elders/[id]` 工作台 |
| `HomePage` | 修改 | 点击卡片设置 context 并跳转 |
| `Header` | 修改 | 插入 FamilySwitcher |
| `Sidebar` | 修改 | 底部「添加老人」可保留或移到首页 |

---

## 边界情况

- **只有一个老人**：Header 切换器仍可点击，但 Dropdown 里只有一项，不影响功能。
- **零个老人**：Header 切换器显示「未添加老人」，Dropdown 仅显示「管理老人」入口。所有功能页展示空状态引导。
- **直接 URL 访问 /feed?familyId=xxx**：Feed 页读取 query param 并同步到 context（一次性的），之后以 context 为准。
- **浏览器刷新**：从 localStorage 恢复 `currentFamilyId`，若该老人已被删除，则回退到第一个老人。

---

## 实施顺序建议

按依赖顺序增量实现，每步可独立验证：

1. **全局 Context + Hook**（无 UI 变化，仅为后续铺路）
2. **Header FamilySwitcher**（用户立刻能感知"当前老人"概念）
3. **改造 Feed / VoiceClone**（删除选择器，接入 context）
4. **改造 Settings**（Tab 分栏 + 单老人）
5. **新建 ElderDetailPage**（可选，作为体验增强；不阻塞前面步骤）
6. **改造 HomePage**（点击卡片设置 context 并跳转详情页）

---

## 成功标准

- [ ] 告诉小暖、声音复刻页面不再出现老人选择按钮组
- [ ] 设置页不再纵向堆叠多个老人表单
- [ ] Header 上始终可见当前操作对象（老人名字）
- [ ] 切换老人后，Feed / VoiceClone / Settings 自动跟随，无需重新选择
- [ ] 从「我的老人」点击卡片可进入该老人的详情工作台
