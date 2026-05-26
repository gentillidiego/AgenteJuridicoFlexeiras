import { chatCompletion, ChatMessage } from '../llm/provider.js';
import { agentToolsConfig, executeTool } from '../tools/registry.js';
import { db, insertMessage, getMessagesByUser, Message } from '../memory/db.js';
import { formatProfileForPrompt } from '../tools/user_memory.js';
import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `Você é o AgenteJuridicoFlexeiras, um agente de IA pessoal criado para rodar localmente e ajudar o usuário.
Regras:
1. Seja claro, direto e sempre responda em Português do Brasil.
2. Use as ferramentas (tools) fornecidas através da API quando necessário (como get_current_time). NUNCA forneça as tags de ferramentas manualmente no texto; use o sistema de chamadas de função (function calling).
3. Nunca execute scripts arbitrários a não ser que uma ferramenta explícita permita.
4. Você tem memória de longo prazo persistida localmente.
5. VOCÊ POSSUI CAPACIDADE DE VOZ: Se o usuário pedir áudio ou voz, você responde normalmente com o texto da resposta. O sistema se encarregará de transformar seu texto em áudio. NUNCA diga que você não pode enviar áudio.
6. As mensagens de áudio do usuário são transcritas antes de chegarem a você. Trate-as como texto comum.
7. MEMÓRIA PESSOAL: Quando o usuário revelar seu nome, profissão, cidade ou qualquer dado pessoal relevante, use IMEDIATAMENTE a ferramenta remember_user_info para salvar. Isso garante que você sempre lembrará dessas informações no futuro.`;

const MAX_ITERATIONS = 5;

export async function processUserMessage(userId: string, userText: string): Promise<string> {
  // Carrega personalidade dinâmica
  let personalityPrompt = '';
  try {
    const personalityPath = path.resolve('personality.md');
    if (fs.existsSync(personalityPath)) {
      personalityPrompt = `\n\nINSTRUÇÕES DE PERSONALIDADE E CONHECIMENTO ADICIONAIS:\n${fs.readFileSync(personalityPath, 'utf-8')}`;
    }
  } catch (err) { console.error('Error reading personality prompt', err); }

  // Carrega perfil permanente do usuário
  const profilePrompt = formatProfileForPrompt(userId);

  // Salva mensagem do usuário
  insertMessage.run(userId, 'user', userText);

  // Carrega histórico (últimas 50 mensagens)
  const historyRows = getMessagesByUser.all(userId) as Message[];

  // Monta contexto para o LLM
  let messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + personalityPrompt + profilePrompt }
  ];

  for (const row of historyRows) {
    if (row.role === 'system') continue;
    messages.push({
      role: row.role,
      content: row.content,
    });
  }

  let finalResponse = '';
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const responseMsg = await chatCompletion(messages, agentToolsConfig as any);
    messages.push(responseMsg);

    console.log(`[Agent] Resposta LLM (iteração ${iterations}):`, {
      content: responseMsg.content?.substring(0, 100),
      tool_calls: !!responseMsg.tool_calls?.length
    });

    if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
      for (const toolCall of responseMsg.tool_calls) {
        if (toolCall.type === 'function') {
          const fnName = toolCall.function.name;
          const fnArgsStr = toolCall.function.arguments;

          console.log(`[Agent] Executing tool: ${fnName}(${fnArgsStr})`);
          // Passa userId para tools que precisam (ex: remember_user_info)
          const toolResult = await executeTool(fnName, fnArgsStr, userId);

          messages.push({
            role: 'tool',
            content: toolResult,
            name: fnName,
            tool_call_id: toolCall.id,
          });
        }
      }
    } else {
      finalResponse = responseMsg.content || '';
      insertMessage.run(userId, 'assistant', finalResponse);
      break;
    }
  }

  if (iterations >= MAX_ITERATIONS && !finalResponse) {
    finalResponse = 'Desculpe, atingi o limite de pensamento e não consegui gerar uma resposta.';
  }

  // Limpeza de tags alucinadas
  if (finalResponse) {
    finalResponse = finalResponse
      .replace(/<function=.*?>.*?<\/function>/gi, '')
      .replace(/<function=.*?>/gi, '')
      .trim();
  }

  return finalResponse;
}
