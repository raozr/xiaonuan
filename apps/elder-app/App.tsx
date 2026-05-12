import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import { BindScreen } from './src/screens/BindScreen';
import { HomeScreen } from './src/screens/HomeScreen';

const STORAGE_KEYS = {
  DEVICE_ID: 'xn:deviceId',
  TOKEN: 'xn:token',
  FAMILY_ID: 'xn:familyId',
} as const;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      let savedDeviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (!savedDeviceId) {
        savedDeviceId = (uuid.v4() as string);
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, savedDeviceId);
      }
      const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const savedFamilyId = await AsyncStorage.getItem(STORAGE_KEYS.FAMILY_ID);
      setDeviceId(savedDeviceId);
      setToken(savedToken);
      setFamilyId(savedFamilyId);
    } catch (e) {
      console.error('Failed to load auth state', e);
    } finally {
      setLoading(false);
    }
  }

  async function onBindSuccess(newToken: string, newFamilyId: string) {
    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
    await AsyncStorage.setItem(STORAGE_KEYS.FAMILY_ID, newFamilyId);
    setToken(newToken);
    setFamilyId(newFamilyId);
  }

  function onUnbind() {
    AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.FAMILY_ID]);
    setToken(null);
    setFamilyId(null);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {token && familyId ? (
        <HomeScreen token={token} familyId={familyId} onUnbind={onUnbind} />
      ) : (
        <BindScreen onBindSuccess={onBindSuccess} deviceId={deviceId} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
