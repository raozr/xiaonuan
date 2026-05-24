import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StatusBar, Modal } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Pencil, ExternalLink, Users, UserPlus, LogOut, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopAppBar } from '../../src/components/shared/TopAppBar';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/store/auth-store';
import { useRoleStore } from '../../src/store/role-store';
import { COMPANIONEE_ROLE } from '../../src/utils/constants';
import { colors, typography } from '../../src/utils/theme';
import { getMe, updatePassword } from '../../src/services/auth';

export default function SettingsScreen() {
  const { token, stewardName, clearAuth } = useAuthStore();
  const { setRole } = useRoleStore();
  const [name, setName] = useState(stewardName ?? '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const insets = useSafeAreaInsets();

  // Fetch real user data
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getMe(token);
        if (data.name) setName(data.name);
        if (data.phone) setPhone(data.phone);
      } catch (err) {
        console.error('[Settings] fetch me failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleLogout() {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          await setRole(COMPANIONEE_ROLE);
          router.replace('/(companionee)');
        },
      },
    ]);
  }

  function openPasswordModal() {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordModalVisible(true);
  }

  async function handleChangePassword() {
    setPasswordError('');
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写所有字段');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('新密码至少6位');
      return;
    }
    if (!token) {
      setPasswordError('未登录');
      return;
    }
    try {
      setPasswordLoading(true);
      const result = await updatePassword(token, { oldPassword, newPassword });
      if (result.success) {
        setPasswordModalVisible(false);
        Alert.alert('成功', '密码修改成功');
      } else {
        setPasswordError(result.message || '修改失败');
      }
    } catch (err: any) {
      setPasswordError(err?.message || '修改失败，请检查旧密码是否正确');
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="设置" showBack />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: insets.bottom + 32 }}>
        {/* Account Settings */}
        <View className="mb-gutter">
          <Text className="text-on-surface-variant mb-stack-sm font-bold" style={typography.labelCaps}>
            账户设置
          </Text>
          <Card className="p-0 overflow-hidden">
            {/* Profile row */}
            <View className="flex-row items-center p-stack-md">
              {/* Avatar */}
              <View className="w-16 h-16 rounded-full bg-primaryContainer items-center justify-center mr-stack-md">
                <Text className="text-on-primary text-2xl font-bold">
                  {(name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
              {/* Name + Phone */}
              <View className="flex-1">
                <Text className="text-on-surface font-bold" style={typography.bodyLgElderly}>
                  {loading ? '加载中...' : (name || '未知用户')}
                </Text>
                <Text className="text-on-surface-variant" style={typography.bodyMd}>
                  {loading ? '' : (phone || '')}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View className="h-[1px] bg-surfaceContainer mx-stack-md" />

            {/* Change Password */}
            <TouchableOpacity className="flex-row items-center justify-between p-stack-md" activeOpacity={0.7} onPress={openPasswordModal}>
              <Text className="text-on-surface" style={typography.bodyMd}>修改密码</Text>
              <ChevronRight size={20} color={colors.outline} />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Notifications */}
        <View className="mb-gutter">
          <Text className="text-on-surface-variant mb-stack-sm font-bold" style={typography.labelCaps}>
            通知
          </Text>
          <Card>
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-1">
                <Text className="text-on-surface-variant" style={typography.bodyMd}>每日摘要</Text>
              </View>
              <Text className="text-on-surface-variant" style={typography.bodyMd}>暂不实现</Text>
            </View>
            <View className="h-[1px] bg-surfaceContainer" />
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-1">
                <Text className="text-on-surface-variant" style={typography.bodyMd}>异常提醒</Text>
              </View>
              <Text className="text-on-surface-variant" style={typography.bodyMd}>暂不实现</Text>
            </View>
            <View className="h-[1px] bg-surfaceContainer" />
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-1">
                <Text className="text-on-surface-variant" style={typography.bodyMd}>语音消息</Text>
              </View>
              <Text className="text-on-surface-variant" style={typography.bodyMd}>暂不实现</Text>
            </View>
          </Card>
        </View>

        {/* Family Management */}
        <View className="mb-gutter">
          <Text className="text-on-surface-variant mb-stack-sm font-bold" style={typography.labelCaps}>
            家庭管理
          </Text>
          <Card className="p-0 overflow-hidden">
            <View className="flex-row items-center justify-between p-stack-md">
              <View className="flex-row items-center gap-stack-md">
                <View className="w-10 h-10 rounded-full bg-surfaceContainer items-center justify-center">
                  <Users size={20} color={colors.onSurfaceVariant} />
                </View>
                <Text className="text-on-surface-variant" style={typography.bodyMd}>管理已绑定账号</Text>
              </View>
              <Text className="text-on-surface-variant" style={typography.bodyMd}>暂不实现</Text>
            </View>
            <View className="h-[1px] bg-surfaceContainer mx-stack-md" />
            <View className="flex-row items-center justify-between p-stack-md">
              <View className="flex-row items-center gap-stack-md">
                <View className="w-10 h-10 rounded-full bg-surfaceContainer items-center justify-center">
                  <UserPlus size={20} color={colors.onSurfaceVariant} />
                </View>
                <Text className="text-on-surface-variant" style={typography.bodyMd}>邀请家人</Text>
              </View>
              <Text className="text-on-surface-variant" style={typography.bodyMd}>暂不实现</Text>
            </View>
          </Card>
        </View>

        {/* Support & About */}
        <View className="mb-gutter">
          <Text className="text-on-surface-variant mb-stack-sm font-bold" style={typography.labelCaps}>
            帮助
          </Text>
          <Card className="p-0 overflow-hidden">
            <TouchableOpacity className="flex-row items-center justify-between p-stack-md" activeOpacity={0.7} onPress={() => router.push('/(steward)/help-center')}>
              <Text className="text-on-surface" style={typography.bodyMd}>帮助中心</Text>
              <ExternalLink size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <View className="h-[1px] bg-surfaceContainer mx-stack-md" />
            <TouchableOpacity className="flex-row items-center justify-between p-stack-md" activeOpacity={0.7} onPress={() => router.push('/(steward)/privacy-policy')}>
              <Text className="text-on-surface" style={typography.bodyMd}>隐私政策</Text>
              <ExternalLink size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <View className="h-[1px] bg-surfaceContainer mx-stack-md" />
            <View className="p-stack-md">
              <Text className="text-on-surface-variant" style={typography.bodyMd}>版本：V1.0.0</Text>
            </View>
          </Card>
        </View>

        {/* Log Out */}
        <View className="mb-gutter">
          <Button
            label="退出登录"
            variant="danger"
            icon={<LogOut size={18} color={colors.error} />}
            onPress={handleLogout}
          />
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <View className="bg-surface-bright rounded-t-3xl p-stack-lg" style={{ paddingBottom: insets.bottom + 24 }}>
            <View className="flex-row items-center justify-between mb-stack-lg">
              <Text className="text-on-surface font-bold" style={typography.headlineLg}>修改密码</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)} activeOpacity={0.7}>
                <X size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Input
              label="旧密码"
              placeholder="请输入旧密码"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <Input
              label="新密码"
              placeholder="至少6位"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <Input
              label="确认新密码"
              placeholder="再次输入新密码"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            {passwordError ? (
              <Text className="text-error mb-stack-md" style={typography.bodyMd}>{passwordError}</Text>
            ) : null}

            <Button
              label="确认修改"
              onPress={handleChangePassword}
              loading={passwordLoading}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
