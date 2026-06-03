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

  it('should wire the companionee text input affordance to the conversation hook', () => {
    const homeSource = readFileSync(join(__dirname, '..', '..', 'app', '(companionee)', 'home.tsx'), 'utf-8');

    expect(homeSource).toContain("import { TextInputPanel }");
    expect(homeSource).toContain('Keyboard');
    expect(homeSource).toContain('sendTextMessage');
    expect(homeSource).toContain('textInputVisible');
    expect(homeSource).toContain('<TextInputPanel');
    expect(homeSource).not.toContain('title="打字和小暖说"');
    expect(homeSource).toContain('variant="bottom"');
    expect(homeSource).toContain('onSend={sendTextMessage}');
  });

  it('should keep bottom text input above the software keyboard', () => {
    const panelSource = readFileSync(join(__dirname, '..', 'components', 'shared', 'TextInputPanel.tsx'), 'utf-8');

    expect(panelSource).toContain("behavior={isBottom ? 'padding'");
    expect(panelSource).toContain('keyboardVerticalOffset={isBottom ? 0 : undefined}');
  });

  it('should render the companionee bottom text input compactly without a title', () => {
    const panelSource = readFileSync(join(__dirname, '..', 'components', 'shared', 'TextInputPanel.tsx'), 'utf-8');

    expect(panelSource).toContain('{!isBottom && (');
    expect(panelSource).toContain('paddingTop: 16');
    expect(panelSource).toContain('paddingBottom: 20');
    expect(panelSource).toContain('elderInputContainer');
  });
});
