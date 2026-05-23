import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Vibration,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Volume2, X, Check } from 'lucide-react-native';
import { useAuthStore, ensureDeviceId } from '../../src/store/auth-store';
import { useRoleStore } from '../../src/store/role-store';
import { COMPANIONEE_ROLE } from '../../src/utils/constants';
import { bindPairing } from '../../src/services/pairing';
import { colors, typography, spacing } from '../../src/utils/theme';

const LOGO = require('../../assets/logo-smalll.jpg');
const CODE_LENGTH = 6;

export default function CompanioneeBinding() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { setRole } = useRoleStore();

  const handleDigit = useCallback((digit: string) => {
    setCode((prev) => (prev.length < CODE_LENGTH ? prev + digit : prev));
    Vibration.vibrate(50);
  }, []);

  const handleBackspace = useCallback(() => {
    setCode((prev) => prev.slice(0, -1));
  }, []);

  async function handleBind() {
    if (code.length !== CODE_LENGTH) {
      Alert.alert('提示', `请输入 ${CODE_LENGTH} 位数字绑定码`);
      return;
    }

    const deviceId = await ensureDeviceId();
    setLoading(true);
    try {
      const data = await bindPairing({ code, deviceId });
      await setAuth({
        token: data.token,
        pairingId: data.pairingId,
        stewardName: data.stewardName,
        companioneeName: data.companioneeName,
      });
      await setRole(COMPANIONEE_ROLE);
      router.replace('/(companionee)/home');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请检查绑定码是否正确';
      Alert.alert('绑定失败', message);
    } finally {
      setLoading(false);
    }
  }

  const isComplete = code.length === CODE_LENGTH;

  return (
    <View className="flex-1 bg-surface-bright items-center px-margin-mobile relative overflow-hidden">
      {/* Decorative blobs */}
      <View className="absolute top-[-10%] left-[-10%] w-[30vw] h-[30vw] rounded-full bg-primaryFixed opacity-20" style={{ transform: [{ scale: 1 }] }} />
      <View className="absolute bottom-[-5%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-tertiaryFixed opacity-25" />

      {/* Switch to Caregiver side */}
      <TouchableOpacity
        className="absolute top-14 right-margin-mobile flex-row items-center gap-stack-sm bg-surfaceLowest px-stack-md py-stack-sm rounded-full"
        activeOpacity={0.7}
        onPress={() => router.push('/(auth)/login')}
        style={{ minWidth: 44, height: 44 }}
      >
        <Text className="text-body-md font-semibold text-primary">切换</Text>
        <ArrowRight size={16} color={colors.primary} />
      </TouchableOpacity>

      {/* Mascot card */}
      <View className="mt-10 mb-4 relative">
        <View className="w-28 h-28 bg-surfaceLowest shadow-md items-center justify-center overflow-hidden border-2 border-surfaceContainerHigh rounded-3xl">
          <Image source={LOGO} className="w-full h-full rounded-3xl" resizeMode="cover" />
        </View>
        {/* Voice feedback ring */}
        <View className="absolute -bottom-1.5 -right-1.5 w-11 h-11 bg-surfaceLowest shadow-md rounded-full items-center justify-center" style={{ borderWidth: 2, borderColor: colors.primaryContainer }}>
          <Volume2 size={18} color={colors.primary} />
        </View>
      </View>

      {/* Welcome */}
      <View className="items-center mb-4 w-full">
        <Text className="text-on-surface mb-1" style={typography.displayElderly}>
          欢迎！
        </Text>
        <Text className="text-on-surface-variant max-w-[260px] text-center leading-tight" style={{ fontSize: 18, fontWeight: '600', lineHeight: 26 }}>
          请输入家人提供的 6 位验证码。
        </Text>
      </View>

      {/* Code input slots */}
      <View className="flex-row gap-2.5 mb-5 justify-center w-full">
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const filled = i < code.length;
          const active = i === code.length;
          return (
            <React.Fragment key={i}>
              {i === 3 && <Text style={{ color: colors.outline, fontSize: 24, fontWeight: 'bold' }} className="self-center">-</Text>}
              <View
                className="w-12 h-14 rounded-xl border-2 items-center justify-center"
                style={{
                  backgroundColor: filled ? colors.surfaceLowest : colors.surfaceLow,
                  borderColor: active ? colors.primaryContainer : filled ? colors.primary : colors.outline,
                  ...(active ? { shadowColor: colors.primaryFixed, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 3 } : {}),
                  ...(filled ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 } : {}),
                }}
              >
                <Text style={typography.displayElderly} className="text-on-surface">
                  {code[i] || ''}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {/* Numeric keypad */}
      <View className="w-full max-w-[280px] mb-4">
        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'delete']].map((row, ri) => (
          <View key={ri} className="flex-row justify-between mb-2">
            {row.map((key) => {
              if (key === '') return <View key="empty" className="w-[30%] h-16" />;
              if (key === 'delete') {
                return (
                  <TouchableOpacity
                    key="delete"
                    className="w-[30%] h-16 bg-surfaceContainer rounded-2xl items-center justify-center"
                    onPress={handleBackspace}
                    activeOpacity={0.7}
                  >
                    <X size={22} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={key}
                  className="w-[30%] h-16 bg-surfaceLowest rounded-2xl items-center justify-center"
                  onPress={() => handleDigit(key)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 28, fontWeight: '800', lineHeight: 36 }} className="text-on-surface">{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Confirm button */}
      <TouchableOpacity
        className="w-full max-w-[280px] h-[64px] rounded-full shadow-lg flex-row items-center justify-center gap-3"
        style={{
          backgroundColor: isComplete ? colors.primary : colors.primaryContainer,
        }}
        disabled={!isComplete || loading}
        activeOpacity={0.8}
        onPress={handleBind}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <Text className="font-bold" style={{
              fontSize: 22,
              fontWeight: '700',
              lineHeight: 28,
              color: isComplete ? colors.onPrimary : colors.onPrimaryContainer,
            }}>
              确认绑定
            </Text>
            <Check size={22} color={isComplete ? colors.onPrimary : colors.onPrimaryContainer} strokeWidth={3} />
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
