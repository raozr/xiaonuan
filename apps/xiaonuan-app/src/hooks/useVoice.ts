import { useState, useCallback, useRef, useEffect } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  setAudioModeAsync,
  AudioModule,
} from 'expo-audio';
import { File } from 'expo-file-system';

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playError, setPlayError] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recordingUriRef = useRef<string | null>(null);

  useEffect(() => {
    AudioModule.getRecordingPermissionsAsync().then(({ granted }) => {
      setHasPermission(granted);
    });
  }, []);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    setIsRecording(recorderState.isRecording);
  }, [recorderState.isRecording]);

  useEffect(() => {
    setIsPlaying(playerStatus.playing);
  }, [playerStatus.playing]);

  const requestPermission = useCallback(async () => {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    setHasPermission(granted);
    return granted;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      setHasPermission(granted);
      if (!granted) {
        console.warn('[Voice] 录音权限被拒绝');
        return false;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      if (recorderState.isRecording) {
        console.log('[Voice] Already recording, skipping');
        return true;
      }

      try {
        await recorder.prepareToRecordAsync();
      } catch (prepareErr: any) {
        if (prepareErr?.message?.includes('already been prepared')) {
          console.log('[Voice] Already prepared, recording directly');
        } else {
          throw prepareErr;
        }
      }

      recorder.record();
      return true;
    } catch (e) {
      console.error('[Voice] 开始录音失败', e);
      return false;
    }
  }, [recorder, recorderState.isRecording]);

  const stopRecording = useCallback(async () => {
    try {
      if (!recorderState.isRecording) {
        return recorder.uri;
      }
      await recorder.stop();
      const uri = recorder.uri;
      recordingUriRef.current = uri;
      return uri;
    } catch (e) {
      console.error('[Voice] 停止录音失败', e);
      return recorder.uri;
    }
  }, [recorder, recorderState.isRecording]);

  const playAudio = useCallback(async (uri: string): Promise<boolean> => {
    try {
      setPlayError(false);
      // Reset audio mode to allow normal media playback on Android
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      await player.replace({ uri });
      await player.play();
      return true;
    } catch (e) {
      console.error('[Voice] 播放音频失败', e);
      setPlayError(true);
      return false;
    }
  }, [player]);

  const stopAudio = useCallback(async () => {
    try {
      player.pause();
      player.seekTo(0);
    } catch (e) {
      console.error('[Voice] 停止播放失败', e);
    }
  }, [player]);

  const getRecordingBase64 = useCallback(async (): Promise<string | null> => {
    const uri = recordingUriRef.current;
    if (!uri) return null;
    try {
      const file = new File(uri);
      const base64 = await file.base64();
      return base64;
    } catch (e) {
      console.error('[Voice] 读取录音文件失败', e);
      return null;
    }
  }, []);

  return {
    isRecording,
    isPlaying,
    playError,
    hasPermission,
    requestPermission,
    startRecording,
    stopRecording,
    playAudio,
    stopAudio,
    getRecordingBase64,
  };
}
