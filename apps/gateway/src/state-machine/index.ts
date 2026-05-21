export type PhaseEvent =
  | 'first_message_received'
  | 'companionee_silent_timeout'
  | 'companionee_speaks_again'
  | 'session_close';

export function definePhaseTransition(
  currentPhase: string,
  event: PhaseEvent
): string {
  switch (currentPhase) {
    case 'GREETING':
      if (event === 'first_message_received') return 'ACTIVE_CHAT';
      if (event === 'companionee_silent_timeout') return 'CLOSING';
      if (event === 'session_close') return 'ENDED';
      return currentPhase;
    case 'ACTIVE_CHAT':
      if (event === 'companionee_silent_timeout') return 'CLOSING';
      if (event === 'session_close') return 'ENDED';
      return currentPhase;
    case 'CLOSING':
      if (event === 'companionee_speaks_again') return 'ACTIVE_CHAT';
      if (event === 'session_close') return 'ENDED';
      return currentPhase;
    case 'ENDED':
      return currentPhase;
    default:
      return currentPhase;
  }
}
