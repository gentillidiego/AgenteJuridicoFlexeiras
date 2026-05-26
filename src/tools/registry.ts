import { timeToolConfig, getCurrentTime } from './time.js';
import { googleToolsConfig, executeGoogleTool } from './google.js';
import { rememberUserToolConfig, executeRememberUserTool } from './user_memory.js';

export const agentToolsConfig = [
  timeToolConfig,
  ...googleToolsConfig,
  rememberUserToolConfig,
];

export async function executeTool(name: string, argsStr: string, userId?: string): Promise<string> {
  try {
    const args = argsStr ? JSON.parse(argsStr) : {};

    // Time tool
    if (name === 'get_current_time') return getCurrentTime();

    // Memória permanente do usuário
    if (name === 'remember_user_info') {
      return await executeRememberUserTool(userId || 'unknown', argsStr);
    }

    // Google Workspace tools
    const googleToolNames = googleToolsConfig.map(t => t.function.name);
    if (googleToolNames.includes(name)) {
      return await executeGoogleTool(name, args);
    }

    return `Erro: Ferramenta "${name}" não encontrada.`;
  } catch (error: any) {
    return `Erro ao executar a ferramenta ${name}: ${error.message}`;
  }
}
