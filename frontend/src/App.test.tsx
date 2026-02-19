import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { sendChatMessage } from './api/chatApi';

vi.mock('./api/chatApi', () => ({
  sendChatMessage: vi.fn(),
}));

describe('App chat flow', () => {
  it('sends a message and renders assistant reply', async () => {
    const user = userEvent.setup();
    vi.mocked(sendChatMessage).mockResolvedValue({ content: '你好，我是AI', status: 'ok' });

    render(<App />);

    expect(screen.getByText('开始你的第一条消息')).toBeInTheDocument();

    const input = screen.getByLabelText('消息');
    await user.type(input, '你好');
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText('你好')).toBeInTheDocument();
    expect(await screen.findByText('你好，我是AI')).toBeInTheDocument();

    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith({
        user_input: '你好',
        model: 'gemini-3-flash-preview',
      });
    });
  });
});
