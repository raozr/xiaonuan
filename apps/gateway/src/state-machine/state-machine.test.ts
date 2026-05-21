import { describe, it, expect } from 'vitest';
import { definePhaseTransition, type PhaseEvent } from './index.js';

describe('definePhaseTransition', () => {
  it('GREETING + first_message_received -> ACTIVE_CHAT', () => {
    expect(definePhaseTransition('GREETING', 'first_message_received')).toBe('ACTIVE_CHAT');
  });

  it('GREETING + session_close -> ENDED', () => {
    expect(definePhaseTransition('GREETING', 'session_close')).toBe('ENDED');
  });

  it('GREETING + companionee_silent_timeout -> CLOSING', () => {
    expect(definePhaseTransition('GREETING', 'companionee_silent_timeout')).toBe('CLOSING');
  });

  it('ACTIVE_CHAT + companionee_silent_timeout -> CLOSING', () => {
    expect(definePhaseTransition('ACTIVE_CHAT', 'companionee_silent_timeout')).toBe('CLOSING');
  });

  it('ACTIVE_CHAT + session_close -> ENDED', () => {
    expect(definePhaseTransition('ACTIVE_CHAT', 'session_close')).toBe('ENDED');
  });

  it('ACTIVE_CHAT + first_message_received stays ACTIVE_CHAT', () => {
    expect(definePhaseTransition('ACTIVE_CHAT', 'first_message_received')).toBe('ACTIVE_CHAT');
  });

  it('CLOSING + companionee_speaks_again -> ACTIVE_CHAT', () => {
    expect(definePhaseTransition('CLOSING', 'companionee_speaks_again')).toBe('ACTIVE_CHAT');
  });

  it('CLOSING + session_close -> ENDED', () => {
    expect(definePhaseTransition('CLOSING', 'session_close')).toBe('ENDED');
  });

  it('CLOSING + companionee_silent_timeout stays CLOSING', () => {
    expect(definePhaseTransition('CLOSING', 'companionee_silent_timeout')).toBe('CLOSING');
  });

  it('ENDED + any event stays ENDED', () => {
    const events: PhaseEvent[] = [
      'first_message_received',
      'companionee_silent_timeout',
      'companionee_speaks_again',
      'session_close',
    ];
    for (const event of events) {
      expect(definePhaseTransition('ENDED', event)).toBe('ENDED');
    }
  });

  it('unknown phase + any event stays same', () => {
    expect(definePhaseTransition('UNKNOWN', 'session_close')).toBe('UNKNOWN');
  });
});
