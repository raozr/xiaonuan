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
import { User, Smartphone, Lock, Shield, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useAuthStore } from '../../src/store/auth-store';
import { useRoleStore } from '../../src/store/role-store';
import { register } from '../../src/services/auth';
import { colors, typography } from '../../src/utils/theme';
import { STEWARD_ROLE } from '../../src/utils/constants';

const LOGO = require('../../assets/logo-smalll.jpg');

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { setRole } = useRoleStore();

  async function handleRegister() {
    if (!name || !phone || !password || !confirmPassword) {
      Alert.alert('提示', '请填写所有字段');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const data = await register({ name, phone, password });
      await setAuth({
        token: data.token,
        pairingId: '',
        stewardName: data.user?.name,
      });
      setRole(STEWARD_ROLE);
      router.replace('/(steward)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请稍后再试';
      Alert.alert('注册失败', message);
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

          {/* Brand */}
          <Text className="text-primaryContainer mb-1 font-bold" style={typography.headlineLg}>
            Xiao Nuan
          </Text>
          <Text className="text-on-surface-variant mb-gutter text-center" style={typography.bodyMd}>
            Create a caregiver account to support your loved ones.
          </Text>

          {/* Full Name */}
          <Input
            label="Full Name"
            placeholder="e.g. Jane Doe"
            value={name}
            onChangeText={setName}
            leftIcon={<User size={20} color={colors.onSurfaceVariant} />}
          />

          {/* Mobile Number */}
          <Input
            label="Mobile Number"
            placeholder="e.g. +1 234 567 8900"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={<Smartphone size={20} color={colors.onSurfaceVariant} />}
          />

          {/* Password */}
          <Input
            label="Password"
            placeholder="Enter your password"
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

          {/* Confirm Password */}
          <Input
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            leftIcon={<Shield size={20} color={colors.onSurfaceVariant} />}
            rightIcon={
              showConfirm ? (
                <Eye size={20} color={colors.onSurfaceVariant} />
              ) : (
                <EyeOff size={20} color={colors.onSurfaceVariant} />
              )
            }
            onRightIconPress={() => setShowConfirm(!showConfirm)}
          />

          {/* Register button */}
          <View className="w-full mt-stack-md">
            <Button
              label="Register"
              onPress={handleRegister}
              loading={loading}
              icon={<ArrowRight size={20} color={colors.onPrimary} />}
            />
          </View>

          {/* Login link */}
          <TouchableOpacity className="mt-stack-lg" activeOpacity={0.7} onPress={() => router.push('/(auth)/login')}>
            <Text className="text-on-surface-variant text-center">
              Already have an account?{' '}
              <Text className="text-primaryContainer font-bold">Login</Text>
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
