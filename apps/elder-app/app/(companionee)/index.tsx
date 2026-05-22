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
import { useAuthStore, ensureDeviceId } from '../../src/store/auth-store';
import { bindPairing } from '../../src/services/pairing';
import { colors, typography, spacing } from '../../src/utils/theme';

const LOGO = require('../../assets/logo-smalll.jpg');
const CODE_LENGTH = 6;

export default function CompanioneeBinding() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

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
    <View className="flex-1 bg-surface-bright items-center justify-center px-margin-mobile relative overflow-hidden">
      {/* Decorative blobs */}
      <View className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary-fixed opacity-30" style={{ transform: [{ scale: 1 }] }} />
      <View className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-tertiaryFixed opacity-40" />

      {/* Switch to Caregiver side */}
      <TouchableOpacity
        className="absolute top-gutter right-margin-mobile flex-row items-center gap-stack-sm bg-surfaceLowest px-stack-md py-stack-sm rounded-full"
        activeOpacity={0.7}
        onPress={() => router.push('/(auth)/login')}
        style={{ minWidth: 44, height: 44 }}
      >
        <Text className="text-body-md font-semibold text-primary">Switch to Caregiver side</Text>
      </TouchableOpacity>

      {/* Mascot card */}
      <View className="mb-stack-lg relative">
        <View className="w-32 h-32 bg-surfaceLowest shadow-md items-center justify-center p-4 overflow-hidden border-2 border-surfaceContainerHigh rounded-3xl">
          <Image source={LOGO} className="w-full h-full rounded-3xl" resizeMode="cover" />
        </View>
        {/* Voice feedback ring */}
        <View className="absolute -bottom-2 -right-2 w-12 h-12 bg-surfaceLowest shadow-md rounded-full items-center justify-center" style={{ borderWidth: 2, borderColor: colors.primaryContainer }}>
          <Text className="text-primary" style={{ fontSize: 20 }}>●)))</Text>
        </View>
      </View>

      {/* Welcome */}
      <View className="items-center mb-stack-lg w-full">
        <Text className="text-on-surface mb-stack-sm" style={typography.displayElderly}>
          Welcome!
        </Text>
        <Text className="text-on-surface-variant max-w-[280px] text-center leading-tight" style={typography.bodyLgElderly}>
          Please enter the 6-digit code from your caregiver.
        </Text>
      </View>

      {/* Code input slots */}
      <View className="flex-row gap-2 mb-stack-lg justify-center w-full">
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const filled = i < code.length;
          const active = i === code.length;
          return (
            <React.Fragment key={i}>
              {i === 3 && <Text className="text-tertiary font-bold text-2xl self-center">-</Text>}
              <View
                className="w-12 h-16 rounded-xl border-2 items-center justify-center"
                style={{
                  backgroundColor: filled ? colors.surfaceLowest : colors.surfaceLow,
                  borderColor: active ? colors.primaryContainer : filled ? colors.primary : colors.outlineVariant,
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
      <View className="w-full max-w-[320px] mb-stack-lg gap-3">
        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'delete']].map((row, ri) => (
          <View key={ri} className="flex-row justify-between mb-3">
            {row.map((key) => {
              if (key === '') return <View key="empty" className="w-[30%] h-touch-target-min" />;
              if (key === 'delete') {
                return (
                  <TouchableOpacity
                    key="delete"
                    className="w-[30%] h-touch-target-min bg-surfaceContainer rounded-2xl items-center justify-center"
                    onPress={handleBackspace}
                    activeOpacity={0.7}
                  >
                    <Text className="text-2xl text-on-surface-variant">⌫</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={key}
                  className="w-[30%] h-touch-target-min bg-surfaceLowest rounded-2xl shadow-sm items-center justify-center"
                  onPress={() => handleDigit(key)}
                  activeOpacity={0.7}
                >
                  <Text style={typography.displayElderly} className="text-on-surface">{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Confirm button */}
      <TouchableOpacity
        className="w-full max-w-[320px] h-[72px] rounded-full shadow-lg flex-row items-center justify-center gap-3"
        style={{
          backgroundColor: isComplete ? colors.primary : colors.primaryContainer,
          opacity: isComplete ? 1 : 0.5,
        }}
        disabled={!isComplete || loading}
        activeOpacity={0.8}
        onPress={handleBind}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <Text className="text-on-primary font-bold" style={typography.headlineLg}>
              Confirm Code
            </Text>
            <Text className="text-on-primary text-2xl">✓</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
