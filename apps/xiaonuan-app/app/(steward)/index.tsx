import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
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
      {/* Top AppBar */}
      <TopAppBar
        title="My Steward Team"
        showSettings
      />

      {/* Content */}
      <ScrollView className="flex-1 px-margin-mobile" contentContainerStyle={{ paddingTop: 24, paddingBottom: 80 }}>
        {pairings.length > 0 ? (
          pairings.map((p) => (
            <PairingCard
              key={p.id}
              pairingId={p.id}
              name={p.companioneeName}
              online={p.online}
              lastActive={p.lastActive}
            />
          ))
        ) : (
          <EmptyStateIllustration
            title="No pairings yet"
            description="Add your first family member to start caring for them with Xiao Nuan."
            actionLabel="Add New Pairing"
            onAction={() => router.push('/(steward)/onboarding')}
          />
        )}
      </ScrollView>

      {/* Add New Pairing button (fixed bottom) */}
      {pairings.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 px-margin-mobile pb-gutter pt-stack-md bg-surface-bright/90">
          <Button
            label="Add New Pairing"
            variant="primary"
            icon={<Plus size={20} color={colors.onPrimary} />}
            onPress={() => router.push('/(steward)/onboarding')}
          />
        </View>
      )}
    </View>
  );
}
