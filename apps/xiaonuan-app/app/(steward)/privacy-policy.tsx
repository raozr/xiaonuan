import React from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopAppBar } from '../../src/components/shared/TopAppBar';
import { colors, typography } from '../../src/utils/theme';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="隐私政策" showBack />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: insets.bottom + 32 }}
      >
        <Text className="text-on-surface font-bold mb-stack-md" style={typography.headlineLg}>
          隐私政策
        </Text>
        <Text className="text-on-surface-variant mb-stack-lg" style={typography.bodyMd}>
          更新日期：2025年5月24日
        </Text>

        {[
          {
            title: '1. 信息收集',
            content:
              '我们收集您提供的个人信息，包括但不限于姓名、手机号码等。这些信息用于身份验证、服务提供和账户管理。我们还可能收集设备信息和使用数据，以改善服务质量。',
          },
          {
            title: '2. 信息使用',
            content:
              '您的个人信息仅用于提供和改善小暖平台的服务。我们不会将您的个人信息出售或出租给第三方。我们可能会在法律要求的情况下披露您的信息。',
          },
          {
            title: '3. 数据安全',
            content:
              '我们采用业界标准的安全措施保护您的个人信息。所有敏感数据传输均经过加密处理，密码经过哈希存储。我们定期审查和更新安全措施。',
          },
          {
            title: '4. 语音数据',
            content:
              '您提供的语音样本仅用于生成个性化的语音克隆，我们不会将其用于其他目的。您可以随时删除已上传的语音数据。',
          },
          {
            title: '5. 第三方服务',
            content:
              '我们可能使用第三方服务提供商来支持平台运营。这些提供商仅在必要的范围内访问您的信息，并受保密协议的约束。',
          },
          {
            title: '6. 您的权利',
            content:
              '您有权访问、更正或删除您的个人信息。如需行使这些权利，请联系我们的客服团队。',
          },
          {
            title: '7. 政策更新',
            content:
              '我们可能会不时更新本隐私政策。任何重大变更将通过应用内通知或电子邮件告知您。',
          },
        ].map((item, index) => (
          <View key={index} className="mb-stack-lg">
            <Text className="text-on-surface font-semibold mb-stack-sm" style={typography.bodyLgElderly}>
              {item.title}
            </Text>
            <Text className="text-on-surface-variant" style={typography.bodyMd}>
              {item.content}
            </Text>
          </View>
        ))}

        <Text className="text-on-surface-variant mt-stack-lg" style={typography.bodyMd}>
          如有疑问，请联系 privacy@xiaonuan.ai
        </Text>
      </ScrollView>
    </View>
  );
}
