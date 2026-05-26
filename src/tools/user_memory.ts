import { getProfile, upsertProfile, UserProfile } from '../memory/db.js';

// ──────────────────────────────────────────────────────
// Configuração da tool para o LLM
// ──────────────────────────────────────────────────────
export const rememberUserToolConfig = {
  type: 'function' as const,
  function: {
    name: 'remember_user_info',
    description: `Salva ou atualiza informações pessoais permanentes sobre o usuário atual (nome, preferências, dados importantes).
Use esta ferramenta quando o usuário revelar seu nome, profissão, cidade, ou qualquer dado pessoal relevante que você deve lembrar para sempre, independente de quanto tempo passar.
Exemplo: se o usuário disser "me chamo João", use esta ferramenta para salvar name="João".
As notas (notes) podem conter outras informações livres separadas por ponto e vírgula.`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nome do usuário. Deixe vazio ("") se não souber ou não for atualizar.',
        },
        notes: {
          type: 'string',
          description: 'Outras informações relevantes sobre o usuário (profissão, cidade, preferências, etc). Separe múltiplos itens com ponto e vírgula. Deixe vazio ("") se não houver nada novo.',
        },
      },
      required: ['name', 'notes'],
    },
  },
};

// ──────────────────────────────────────────────────────
// Execução da tool
// ──────────────────────────────────────────────────────
export async function executeRememberUserTool(userId: string, argsStr: string): Promise<string> {
  try {
    const args = JSON.parse(argsStr) as { name: string; notes: string };

    // Carrega perfil atual para fazer merge (não apagar dados existentes)
    const existing = getProfile.get(userId) as UserProfile | undefined;
    const newName = args.name?.trim() || existing?.name || '';
    const newNotes = args.notes?.trim() || existing?.notes || '';

    upsertProfile.run(userId, newName, newNotes);

    console.log(`[Memory] Perfil atualizado para ${userId}: name="${newName}", notes="${newNotes}"`);
    return `Informações salvas com sucesso. Nome: "${newName}". Notas: "${newNotes}".`;
  } catch (err: any) {
    console.error('[Memory] Erro ao salvar perfil:', err.message);
    return 'Erro ao salvar as informações do usuário.';
  }
}

// ──────────────────────────────────────────────────────
// Helper: formata o perfil para o system prompt
// ──────────────────────────────────────────────────────
export function formatProfileForPrompt(userId: string): string {
  const profile = getProfile.get(userId) as UserProfile | undefined;
  if (!profile) return '';

  const parts: string[] = [];
  if (profile.name) parts.push(`Nome: ${profile.name}`);
  if (profile.notes) parts.push(`Notas: ${profile.notes}`);

  if (parts.length === 0) return '';

  return `\n\n[MEMÓRIA PERMANENTE DO USUÁRIO]\n${parts.join('\n')}\nEsta informação foi salva permanentemente. Use-a para personalizar suas respostas.`;
}
