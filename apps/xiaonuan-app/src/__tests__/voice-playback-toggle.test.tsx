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
    const matches = root.findAll((node) => getText(node) === text);
    if (matches.length === 0) {
      throw new Error(`Unable to find text: ${text}`);
    }
    return matches[0];
  };

  return {
    fireEvent: {
      press: (node: { props?: { onClick?: () => void; onPress?: () => void } }) => {
        node.props?.onClick?.();
        node.props?.onPress?.();
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
});
