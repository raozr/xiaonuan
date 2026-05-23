import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { QrCode, Copy, Check, ArrowRight, Home, User, Heart, MessageCircle } from 'lucide-react-native';
import { TopAppBar } from '../../src/components/shared/TopAppBar';
import { createPairing } from '../../src/services/pairing';
import { useAuthStore } from '../../src/store/auth-store';
import { colors, typography } from '../../src/utils/theme';

export default function OnboardingScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();

  const mockCode = '582914';

  async function handleNext() {
    if (!name.trim()) {
      Alert.alert('提示', '请输入姓名');
      return;
    }
    if (!relationship.trim()) {
      Alert.alert('提示', '请输入关系');
      return;
    }
    if (!token) {
      Alert.alert('提示', '请先登录');
      return;
    }

    setLoading(true);
    try {
      const result = await createPairing(token, {
        name: name.trim(),
        relationship: relationship.trim(),
        notes: notes.trim() || undefined,
      });
      setGeneratedCode(result.inviteCode);
      setStep(2);
    } catch (err: any) {
      Alert.alert('创建失败', err.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    Alert.alert('提示', '配对码已复制到剪贴板');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="我的陪伴" showBack />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Step indicator */}
        <View className="flex-row items-center justify-center mb-8">
          <View className="flex-row items-center gap-2">
            <View className={`w-8 h-8 rounded-full items-center justify-center ${step >= 1 ? 'bg-primaryContainer' : 'bg-surfaceContainer'}`}>
              <Text className={`font-bold ${step >= 1 ? 'text-on-primary' : 'text-on-surface-variant'}`}>1</Text>
            </View>
            <View className={`w-8 h-0.5 ${step >= 2 ? 'bg-primaryContainer' : 'bg-surfaceContainer'}`} />
            <View className={`w-8 h-8 rounded-full items-center justify-center ${step >= 2 ? 'bg-primaryContainer' : 'bg-surfaceContainer'}`}>
              <Text className={`font-bold ${step >= 2 ? 'text-on-primary' : 'text-on-surface-variant'}`}>2</Text>
            </View>
          </View>
        </View>

        {step === 1 && (
          <>
            {/* Step 1: Basic Info */}
            <View className="items-center mb-8">
              <Text className="text-on-surface font-bold mb-2" style={typography.headlineLg}>
                基本信息
              </Text>
              <Text className="text-on-surface-variant text-center" style={typography.bodyMd}>
                填写陪伴对象的基本信息
              </Text>
            </View>

            {/* Form */}
            <View className="gap-stack-md">
              {/* Name */}
              <View>
                <Text className="text-on-surface-variant mb-2 font-bold" style={typography.labelCaps}>
                  姓名
                </Text>
                <View className="flex-row items-center rounded-xl border px-4 h-14" style={{ backgroundColor: colors.surfaceLowest, borderColor: colors.outlineVariant, borderWidth: 1 }}>
                  <User size={20} color={colors.onSurfaceVariant} className="mr-3" />
                  <TextInput
                    className="flex-1 text-on-surface"
                    style={typography.bodyMd}
                    placeholder="请输入姓名"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>

              {/* Relationship */}
              <View>
                <Text className="text-on-surface-variant mb-2 font-bold" style={typography.labelCaps}>
                  关系
                </Text>
                <View className="flex-row items-center rounded-xl border px-4 h-14" style={{ backgroundColor: colors.surfaceLowest, borderColor: colors.outlineVariant, borderWidth: 1 }}>
                  <Heart size={20} color={colors.onSurfaceVariant} className="mr-3" />
                  <TextInput
                    className="flex-1 text-on-surface"
                    style={typography.bodyMd}
                    placeholder="例如：母亲、父亲、奶奶..."
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={relationship}
                    onChangeText={setRelationship}
                  />
                </View>
              </View>

              {/* Notes */}
              <View>
                <Text className="text-on-surface-variant mb-2 font-bold" style={typography.labelCaps}>
                  备注
                </Text>
                <View className="rounded-xl border px-4 py-3" style={{ backgroundColor: colors.surfaceLowest, borderColor: colors.outlineVariant, borderWidth: 1, minHeight: 100 }}>
                  <TextInput
                    className="flex-1 text-on-surface"
                    style={typography.bodyMd}
                    placeholder="添加备注信息（可选）"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </View>

            {/* Next button */}
            <TouchableOpacity
              className="w-full h-[64px] rounded-full flex-row items-center justify-center gap-3 mt-12 mb-12"
              style={{ backgroundColor: colors.primary }}
              activeOpacity={0.8}
              onPress={handleNext}
            >
              <Text className="text-on-primary font-bold" style={{ fontSize: 18, lineHeight: 24 }}>
                下一步
              </Text>
              <ArrowRight size={20} color={colors.onPrimary} />
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            {/* Step 2: Share Code */}
            <View className="items-center">
              <Text className="text-on-surface font-bold mb-2" style={typography.headlineLg}>
                分享配对码
              </Text>
              <Text className="text-on-surface-variant text-center mb-8" style={typography.bodyMd}>
                将配对码分享给{name || '家人'}，让他们在设备端输入完成绑定。
              </Text>

              {/* Code display card */}
              <View className="w-full max-w-[280px] bg-surfaceLowest rounded-3xl p-8 items-center mb-8" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 }}>
                <Text className="text-on-surface-variant mb-4" style={typography.labelCaps}>
                  配对码
                </Text>
                <View className="flex-row items-center gap-3 mb-4">
                  <Text className="text-on-surface font-mono font-bold" style={{ fontSize: 36, letterSpacing: 6 }}>
                    {generatedCode.slice(0, 3)} {generatedCode.slice(3)}
                  </Text>
                </View>
                <TouchableOpacity
                  className="flex-row items-center gap-2 bg-surfaceContainer rounded-full px-4 py-2"
                  activeOpacity={0.7}
                  onPress={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check size={16} color={colors.primary} />
                      <Text className="text-primary font-semibold" style={typography.bodyMd}>
                        已复制
                      </Text>
                    </>
                  ) : (
                    <>
                      <Copy size={16} color={colors.primary} />
                      <Text className="text-primary font-semibold" style={typography.bodyMd}>
                        复制配对码
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Instructions */}
              <View className="w-full bg-surfaceContainer rounded-2xl p-gutter mb-8">
                <Text className="text-on-surface font-bold mb-4" style={typography.bodyLgElderly}>
                  使用说明
                </Text>
                <View className="gap-3">
                  <View className="flex-row items-start gap-3">
                    <View className="w-6 h-6 rounded-full bg-primaryContainer items-center justify-center flex-shrink-0">
                      <Text className="text-on-primary font-bold" style={{ fontSize: 12 }}>1</Text>
                    </View>
                    <Text className="text-on-surface-variant flex-1" style={typography.bodyMd}>
                      复制配对码，发送给家人
                    </Text>
                  </View>
                  <View className="flex-row items-start gap-3">
                    <View className="w-6 h-6 rounded-full bg-primaryContainer items-center justify-center flex-shrink-0">
                      <Text className="text-on-primary font-bold" style={{ fontSize: 12 }}>2</Text>
                    </View>
                    <Text className="text-on-surface-variant flex-1" style={typography.bodyMd}>
                      家人在陪伴端输入配对码
                    </Text>
                  </View>
                  <View className="flex-row items-start gap-3">
                    <View className="w-6 h-6 rounded-full bg-primaryContainer items-center justify-center flex-shrink-0">
                      <Text className="text-on-primary font-bold" style={{ fontSize: 12 }}>3</Text>
                    </View>
                    <Text className="text-on-surface-variant flex-1" style={typography.bodyMd}>
                      绑定成功后即可开始陪伴
                    </Text>
                  </View>
                </View>
              </View>

              {/* Done button */}
              <TouchableOpacity
                className="w-full h-[64px] rounded-full items-center justify-center"
                style={{ backgroundColor: colors.primary }}
                activeOpacity={0.8}
                onPress={() => router.replace('/(steward)')}
              >
                <Text className="text-on-primary font-bold" style={{ fontSize: 18, lineHeight: 24 }}>
                  完成
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
