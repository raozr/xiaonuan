import React from 'react';
import { describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock('lucide-react-native', async () => {
  const React = await import('react');
  const Icon = (props: Record<string, unknown>) => React.createElement('Icon', props);

  return {
    ChevronRight: Icon,
    Clock: Icon,
    Mic: Icon,
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Image: (props: Record<string, unknown>) => React.createElement('Image', props),
    Text: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('Text', props, children),
    TouchableOpacity: ({
      children,
      onLongPress,
      onPress,
      ...props
    }: {
      children?: React.ReactNode;
      onLongPress?: () => void;
      onPress?: () => void;
    }) => React.createElement('TouchableOpacity', { ...props, onLongPress, onClick: onPress }, children),
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
    if (typeof node === 'string') return node;
    if (!node || typeof node !== 'object' || !('children' in node)) return '';

    const children = (node as { children?: unknown[] }).children ?? [];
    return children.map(getText).join('');
  };

  const findByText = (root: { findAll: (predicate: (node: unknown) => boolean) => unknown[] }, text: string) => {
    const matches = root.findAll((node) => {
      if (!node || typeof node !== 'object' || !('type' in node)) return false;
      return typeof (node as { type?: unknown }).type === 'string' && getText(node) === text;
    });
    if (matches.length === 0) throw new Error(`Unable to find text: ${text}`);
    return matches[matches.length - 1] as TestNode;
  };

  const findByType = (root: { findAll: (predicate: (node: unknown) => boolean) => unknown[] }, type: string) => {
    const matches = root.findAll((node) => {
      if (!node || typeof node !== 'object' || !('type' in node)) return false;
      return (node as { type?: unknown }).type === type;
    });
    if (matches.length === 0) throw new Error(`Unable to find type: ${type}`);
    return matches[0] as TestNode;
  };

  return {
    fireEvent: {
      longPress: (node: TestNode) => {
        const onLongPress = node.props.onLongPress;
        if (typeof onLongPress === 'function') {
          onLongPress();
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
        getByType: (type: string) => findByType(tree!.root, type),
      };
    },
  };
});

const { fireEvent, render } = await import('@testing-library/react-native');
const { PairingCard } = await import('../components/steward/PairingCard');

describe('PairingCard', () => {
  it('should call onLongPress for the pressed companion card', () => {
    const onLongPress = vi.fn();
    const screen = render(
      <PairingCard
        pairingId="pair-1"
        name="张阿姨"
        online={false}
        lastActive="2小时前"
        onLongPress={onLongPress}
      />
    );

    expect(screen.getByText('张阿姨')).toBeTruthy();
    fireEvent.longPress(screen.getByType('TouchableOpacity'));

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
