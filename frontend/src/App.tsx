import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import './App.css';
import { sendChatMessage } from './api/chatApi';
import type { Message } from './types/chat';

const DEFAULT_MODEL = 'gemini-3-flash-preview';

function createMessage(role: Message['role'], content: string): Message {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
  };
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const userText = inputText.trim();
    if (!userText || isLoading) {
      return;
    }

    const userMessage = createMessage('user', userText);
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setError('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        user_input: userText,
        model: DEFAULT_MODEL,
      });
      const assistantMessage = createMessage('assistant', response.content);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await send();
    }
  };

  const canSend = inputText.trim().length > 0 && !isLoading;

  return (
    <div className="chat-page">
      <div className="chat-card">
        <header className="chat-header">
          <h1>WebAI Chat</h1>
          <p>Connects to Java API: /api/v1/chat/completions</p>
        </header>

        <main className="chat-messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">开始你的第一条消息</div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`message message-${message.role}`}
                data-testid={`message-${message.role}`}
              >
                <span className="message-role">{message.role === 'user' ? 'You' : 'AI'}</span>
                <p>{message.content}</p>
              </article>
            ))
          )}

          {error ? <div className="error-banner">请求失败: {error}</div> : null}
          <div ref={messagesEndRef} />
        </main>

        <section className="chat-input-area">
          <label htmlFor="chat-input">消息</label>
          <textarea
            id="chat-input"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            rows={3}
            disabled={isLoading}
          />

          <button type="button" onClick={send} disabled={!canSend}>
            {isLoading ? '发送中...' : '发送'}
          </button>
        </section>
      </div>
    </div>
  );
}

