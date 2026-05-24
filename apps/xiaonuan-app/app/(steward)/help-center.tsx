import React from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopAppBar } from '../../src/components/shared/TopAppBar';
import { colors, typography } from '../../src/utils/theme';

export default function HelpCenterScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="帮助中心" showBack />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: insets.bottom + 32 }}
      >
        <Text className="text-on-surface font-bold mb-stack-md" style={typography.headlineLg}>
          欢迎使用小暖
        </Text>
        <Text className="text-on-surface-variant mb-stack-lg" style={typography.bodyMd}>
          小暖是一款 AI 智能陪伴平台，为被陪伴者提供温暖的对话陪伴，为照护者提供便捷的管理工具。
        </Text>

        <Text className="text-on-surface font-bold mb-stack-sm" style={typography.bodyLgElderly}>
          常见问题
        </Text>

        {[
          {
            q: '如何添加新的被陪伴者？',
            a: '在"我的"页面点击"添加新陪伴"，填写相关信息后即可创建。',
          },
          {
            q: '被陪伴者如何开始使用？',
            a: '创建陪伴关系后，系统会生成一个配对码。被陪伴者可以在设备上输入该配对码完成绑定。',
          },
          {
            q: '如何查看每日摘要？',
            a: '在陪伴详情页的"概览"标签下，可以查看今日的情绪状态、对话时长等信息。',
          },
          {
            q: '语音克隆功能如何使用？',
            a: '在"声音"标签页，长按录音按钮朗读示例文本，系统会自动完成声音克隆。',
          },
          {
            q: '忘记密码怎么办？',
            a: '目前暂不支持自助找回密码，请联系管理员协助处理。',
          },
        ].map((item, index) => (
          <View key={index} className="mb-stack-md">
            <Text className="text-on-surface font-semibold mb-stack-sm" style={typography.bodyMd}>
              {index + 1}. {item.q}
            </Text>
            <Text className="text-on-surface-variant" style={typography.bodyMd}>
              {item.a}
            </Text>
          </View>
        ))}

        <Text className="text-on-surface-variant mt-stack-lg" style={typography.bodyMd}>
          如有其他问题，请联系客服团队
        </Text>
      </ScrollView>
    </View>
  );
}
