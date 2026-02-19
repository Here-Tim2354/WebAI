import type { ChatRequest, ChatResponse } from '../types/chat';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const CHAT_COMPLETIONS_PATH = '/api/v1/chat/completions';

export async function sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}${CHAT_COMPLETIONS_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Chat API request failed (${response.status}): ${detail || 'unknown error'}`);
  }

  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as ChatResponse).content !== 'string' ||
    typeof (data as ChatResponse).status !== 'string'
  ) {
    throw new Error('Chat API response format is invalid.');
  }

  return data as ChatResponse;
}
