import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface BindScreenProps {
  onBindSuccess: (token: string, familyId: string) => void;
  deviceId: string | null;
}

export function BindScreen({ onBindSuccess, deviceId }: BindScreenProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleBind() {
    if (code.length !== 8) {
      Alert.alert('提示', '请输入 8 位数字绑定码');
      return;
    }

    if (!deviceId) {
      Alert.alert('错误', '设备标识未初始化，请重启应用');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/family/bind', {
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>欢迎使用小暖</Text>
        <Text style={styles.subtitle}>请输入子女提供的 8 位绑定码</Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="00000000"
          keyboardType="numeric"
          maxLength={8}
          placeholderTextColor="#ADB5BD"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleBind}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>开启陪伴</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8F9FA',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6C757D',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 80,
    backgroundColor: '#F1F3F5',
    borderRadius: 16,
    fontSize: 36,
    textAlign: 'center',
    fontWeight: '600',
    color: '#495057',
    marginBottom: 32,
  },
  button: {
    width: '100%',
    height: 64,
    backgroundColor: '#FF6B6B',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#FFA8A8',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
  },
});
