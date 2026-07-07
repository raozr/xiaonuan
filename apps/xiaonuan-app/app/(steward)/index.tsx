import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopAppBar } from '../../src/components/shared/TopAppBar';
import { PairingCard } from '../../src/components/steward/PairingCard';
import { EmptyStateIllustration } from '../../src/components/steward/EmptyStateIllustration';
import { Button } from '../../src/components/ui/Button';
import { deletePairing, listPairings, type Pairing } from '../../src/services/pairing';
import { colors, typography, spacing } from '../../src/utils/theme';
import { useAuthStore } from '../../src/store/auth-store';

export default function PairingListScreen() {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingPairingId, setDeletingPairingId] = useState<string | null>(null);
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchPairings();
  }, []);

  async function fetchPairings() {
    if (!token) return;
    try {
      setError(null);
      const data = await listPairings(token);
      setPairings(data || []);
    } catch (e: any) {
      console.error('Failed to fetch pairings:', e);
      setError(e.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function confirmDeletePairing(pairing: Pairing) {
    const companionName = pairing.companionee?.name ?? '未知';

    Alert.alert(
      `删除 ${companionName} 的陪伴？`,
      '删除后，这个陪伴关系和对应分身将从你的账号中移除。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除陪伴',
          style: 'destructive',
          onPress: () => {
            void handleDeletePairing(pairing);
          },
        },
      ]
    );
  }

  async function handleDeletePairing(pairing: Pairing) {
    if (!token) {
      Alert.alert('无法删除', '登录状态已失效，请重新登录后再试。');
      return;
    }

    if (deletingPairingId === pairing.id) {
      return;
    }

    try {
      setDeletingPairingId(pairing.id);
      await deletePairing(token, pairing.id);
      setPairings((current) => current.filter((item) => item.id !== pairing.id));
    } catch (e: any) {
      console.error('Failed to delete pairing:', e);
      Alert.alert('删除失败', e.message ?? '请稍后再试');
    } finally {
      setDeletingPairingId(null);
    }
  }

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />

      {/* Top AppBar with top inset padding */}
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar
          title="我的陪伴"
          showSettings
        />
      </View>

      {/* Content */}
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: insets.bottom + 80 }}>
        {loading ? null : error ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 16, color: colors.onSurface, marginBottom: 8 }}>加载失败</Text>
            <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
            <Button label="重试" variant="primary" onPress={fetchPairings} />
          </View>
        ) : pairings.length > 0 ? (
          pairings.map((p) => (
            <PairingCard
              key={p.id}
              pairingId={p.id}
              name={p.companionee?.name ?? '未知'}
              online={p.isOnline}
              lastActive={p.lastActive ?? undefined}
              onLongPress={() => confirmDeletePairing(p)}
            />
          ))
        ) : (
          <EmptyStateIllustration
            title="还没有陪伴对象"
            description="添加第一个家人，开始用小暖陪伴他们吧。"
            actionLabel="添加新陪伴"
            onAction={() => router.push('/(steward)/onboarding')}
          />
        )}
      </ScrollView>

      {/* Add New Pairing button (fixed bottom) */}
      {pairings.length > 0 && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 20, paddingTop: 12, backgroundColor: colors.surfaceBright + 'E6', paddingLeft: 20, paddingRight: 20 }}>
          <Button
            label="添加新陪伴"
            variant="secondary"
            icon={<Plus size={20} color={colors.onPrimary} />}
            onPress={() => router.push('/(steward)/onboarding')}
          />
        </View>
      )}
    </View>
  );
}
