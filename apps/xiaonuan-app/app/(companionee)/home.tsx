import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { Mic, Square, LogOut, History } from 'lucide-react-native';
import { VoicePlaybackToggle } from '../../src/components/companionee/VoicePlaybackToggle';
import { useCompanioneeConversation } from '../../src/hooks/useCompanioneeConversation';
import { colors, typography } from '../../src/utils/theme';

export default function CompanioneeHome() {
  const router = useRouter();
  const {
    aiText,
    canPlayLatestAudio,
    headerTitle,
    micLabel,
    state,
    handleLongPress,
    handlePressOut,
    handleStop,
    handleUnbind,
    playLatestAudio,
    toggleVoicePlayback,
    voicePlaybackEnabled,
  } = useCompanioneeConversation();

  // Reanimated shared values
  const breatheScale = useSharedValue(1);
  const pulseScale = useSharedValue(0.8);
  const pulseOpacity = useSharedValue(0.8);
  const speakHaloScale = useSharedValue(1);
  const speakHaloOpacity = useSharedValue(0);
  const processingHaloScale = useSharedValue(1);
  const processingHaloOpacity = useSharedValue(0);

  // Breathing animation
  useEffect(() => {
    if (state === 'LISTENING' || state === 'SPEAKING' || state === 'PROCESSING') {
      cancelAnimation(breatheScale);
      breatheScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 2000 }),
          withTiming(1, { duration: 2000 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(breatheScale);
      breatheScale.value = withTiming(1, { duration: 300 });
    }

    if (state === 'SPEAKING') {
      cancelAnimation(speakHaloScale);
      cancelAnimation(speakHaloOpacity);
      speakHaloScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1500 }),
          withTiming(1.0, { duration: 1500 })
        ),
        -1
      );
      speakHaloOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1500 }),
          withTiming(0.2, { duration: 1500 })
        ),
        -1
      );
    } else {
      cancelAnimation(speakHaloScale);
      cancelAnimation(speakHaloOpacity);
      speakHaloScale.value = withTiming(1, { duration: 300 });
      speakHaloOpacity.value = withTiming(0, { duration: 300 });
    }

    if (state === 'PROCESSING') {
      cancelAnimation(processingHaloScale);
      cancelAnimation(processingHaloOpacity);
      processingHaloScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800 }),
          withTiming(1.0, { duration: 800 })
        ),
        -1
      );
      processingHaloOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800 }),
          withTiming(0.1, { duration: 800 })
        ),
        -1
      );
    } else {
      cancelAnimation(processingHaloScale);
      cancelAnimation(processingHaloOpacity);
      processingHaloScale.value = withTiming(1, { duration: 300 });
      processingHaloOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [state, breatheScale, speakHaloScale, speakHaloOpacity, processingHaloScale, processingHaloOpacity]);

  // Pulse animation for voice button
  useEffect(() => {
    if (state === 'LISTENING') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1000 }),
          withTiming(0.8, { duration: 1000 }),
        ),
        -1,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1000 }),
          withTiming(0.8, { duration: 1000 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 0.8;
      pulseOpacity.value = 0.8;
    }
  }, [state, pulseScale, pulseOpacity]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheScale.value }],
  }));

  const speakHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: speakHaloScale.value }],
    opacity: speakHaloOpacity.value,
  }));

  const processingHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: processingHaloScale.value }],
    opacity: processingHaloOpacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <SafeAreaView className="flex-1 bg-surface-bright" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="h-16 flex-row items-center justify-between px-gutter bg-surface-bright">
        <View className="w-16" />
        <Text className="flex-1 text-center font-bold" style={typography.headlineLg}>
          {headerTitle}
        </Text>
        <TouchableOpacity
          className="w-16 items-center justify-center"
          activeOpacity={0.7}
          onPress={() => router.push('/(companionee)/history')}
        >
          <History size={28} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-gutter pt-4 pb-8 justify-between items-center relative">
        {/* Ambient glow */}
        <View className="absolute inset-0" style={{ backgroundColor: 'transparent' }} />

        {/* Top: Mascot */}
        <View className="w-full items-center justify-center my-6 relative">
          {/* Listening Halo */}
          {state === 'LISTENING' && (
            <Animated.View
              style={[
                { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: colors.primaryContainer },
                pulseStyle
              ]}
            />
          )}
          {/* Speaking Halo */}
          {state === 'SPEAKING' && (
            <Animated.View
              style={[
                { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: colors.primaryFixed },
                speakHaloStyle
              ]}
            />
          )}
          {/* Processing Halo */}
          {state === 'PROCESSING' && (
            <Animated.View
              style={[
                { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: colors.secondaryContainer },
                processingHaloStyle
              ]}
            />
          )}
          <Animated.View
            style={[
              { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', zIndex: 10 },
              breatheStyle
            ]}
          >
            <Image
              source={require('../../assets/logo-smalll.jpg')}
              className="w-full h-full"
              resizeMode="cover"
            />
          </Animated.View>
        </View>

        {/* Middle: AI Text Bubble (Scrollable) */}
        <View className="flex-1 w-full items-center justify-center mb-6 mt-4">
          <View className="w-full max-w-[340px] flex-1 max-h-[100%] bg-white rounded-[32px] p-6 border border-surfaceContainerHigh relative" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}>
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, paddingVertical: 4, paddingBottom: 64 }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              indicatorStyle="black"
            >
              <Text className="text-on-surface" style={[typography.bodyLgElderly, { textAlign: aiText.length > 20 ? 'left' : 'center', lineHeight: 32 }]}>
                {aiText}
              </Text>
            </ScrollView>
            <View className="absolute left-6 right-6 bottom-4">
              <VoicePlaybackToggle
                enabled={voicePlaybackEnabled}
                canPlayLatest={canPlayLatestAudio}
                onToggle={toggleVoicePlayback}
                onPlayLatest={playLatestAudio}
              />
            </View>
          </View>
        </View>

        {/* Bottom: Actions Container */}
        <View className="w-full h-[160px] items-center justify-center relative">
          {(state === 'PROCESSING' || state === 'RESPONDING' || state === 'SPEAKING') ? (
            <View className="items-center">
              {state === 'SPEAKING' ? (
                <TouchableOpacity
                  className="w-[120px] h-[120px] rounded-full items-center justify-center border-4 border-surface-bright"
                  style={{ backgroundColor: '#c0392b' }}
                  activeOpacity={0.8}
                  onPress={handleStop}
                >
                  <Square size={32} color={colors.onPrimary} fill={colors.onPrimary} />
                  <Text className="text-on-primary font-bold mt-1" style={{ fontSize: 16 }}>停止</Text>
                </TouchableOpacity>
              ) : (
                <View className="w-[120px] h-[120px] rounded-full items-center justify-center border-4 border-surface-bright opacity-70" style={{ backgroundColor: colors.primary }}>
                  <Text className="text-on-primary font-bold" style={{ fontSize: 16 }}>
                    {state === 'RESPONDING' ? '回应中' : '处理中'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View className="items-center gap-stack-md">
              <View className="relative items-center justify-center">
                {/* Pulse ring */}
                <Animated.View
                  style={[
                    { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: colors.primaryContainer },
                    pulseStyle
                  ]}
                />
                <TouchableOpacity
                  className="w-[120px] h-[120px] rounded-full items-center justify-center border-4 border-surface-bright"
                  style={{
                    backgroundColor: state === 'LISTENING' ? colors.onPrimaryFixedVariant : colors.primary,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 10,
                  }}
                  activeOpacity={0.8}
                  onLongPress={handleLongPress}
                  onPressOut={handlePressOut}
                  delayLongPress={100}
                >
                  <Mic size={40} color={colors.onPrimary} />
                </TouchableOpacity>
              </View>
              <Text className="font-bold text-on-surface-variant tracking-wide" style={typography.bodyLgElderly}>
                {micLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Unbind button */}
        <TouchableOpacity
          className="absolute bottom-8 right-0 w-touch-target-min h-touch-target-min bg-surfaceContainerHigh rounded-full items-center justify-center"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
          activeOpacity={0.7}
          onPress={handleUnbind}
        >
          <LogOut size={20} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
