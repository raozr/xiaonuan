export type PhaseEvent =
  | 'first_message_received'
  | 'elder_silent_timeout'
  | 'elder_speaks_again'
  | 'session_close';

export function definePhaseTransition(
  currentPhase: string,
  event: PhaseEvent
): string {
  switch (currentPhase) {
    case 'GREETING':
      if (event === 'first_message_received') return 'ACTIVE_CHAT';
      if (event === 'elder_silent_timeout') return 'CLOSING';
      if (event === 'session_close') return 'ENDED';
      return currentPhase;
    case 'ACTIVE_CHAT':
      if (event === 'elder_silent_timeout') return 'CLOSING';
      if (event === 'session_close') return 'ENDED';
      return currentPhase;
    case 'CLOSING':
      if (event === 'elder_speaks_again') return 'ACTIVE_CHAT';
      if (event === 'session_close') return 'ENDED';
      return currentPhase;
    case 'ENDED':
      return currentPhase;
    default:
      return currentPhase;
  }
}
