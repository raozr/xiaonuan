# 陪伴卡片长按删除设计

## 目标

在监护端“我的陪伴”页面，为每一个具体陪伴卡片增加长按删除能力。用户长按某个陪伴框后，可以删除这个陪伴关系以及对应的陪伴分身。删除操作复用后端已有的配对删除接口。

## 当前上下文

- 监护端陪伴列表由 `apps/xiaonuan-app/app/(steward)/index.tsx` 渲染。
- 单个陪伴卡片由 `apps/xiaonuan-app/src/components/steward/PairingCard.tsx` 渲染。
- 移动端 `pairing` 服务层目前支持列表、创建、绑定、刷新配对码、详情查询。
- 网关已经提供 `DELETE /api/pairings/:pairingId`。
- 后端删除权限限制为：已认证的监护端用户，且必须是该陪伴关系的主要家庭成员。

## 推荐方案

继续使用现有 `PairingCard` 作为交互入口。普通点击保持不变，进入陪伴详情页；长按某一张具体卡片时，弹出针对该陪伴的危险操作确认提示。

流程：

1. 用户长按某一个陪伴卡片。
2. App 弹出原生确认对话框，对话框中带上该陪伴对象的名字。
3. 用户点击“删除陪伴”。
4. App 通过新增的 `deletePairing` 服务方法调用 `DELETE /api/pairings/:pairingId`。
5. 删除成功后，从当前列表中移除这一张卡片。
6. 删除失败时，展示后端或网络错误信息，并保留该卡片。

这个方案改动小、交互接近原生体验，也符合当前 Expo/React Native 项目的实现风格。

## UI 行为

- 短按：行为不变，跳转到 `/(steward)/${pairingId}`。
- 长按：只针对被长按的那张卡片弹出原生确认菜单。
- 确认文案带上陪伴对象姓名，例如：`删除 张阿姨 的陪伴？`。
- 危险操作按钮文案为 `删除陪伴`。
- 取消按钮文案为 `取消`。
- 删除请求进行中时，忽略对同一张卡片的重复删除请求。
- 如果删除的是最后一个陪伴，删除成功后显示现有空状态。

## API 与数据流

在 `apps/xiaonuan-app/src/services/pairing.ts` 中新增 `deletePairing(token, pairingId)`。

列表页负责删除状态和流程编排：

- `PairingCard` 接收一个可选的 `onLongPress` 回调。
- `PairingListScreen` 为每个 `Pairing` 传入对应的长按回调。
- 回调负责打开原生确认对话框。
- 用户确认后，调用 `deletePairing`。
- 成功后执行 `setPairings((current) => current.filter((p) => p.id !== pairing.id))`。

不需要修改后端数据模型或路由。

## 错误处理

- 缺少 token：展示通用登录/会话错误，不调用接口。
- 后端返回 403：展示后端错误信息，例如 `仅主要家庭成员可删除配对`。
- 网络或服务器错误：展示非危险错误提示，并保留该陪伴卡片。
- 陪伴对象姓名未知：确认文案中使用 `未知`，与现有卡片兜底文案保持一致。

## 测试

增加聚焦的移动端测试：

- 服务层测试：验证 `deletePairing` 会携带 token，并以 `DELETE` 方法请求 `/api/pairings/:pairingId`。
- 卡片 wiring 测试：验证 `PairingCard` 可以接收并触发 `onLongPress`。

后端现有测试已经覆盖删除接口的主要家庭成员权限和成功删除行为。

## 不在本次范围内

- 增加自定义底部弹层或新的 UI 依赖。
- 增加撤销或软删除。
- 修改后端删除语义。
- 允许非主要家庭成员删除陪伴关系。
