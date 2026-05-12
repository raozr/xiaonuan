import { useState, useCallback } from 'react';
// import { Audio } from 'expo-audio'; // Assuming expo-audio is available

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const startRecording = useCallback(async () => {
    console.log('[Voice] Start recording');
    setIsRecording(true);
    // Real implementation:
    // await Audio.requestPermissionsAsync();
    // await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    // recording.current = new Audio.Recording();
    // await recording.current.prepareToRecordAsync(...);
    // await recording.current.startAsync();
  }, []);

  const stopRecording = useCallback(async () => {
    console.log('[Voice] Stop recording');
    setIsRecording(false);
    // Real implementation:
    // await recording.current.stopAndUnloadAsync();
    // const uri = recording.current.getURI();
    return "mock-audio-uri";
  }, []);

  const playAudio = useCallback(async (uri: string) => {
    console.log('[Voice] Playing audio:', uri);
    setIsPlaying(true);
    // Real implementation:
    // const { sound } = await Audio.Sound.createAsync({ uri });
    // await sound.playAsync();
    // sound.setOnPlaybackStatusUpdate((status) => { if (status.didJustFinish) setIsPlaying(false); });
  }, []);

  const stopAudio = useCallback(async () => {
    console.log('[Voice] Stop audio');
    setIsPlaying(false);
    // Real implementation:
    // await sound.current.stopAsync();
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
