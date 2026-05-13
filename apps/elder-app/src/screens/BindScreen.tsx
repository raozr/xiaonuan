import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';

interface BindScreenProps {
  onBindSuccess: (token: string, familyId: string) => void;
  deviceId: string | null;
}

const LOGO = require('../../assets/logo-smalll.jpg');

const CODE_LENGTH = 6;

export function BindScreen({ onBindSuccess, deviceId }: BindScreenProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDigit = useCallback((digit: string) => {
    setCode((prev) => (prev.length < CODE_LENGTH ? prev + digit : prev));
  }, []);

  const handleBackspace = useCallback(() => {
    setCode((prev) => prev.slice(0, -1));
  }, []);

  async function handleBind() {
    if (code.length !== CODE_LENGTH) {
      Alert.alert('提示', `请输入 ${CODE_LENGTH} 位数字绑定码`);
      return;
    }

    if (!deviceId) {
      Alert.alert('错误', '设备标识未初始化，请重启应用');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://192.168.4.70:3000/api/family/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code, deviceId }),
      });

      const data = await response.json();
      if (data.success) {
        onBindSuccess(data.token, data.familyId);
      } else {
        Alert.alert('绑定失败', data.message || '请检查绑定码是否正确');
      }
    } catch (e) {
      Alert.alert('错误', '网络连接失败，请检查网络设置');
    } finally {
      setLoading(false);
    }
  }

  const isComplete = code.length === CODE_LENGTH;

  return (
    <View style={styles.container}>
      {/* Avatar / Welcome Area */}
      <View style={styles.welcomeArea}>
        <View style={styles.avatarContainer}>
          <Image source={LOGO} style={styles.avatarImage} />
        </View>
        <Text style={styles.title}>Hello!</Text>
        <Text style={styles.subtitle}>
          请输入子女提供的 {CODE_LENGTH} 位绑定码
        </Text>
      </View>

      {/* Digit Display */}
      <View style={styles.digitsRow}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.digitBox,
              i === code.length && styles.digitBoxActive,
            ]}
          >
            <Text style={styles.digitText}>{code[i] || ''}</Text>
          </View>
        ))}
      </View>

      {/* Numeric Keypad */}
      <View style={styles.keypad}>
        <View style={styles.keypadRow}>
          {['1', '2', '3'].map((n) => (
            <TouchableOpacity
              key={n}
              style={styles.keypadButton}
              onPress={() => handleDigit(n)}
              activeOpacity={0.7}
            >
              <Text style={styles.keypadButtonText}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keypadRow}>
          {['4', '5', '6'].map((n) => (
            <TouchableOpacity
              key={n}
              style={styles.keypadButton}
              onPress={() => handleDigit(n)}
              activeOpacity={0.7}
            >
              <Text style={styles.keypadButtonText}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keypadRow}>
          {['7', '8', '9'].map((n) => (
            <TouchableOpacity
              key={n}
              style={styles.keypadButton}
              onPress={() => handleDigit(n)}
              activeOpacity={0.7}
            >
              <Text style={styles.keypadButtonText}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.keypadRow}>
          <View style={styles.keypadButtonEmpty} />
          <TouchableOpacity
            style={styles.keypadButton}
            onPress={() => handleDigit('0')}
            activeOpacity={0.7}
          >
            <Text style={styles.keypadButtonText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.keypadButton, styles.keypadButtonMuted]}
            onPress={handleBackspace}
            activeOpacity={0.7}
          >
            <Text style={styles.keypadButtonText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Confirm Button */}
      <TouchableOpacity
        style={[styles.confirmButton, !isComplete && styles.confirmButtonDisabled]}
        onPress={handleBind}
        disabled={!isComplete || loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Text style={styles.confirmButtonText}>开启陪伴</Text>
            <Text style={styles.confirmIcon}>✓</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff8f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  welcomeArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#fcebe0',
    borderWidth: 4,
    borderColor: '#f6e5da',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#8f4e00',
    marginBottom: 8,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#544437',
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 280,
  },
  digitsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 8,
  },
  digitBox: {
    flex: 1,
    height: 64,
    backgroundColor: '#fcebe0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  digitBoxActive: {
    borderBottomColor: '#8f4e00',
  },
  digitText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#221a13',
  },
  keypad: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  keypadButton: {
    width: '30%',
    height: 64,
    backgroundColor: '#f6e5da',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  keypadButtonMuted: {
    backgroundColor: '#fcebe0',
  },
  keypadButtonEmpty: {
    width: '30%',
    height: 64,
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#221a13',
  },
  confirmButton: {
    width: '100%',
    maxWidth: 400,
    height: 88,
    backgroundColor: '#8f4e00',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  confirmIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
});
