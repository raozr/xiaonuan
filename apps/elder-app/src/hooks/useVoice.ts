import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Voice] 录音权限被拒绝');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      await recording.startAsync();
      setIsRecording(true);
    } catch (e) {
      console.error('[Voice] 开始录音失败', e);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      const recording = recordingRef.current;
      if (!recording) return null;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      return uri;
    } catch (e) {
      console.error('[Voice] 停止录音失败', e);
      return null;
    }
  }, []);

  const playAudio = useCallback(async (uri: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        {},
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
      await sound.playAsync();
    } catch (e) {
      console.error('[Voice] 播放音频失败', e);
    }
  }, []);

  const stopAudio = useCallback(async () => {
    try {
      const sound = soundRef.current;
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        soundRef.current = null;
      }
      setIsPlaying(false);
    } catch (e) {
      console.error('[Voice] 停止播放失败', e);
    }
  }, []);

  return {
    isRecording,
    isPlaying,
    startRecording,
    stopRecording,
    playAudio,
    stopAudio,
  };
}
