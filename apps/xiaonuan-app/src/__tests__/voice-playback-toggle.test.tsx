import React from 'react';
import { describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Text: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('Text', props, children),
    TouchableOpacity: ({
      children,
      onPress,
      ...props
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) => React.createElement('TouchableOpacity', { ...props, onClick: onPress }, children),
    View: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('View', props, children),
  };
});

vi.mock('@testing-library/react-native', async () => {
  const renderer = await import('react-test-renderer');
  type TestNode = {
    parent?: TestNode | null;
    props: Record<string, unknown>;
  };

  const getText = (node: unknown): string => {
    if (typeof node === 'string') {
      return node;
    }
    if (!node || typeof node !== 'object' || !('children' in node)) {
      return '';
    }

    const children = (node as { children?: unknown[] }).children ?? [];
    return children.map(getText).join('');
  };

  const findByText = (root: { findAll: (predicate: (node: unknown) => boolean) => unknown[] }, text: string) => {
    const matches = root.findAll((node) => {
      if (!node || typeof node !== 'object' || !('type' in node)) {
        return false;
      }

      return typeof (node as { type?: unknown }).type === 'string' && getText(node) === text;
    });
    if (matches.length === 0) {
      throw new Error(`Unable to find text: ${text}`);
    }
    return matches[matches.length - 1];
  };

  return {
    fireEvent: {
      press: (node: TestNode) => {
        let current: TestNode | null | undefined = node;
        while (current) {
          const onClick = current.props.onClick;
          const onPress = current.props.onPress;
          if (typeof onClick === 'function' || typeof onPress === 'function') {
            onClick?.();
            onPress?.();
            return;
          }
          current = current.parent;
        }
      },
    },
    render: (element: React.ReactElement) => {
      let tree: renderer.ReactTestRenderer | undefined;
      renderer.act(() => {
        tree = renderer.create(element);
      });

      return {
        getByText: (text: string) => findByText(tree!.root, text),
        queryByText: (text: string) => {
          try {
            return findByText(tree!.root, text);
          } catch {
            return null;
          }
        },
      };
    },
  };
});

const { fireEvent, render } = await import('@testing-library/react-native');
const { VoicePlaybackToggle } = await import('../components/companionee/VoicePlaybackToggle');

const getControlNode = (node: { parent?: unknown; props: Record<string, unknown> }) => {
  let current: { parent?: unknown; props: Record<string, unknown> } | null | undefined = node;

  while (current) {
    if (current.props.accessibilityRole || current.props.onClick || current.props.onPress) {
      return current;
    }
    current = current.parent as { parent?: unknown; props: Record<string, unknown> } | null | undefined;
  }

  return node;
};

describe('VoicePlaybackToggle', () => {
  it('should show enabled label', () => {
    const screen = render(
      <VoicePlaybackToggle
        enabled
        canPlayLatest={false}
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );

    expect(screen.getByText('语音 开')).toBeTruthy();
  });

  it('should show disabled label and latest play button', () => {
    const screen = render(
      <VoicePlaybackToggle
        enabled={false}
        canPlayLatest
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );

    expect(screen.getByText('语音 关')).toBeTruthy();
    expect(screen.getByText('播放')).toBeTruthy();
  });

  it('should call callbacks when pressed', () => {
    const onToggle = vi.fn();
    const onPlayLatest = vi.fn();
    const screen = render(
      <VoicePlaybackToggle
        enabled={false}
        canPlayLatest
        onToggle={onToggle}
        onPlayLatest={onPlayLatest}
      />
    );

    fireEvent.press(screen.getByText('语音 关'));
    fireEvent.press(screen.getByText('播放'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onPlayLatest).toHaveBeenCalledTimes(1);
  });

  it('should hide play button when latest audio is unavailable', () => {
    const screen = render(
      <VoicePlaybackToggle
        enabled={false}
        canPlayLatest={false}
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );

    expect(screen.queryByText('播放')).toBeNull();
  });

  it('should hide play button when voice playback is enabled', () => {
    const screen = render(
      <VoicePlaybackToggle
        enabled
        canPlayLatest
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );

    expect(screen.queryByText('播放')).toBeNull();
  });

  it('should expose switch accessibility metadata and elder touch target', () => {
    const enabledScreen = render(
      <VoicePlaybackToggle
        enabled
        canPlayLatest={false}
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );
    const enabledToggle = getControlNode(enabledScreen.getByText('语音 开'));

    expect(enabledToggle.props.className).toContain('min-h-touch-target-min');
    expect(enabledToggle.props.accessibilityRole).toBe('switch');
    expect(enabledToggle.props.accessibilityState).toEqual({ checked: true });
    expect(enabledToggle.props.accessibilityLabel).toBe('关闭语音播放');

    const disabledScreen = render(
      <VoicePlaybackToggle
        enabled={false}
        canPlayLatest={false}
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );
    const disabledToggle = getControlNode(disabledScreen.getByText('语音 关'));

    expect(disabledToggle.props.className).toContain('min-h-touch-target-min');
    expect(disabledToggle.props.accessibilityRole).toBe('switch');
    expect(disabledToggle.props.accessibilityState).toEqual({ checked: false });
    expect(disabledToggle.props.accessibilityLabel).toBe('打开语音播放');
  });

  it('should expose play button accessibility metadata and elder touch target', () => {
    const screen = render(
      <VoicePlaybackToggle
        enabled={false}
        canPlayLatest
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );
    const playButton = getControlNode(screen.getByText('播放'));

    expect(playButton.props.className).toContain('min-h-touch-target-min');
    expect(playButton.props.accessibilityRole).toBe('button');
    expect(playButton.props.accessibilityLabel).toBe('播放最近一条语音');
  });
});
