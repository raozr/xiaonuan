import { api } from './api';

export type ConversationMessageRole = 'COMPANIONEE' | 'AI';

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: ConversationMessageRole;
  content: string;
  createdAt: string;
}

export interface ConversationHistoryResponse {
  success: boolean;
  data: ConversationMessage[];
  pagination: {
    limit: number;
    nextCursor: string | null;
  };
}

export async function listConversationHistory(
  token: string,
  params?: { limit?: number; before?: string | null }
) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.append('limit', String(params.limit));
  if (params?.before) searchParams.append('before', params.before);
  const query = searchParams.toString();

  return api<ConversationHistoryResponse>(
    `/api/conversation/history${query ? `?${query}` : ''}`,
    { token }
  );
}
