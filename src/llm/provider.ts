import { Groq } from 'groq-sdk';
import { ENV } from '../config.js';
import fs from 'fs';

const groq = new Groq({ apiKey: ENV.GROQ_API_KEY });
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }[];
}

export type ToolConfig = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
};

export async function chatCompletion(
  messages: ChatMessage[],
  tools?: ToolConfig[]
): Promise<ChatMessage> {
  try {
    // Attempt Groq Primary
    const response = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: messages as any,
      tools: tools as any,
      tool_choice: 'auto',
      temperature: 0.6,
    });
    return response.choices[0].message as ChatMessage;
  } catch (error) {
    console.error('[LLM Provider] Groq failed, attempting OpenRouter fallback...', error);
    
    if (!ENV.OPENROUTER_API_KEY) {
      throw new Error('Groq failed and no OpenRouter API key is configured.');
    }

    // OpenRouter fallback
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENV.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ENV.OPENROUTER_MODEL,
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.6,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[LLM Provider] OpenRouter fallback failed: ', text);
      throw new Error(`OpenRouter failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.choices[0].message as ChatMessage;
  }
}

export async function transcribeAudio(filePath: string): Promise<string> {
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
      response_format: 'text',
    });
    return transcription as unknown as string;
  } catch (error) {
    console.error('[LLM Provider] Transcription failed:', error);
    throw new Error('Falha ao transcrever o áudio.');
  }
}
