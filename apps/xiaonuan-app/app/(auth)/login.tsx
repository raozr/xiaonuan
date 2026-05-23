import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Phone, Lock, Eye, EyeOff, ArrowRight, ArrowLeftRight } from 'lucide-react-native';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useAuthStore } from '../../src/store/auth-store';
import { useRoleStore } from '../../src/store/role-store';
import { login } from '../../src/services/auth';
import { colors, typography } from '../../src/utils/theme';
import { STEWARD_ROLE } from '../../src/utils/constants';

const LOGO = require('../../assets/logo-smalll.jpg');

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { setRole } = useRoleStore();

  async function handleLogin() {
    if (!phone || !password) {
      Alert.alert('提示', '请输入手机号和密码');
      return;
    }
    setLoading(true);
    try {
      const data = await login({ phone, password });
      // Set role FIRST, so auth layout re-render gets correct role
      await setRole(STEWARD_ROLE);
      await setAuth({
        token: data.token,
        pairingId: '',
        stewardName: data.user?.name,
      });
      router.replace('/(steward)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请检查手机号和密码';
      Alert.alert('登录失败', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-bright"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
        {/* Decorative blobs */}
        <View className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-primaryFixed opacity-30" />
        <View className="absolute bottom-[-5%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-tertiaryFixed opacity-30" />

        {/* Card */}
        <Card className="w-full max-w-sm px-gutter pb-gutter items-center relative z-10">
          {/* Mascot */}
          <View className="w-32 h-32 mb-stack-md bg-surfaceLowest rounded-3xl overflow-hidden items-center justify-center border-2 border-surfaceContainerHigh shadow-sm">
            <Image source={LOGO} className="w-full h-full" resizeMode="cover" />
          </View>

          {/* Welcome */}
          <Text className="text-on-surface mb-1 font-bold" style={typography.headlineLg}>
            欢迎回来
          </Text>
          <Text className="text-on-surface-variant mb-gutter text-center" style={typography.bodyMd}>
            登录照护者端。
          </Text>

          {/* Phone */}
          <Input
            label="手机号"
            placeholder="请输入手机号"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={<Phone size={20} color={colors.onSurfaceVariant} />}
          />

          {/* Password */}
          <Input
            label="密码"
            placeholder="请输入密码"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            leftIcon={<Lock size={20} color={colors.onSurfaceVariant} />}
            rightIcon={
              showPassword ? (
                <Eye size={20} color={colors.onSurfaceVariant} />
              ) : (
                <EyeOff size={20} color={colors.onSurfaceVariant} />
              )
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          {/* Login button */}
          <View className="w-full mt-stack-md">
            <Button
              label="登录"
              onPress={handleLogin}
              loading={loading}
              icon={<ArrowRight size={20} color={colors.onPrimary} />}
            />
          </View>

          {/* Register link */}
          <TouchableOpacity className="mt-stack-lg" activeOpacity={0.7} onPress={() => router.push('/(auth)/register')}>
            <Text className="text-on-surface-variant text-center">
              还没有账号？
              <Text className="text-primaryContainer font-bold"> 立即注册</Text>
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="w-full flex-row items-center my-gutter">
            <View className="flex-1 h-[1px] bg-outlineVariant" />
            <Text className="mx-stack-md text-on-surface-variant" style={typography.labelCaps}>或</Text>
            <View className="flex-1 h-[1px] bg-outlineVariant" />
          </View>

          {/* Switch to Elderly */}
          <TouchableOpacity
            className="flex-row items-center gap-stack-sm py-stack-sm px-stack-md"
            activeOpacity={0.7}
            onPress={() => router.replace('/(companionee)')}
          >
            <ArrowLeftRight size={20} color={colors.primary} />
            <Text className="text-primary font-semibold" style={typography.bodyMd}>
              切换
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
