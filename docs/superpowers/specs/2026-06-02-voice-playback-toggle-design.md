# AI 语音播放开关设计

## 背景

小暖老人端当前是语音优先对话体验：用户按住麦克风说话，Gateway 优先返回 `message:ai_text`，随后异步返回 `ai:audio`，移动端收到音频后自动播放。现在需要给老人端增加一个长期记住的语音播放开关，让用户可以控制 AI 回复是否自动出声。

本设计只控制 AI 回复的自动播放，不影响用户使用麦克风语音输入。

## 目标

- 用户可以在老人端对话页关闭或打开 AI 回复自动播放。
- 关闭后如果 AI 正在说话，应立即停止播放。
- 关闭后仍正常显示 AI 文字回复。
- 关闭后收到新的 `ai:audio` 时不自动播放，只保存最近一条音频。
- 关闭状态下保留最近一条回复的手动播放入口。
- 开关状态长期记住，下次进入 App 仍保持上次选择。
- 默认状态为语音开，延续当前语音优先体验。

## 非目标

- 不改变用户语音输入能力。
- 不新增文字输入模式。
- 不把偏好写入后端数据库。
- 不提供监护端远程控制。
- 不支持按时间段自动静音。
- 不改造 Gateway 的 TTS 生成流程。

## 推荐方案

采用“前端本地持久化 + 预留后端同步语义”的方式实现。

移动端本地保存 `voicePlaybackEnabled`。当前版本不新增数据库字段和 API，避免为了一个体验偏好引入后端迁移。命名使用 `voicePlaybackEnabled`，而不是 `mute`，因为它表达的是“AI 回复是否自动播放”，未来如果需要同步到后端，也能作为清晰的设置字段。

## UI 位置与形态

开关放在老人端 AI 回复气泡附近，推荐位于气泡右下角或底部边缘。原因是它控制的是 AI 回复播放行为，放在回复区域附近比放在麦克风旁更不容易被误解为“麦克风开关”。

开关使用文字形式：

- `语音 开`
- `语音 关`

老人端优先保证可理解性，文字开关比纯图标更清楚。

语音关闭时，在最近一条回复附近显示一个小的 `播放` 入口。这个入口只针对最近一条音频，不做历史消息级播放列表。

## 状态设计

在 `useCompanioneeConversation` 中新增状态和行为：

- `voicePlaybackEnabled: boolean`
- `lastAudioUrl: string | null`
- `toggleVoicePlayback(): void`
- `playLatestAudio(): void`

现有对话状态保持：

- `IDLE`
- `LISTENING`
- `PROCESSING`
- `RESPONDING`
- `SPEAKING`

语音播放开关不新增主状态，而是作为独立偏好影响 `ai:audio` 的处理。

## WebSocket 事件处理

`message:ai_text`：

- 总是更新 `aiText`
- 切到 `RESPONDING`
- 不受 `voicePlaybackEnabled` 影响

`ai:audio` 且 `voicePlaybackEnabled=true`：

- 保存 `lastAudioUrl`
- 调用 `playAudio(url)`
- 切到 `SPEAKING`

`ai:audio` 且 `voicePlaybackEnabled=false`：

- 保存 `lastAudioUrl`
- 不调用 `playAudio(url)`
- 切回 `IDLE`

`ai:audio_unavailable`：

- 保留文字
- 切回 `IDLE`

错误事件：

- 沿用当前错误处理
- TTS 失败不影响文字展示

## 用户操作行为

关闭语音：

- 设置 `voicePlaybackEnabled=false`
- 持久化该偏好
- 如果当前状态是 `SPEAKING`，调用 `stopAudio()`
- 切回 `IDLE`
- 保留 `lastAudioUrl`

打开语音：

- 设置 `voicePlaybackEnabled=true`
- 持久化该偏好
- 不自动补播历史音频，避免刚打开开关就突然出声
- 下一条 AI 回复开始自动播放

播放最近一条：

- 仅当 `lastAudioUrl` 存在时可用
- 调用 `playAudio(lastAudioUrl)`
- 切到 `SPEAKING`
- 不改变 `voicePlaybackEnabled`

停止播放：

- 沿用当前 `handleStop`
- `SPEAKING` 时停止音频并回到 `IDLE`

## 组件边界

新增一个小组件，例如 `VoicePlaybackToggle`，建议放在 `apps/xiaonuan-app/src/components/companionee/`。

组件只负责 UI 展示和触发回调：

- `enabled`
- `canPlayLatest`
- `onToggle`
- `onPlayLatest`

职责边界：

- `useVoice`：录音、播放、停止音频
- `useWebSocket`：连接和收发消息
- `useCompanioneeConversation`：对话状态机、语音播放偏好、最近音频缓存
- `VoicePlaybackToggle`：开关 UI 和最近一条播放入口
- 老人端页面：布局和动画

## 持久化

使用移动端本地持久化存储，并沿用项目现有 Zustand + AsyncStorage 风格。建议新增一个轻量偏好 store，例如 `conversation-preferences-store.ts`，由 `useCompanioneeConversation` 读取和更新。

需要新增一个存储 key，例如：

- `STORAGE_KEYS.VOICE_PLAYBACK_ENABLED`

默认值：

- 如果没有历史设置，`voicePlaybackEnabled=true`

恢复时机：

- 老人端页面初始化时读取
- 读取完成前可先按默认开启处理

## 可访问性与文案

开关文案使用短句，不使用抽象词：

- 开启：`语音 开`
- 关闭：`语音 关`
- 最近一条播放入口：`播放`

关闭语音后不弹窗提醒，避免打断老人。界面状态本身表达即可。

## 测试计划

移动端 hook 测试：

- 默认 `voicePlaybackEnabled=true`
- 关闭语音后状态被持久化
- 语音开时收到 `ai:audio` 会调用 `playAudio`
- 语音关时收到 `ai:audio` 不调用 `playAudio`
- 语音关时收到 `ai:audio` 会保存 `lastAudioUrl`
- `SPEAKING` 时关闭语音会调用 `stopAudio`
- 重新打开语音不会自动补播历史音频
- 点击播放最近一条会调用 `playAudio(lastAudioUrl)`

页面/组件测试：

- 显示 `语音 开` / `语音 关`
- 语音关闭且存在最近音频时显示 `播放`
- 语音关闭但没有最近音频时不显示播放入口或置灰

回归测试：

- 老人端仍可按住说话
- `message:ai_text` 仍立即显示
- TTS 失败时文本仍保留
- `pnpm --filter @xiaonuan/xiaonuan-app exec tsc --noEmit`
- `pnpm --filter @xiaonuan/xiaonuan-app test`

## 后续扩展

如果后续发现需要跨设备保留偏好，可以把 `voicePlaybackEnabled` 同步到后端 participant 或 pairing setting。当前设计刻意保持字段语义稳定，便于以后升级。

如果后续需要夜间免打扰，可以在这个偏好上增加自动策略，但不应改变本次“手动开关优先”的基础体验。
