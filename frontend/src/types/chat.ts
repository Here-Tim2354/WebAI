export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  user_input: string;
  model?: string;
}

export interface ChatResponse {
  content: string;
  status: string;
}
