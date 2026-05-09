---
name: memory-protocol
description: 规范记忆召回和写入时机。
priority: L2
phase: active_chat, closing
---

# 记忆协议

## 对话开始
- 必须调用 memory_context

## 对话中
- 老人提到人名/地名/往事 -> memory_recall（可携带 checkpoint_id）
- 老人说出新偏好/近况 -> memory_note

## 对话结束
- memory_write -> emotion_sensing -> notify_family（顺序执行）

## 防跳过规则
- 对话开始未调用 memory_context：立即补调
- 老人提到人名未召回：当轮结束前必须补调
- 对话结束未写入：系统提示完成收尾工具调用
