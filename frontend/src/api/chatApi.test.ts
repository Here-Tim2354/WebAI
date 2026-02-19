import { describe, expect, it, vi, afterEach } from 'vitest';
import { sendChatMessage } from './chatApi';

describe('sendChatMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed chat response on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: 'hello', status: 'ok' }),
      }),
    );

    const result = await sendChatMessage({ user_input: 'hi', model: 'gemini-3-flash-preview' });

    expect(result).toEqual({ content: 'hello', status: 'ok' });
  });

  it('throws readable error when request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'server exploded',
      }),
    );

    await expect(sendChatMessage({ user_input: 'hi' })).rejects.toThrow(
      'Chat API request failed (500): server exploded',
    );
  });
});
