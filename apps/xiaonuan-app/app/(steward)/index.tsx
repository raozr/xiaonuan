import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopAppBar } from '../../src/components/shared/TopAppBar';
import { PairingCard } from '../../src/components/steward/PairingCard';
import { EmptyStateIllustration } from '../../src/components/steward/EmptyStateIllustration';
import { Button } from '../../src/components/ui/Button';
import { listPairings, type Pairing } from '../../src/services/pairing';
import { colors, typography, spacing } from '../../src/utils/theme';
import { useAuthStore } from '../../src/store/auth-store';

export default function PairingListScreen() {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchPairings();
  }, []);

  async function fetchPairings() {
    if (!token) return;
    try {
      const data = await listPairings(token);
      setPairings(data || []);
    } catch (e) {
      console.error('Failed to fetch pairings:', e);
    } finally {
      setLoading(false);
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
        {pairings.length > 0 ? (
          pairings.map((p) => (
            <PairingCard
              key={p.id}
              pairingId={p.id}
              name={p.companionee?.name ?? '未知'}
              online={p.isOnline}
              lastActive={p.lastActive ?? undefined}
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
