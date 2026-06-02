import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Companionee home voice playback wiring', () => {
  it('should render VoicePlaybackToggle with conversation hook state and actions', () => {
    const homeSource = readFileSync(join(__dirname, '..', '..', 'app', '(companionee)', 'home.tsx'), 'utf-8');

    expect(homeSource).toContain("import { VoicePlaybackToggle }");
    expect(homeSource).toContain('canPlayLatestAudio');
    expect(homeSource).toContain('playLatestAudio');
    expect(homeSource).toContain('toggleVoicePlayback');
    expect(homeSource).toContain('voicePlaybackEnabled');
    expect(homeSource).toContain('<VoicePlaybackToggle');
    expect(homeSource).toContain('enabled={voicePlaybackEnabled}');
    expect(homeSource).toContain('canPlayLatest={canPlayLatestAudio}');
    expect(homeSource).toContain('onToggle={toggleVoicePlayback}');
    expect(homeSource).toContain('onPlayLatest={playLatestAudio}');
  });
});
