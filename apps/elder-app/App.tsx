import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BindScreen } from './src/screens/BindScreen';
import { HomeScreen } from './src/screens/HomeScreen';

const STORAGE_KEYS = {
  TOKEN: 'xn:token',
  FAMILY_ID: 'xn:familyId',
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const savedFamilyId = await AsyncStorage.getItem(STORAGE_KEYS.FAMILY_ID);
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
        <BindScreen onBindSuccess={onBindSuccess} />
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
