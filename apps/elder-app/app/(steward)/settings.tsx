import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Pencil, ExternalLink, Users, UserPlus, LogOut } from 'lucide-react-native';
import { TopAppBar } from '../../src/components/shared/TopAppBar';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { NotificationToggle } from '../../src/components/steward/NotificationToggle';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/store/auth-store';
import { useRoleStore } from '../../src/store/role-store';
import { COMPANIONEE_ROLE } from '../../src/utils/constants';
import { colors, typography } from '../../src/utils/theme';

export default function SettingsScreen() {
  const { stewardName, companioneeName, clearAuth } = useAuthStore();
  const { setRole } = useRoleStore();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(stewardName ?? '');
  const [dailySummaries, setDailySummaries] = useState(true);
  const [abnormalAlerts, setAbnormalAlerts] = useState(true);
  const [voiceFeed, setVoiceFeed] = useState(false);

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          await setRole(COMPANIONEE_ROLE);
          router.replace('/(companionee)');
        },
      },
    ]);
  }

  async function handleSaveName() {
    setEditingName(false);
    // TODO: call PUT /api/me to update name
  }

  return (
    <View className="flex-1 bg-surface-bright">
      <TopAppBar title="Settings" showBack />

      <ScrollView className="flex-1 px-margin-mobile" contentContainerStyle={{ paddingTop: 24, paddingBottom: 32 }}>
        {/* Account Settings */}
        <View className="mb-gutter">
          <Text className="text-on-surface-variant mb-stack-sm uppercase font-bold" style={typography.labelCaps}>
            ACCOUNT SETTINGS
          </Text>
          <Card className="p-0 overflow-hidden">
            {/* Profile row */}
            <View className="flex-row items-center p-stack-md">
              {/* Avatar */}
              <View className="w-16 h-16 rounded-full bg-primaryContainer items-center justify-center mr-stack-md">
                <Text className="text-on-primary text-2xl font-bold">
                  {(name || 'JL').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
              {/* Name + Phone */}
              <View className="flex-1">
                <Text className="text-on-surface font-bold" style={typography.bodyLgElderly}>
                  {name || 'Jane Lin'}
                </Text>
                <Text className="text-on-surface-variant" style={typography.bodyMd}>
                  +1 (555) 123-4567
                </Text>
              </View>
              {/* Edit */}
              <TouchableOpacity activeOpacity={0.7} onPress={() => setEditingName(!editingName)}>
                <Pencil size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {editingName && (
              <View className="px-stack-md pb-stack-md">
                <Input
                  label="Name"
                  value={name}
                  onChangeText={setName}
                />
                <Button label="Save" onPress={handleSaveName} fullWidth={false} />
              </View>
            )}

            {/* Divider */}
            <View className="h-[1px] bg-surfaceContainer mx-stack-md" />

            {/* Change Password */}
            <TouchableOpacity className="flex-row items-center justify-between p-stack-md" activeOpacity={0.7}>
              <Text className="text-on-surface" style={typography.bodyMd}>Change Password</Text>
              <ChevronRight size={20} color={colors.outline} />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Notifications */}
        <View className="mb-gutter">
          <Text className="text-on-surface-variant mb-stack-sm uppercase font-bold" style={typography.labelCaps}>
            NOTIFICATIONS
          </Text>
          <Card>
            <NotificationToggle
              label="Daily Summaries"
              description="Morning health and activity digest"
              value={dailySummaries}
              onChange={setDailySummaries}
            />
            <View className="h-[1px] bg-surfaceContainer" />
            <NotificationToggle
              label="Abnormal Habit Alerts"
              description="Immediate alerts for routine deviations"
              value={abnormalAlerts}
              onChange={setAbnormalAlerts}
            />
            <View className="h-[1px] bg-surfaceContainer" />
            <NotificationToggle
              label="Voice Feed Updates"
              description="New voice messages from Companionee"
              value={voiceFeed}
              onChange={setVoiceFeed}
            />
          </Card>
        </View>

        {/* Family Management */}
        <View className="mb-gutter">
          <Text className="text-on-surface-variant mb-stack-sm uppercase font-bold" style={typography.labelCaps}>
            FAMILY MANAGEMENT
          </Text>
          <Card className="p-0 overflow-hidden">
            <TouchableOpacity className="flex-row items-center justify-between p-stack-md" activeOpacity={0.7}>
              <View className="flex-row items-center gap-stack-md">
                <View className="w-10 h-10 rounded-full bg-surfaceContainer items-center justify-center">
                  <Users size={20} color={colors.onSurfaceVariant} />
                </View>
                <Text className="text-on-surface" style={typography.bodyMd}>Manage Connected Accounts</Text>
              </View>
              <ChevronRight size={20} color={colors.outline} />
            </TouchableOpacity>
            <View className="h-[1px] bg-surfaceContainer mx-stack-md" />
            <TouchableOpacity className="flex-row items-center justify-between p-stack-md" activeOpacity={0.7}>
              <View className="flex-row items-center gap-stack-md">
                <View className="w-10 h-10 rounded-full bg-surfaceContainer items-center justify-center">
                  <UserPlus size={20} color={colors.onSurfaceVariant} />
                </View>
                <Text className="text-on-surface" style={typography.bodyMd}>Invite Family Member</Text>
              </View>
              <ChevronRight size={20} color={colors.outline} />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Support & About */}
        <View className="mb-gutter">
          <Text className="text-on-surface-variant mb-stack-sm uppercase font-bold" style={typography.labelCaps}>
            SUPPORT & ABOUT
          </Text>
          <Card className="p-0 overflow-hidden">
            <TouchableOpacity className="flex-row items-center justify-between p-stack-md" activeOpacity={0.7}>
              <Text className="text-on-surface" style={typography.bodyMd}>Help Center</Text>
              <ExternalLink size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <View className="h-[1px] bg-surfaceContainer mx-stack-md" />
            <TouchableOpacity className="flex-row items-center justify-between p-stack-md" activeOpacity={0.7}>
              <Text className="text-on-surface" style={typography.bodyMd}>Privacy Policy</Text>
              <ExternalLink size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <View className="h-[1px] bg-surfaceContainer mx-stack-md" />
            <View className="p-stack-md">
              <Text className="text-on-surface-variant" style={typography.bodyMd}>Version: v2.4.1</Text>
            </View>
          </Card>
        </View>

        {/* Log Out */}
        <View className="mb-gutter">
          <Button
            label="Log Out"
            variant="danger"
            icon={<LogOut size={18} color={colors.error} />}
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </View>
  );
}
