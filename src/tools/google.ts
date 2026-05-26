import { exec } from 'child_process';
import { promisify } from 'util';
import { ENV } from '../config.js';

const execAsync = promisify(exec);

const GOG = `${process.env.HOME}/.local/bin/gog`;
const ACCOUNT = ENV.GOG_ACCOUNT;

async function runGog(args: string): Promise<string> {
  const cmd = `GOG_ACCOUNT="${ACCOUNT}" ${GOG} ${args} 2>&1`;
  const { stdout, stderr } = await execAsync(cmd, { timeout: 20000 });
  return (stdout || stderr).trim();
}

export const googleToolsConfig = [
  {
    type: 'function' as const,
    function: {
      name: 'gmail_search',
      description: 'Busca emails no Gmail. Use para encontrar, ler ou listar emails. Exemplo de queries: "newer_than:1d", "is:unread", "from:alguem@email.com", "subject:reunião".',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query de busca no formato Gmail. Ex: "newer_than:7d is:unread"' },
          max: { type: 'number', description: 'Número máximo de resultados (padrão: 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'gmail_send',
      description: 'Envia um email via Gmail.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Endereço de email do destinatário' },
          subject: { type: 'string', description: 'Assunto do email' },
          body: { type: 'string', description: 'Corpo do email em texto simples' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calendar_list_events',
      description: 'Lista eventos do Google Calendar. Use para ver agenda, compromissos, reuniões.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Data de início no formato ISO8601. Ex: "2026-03-09T00:00:00Z"' },
          to: { type: 'string', description: 'Data de fim no formato ISO8601. Ex: "2026-03-16T23:59:59Z"' },
          calendar_id: { type: 'string', description: 'ID do calendário (padrão: "primary")' },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calendar_create_event',
      description: 'Cria um evento no Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Título do evento' },
          from: { type: 'string', description: 'Data/hora de início no formato ISO8601' },
          to: { type: 'string', description: 'Data/hora de término no formato ISO8601' },
          calendar_id: { type: 'string', description: 'ID do calendário (padrão: "primary")' },
        },
        required: ['summary', 'from', 'to'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'drive_search',
      description: 'Busca arquivos no Google Drive.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca para encontrar arquivos' },
          max: { type: 'number', description: 'Número máximo de resultados (padrão: 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'contacts_list',
      description: 'Lista contatos do Google Contacts.',
      parameters: {
        type: 'object',
        properties: {
          max: { type: 'number', description: 'Número máximo de contatos (padrão: 20)' },
        },
        required: [],
      },
    },
  },
];

export async function executeGoogleTool(name: string, args: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case 'gmail_search': {
        const max = args.max || 10;
        return await runGog(`gmail search "${args.query}" --max ${max}`);
      }
      case 'gmail_send': {
        const body = args.body.replace(/"/g, '\\"');
        return await runGog(`gmail send --to "${args.to}" --subject "${args.subject}" --body "${body}" --no-input`);
      }
      case 'calendar_list_events': {
        const calId = args.calendar_id || 'primary';
        return await runGog(`calendar events ${calId} --from "${args.from}" --to "${args.to}"`);
      }
      case 'calendar_create_event': {
        const calId = args.calendar_id || 'primary';
        return await runGog(`calendar create ${calId} --summary "${args.summary}" --from "${args.from}" --to "${args.to}"`);
      }
      case 'drive_search': {
        const max = args.max || 10;
        return await runGog(`drive search "${args.query}" --max ${max}`);
      }
      case 'contacts_list': {
        const max = args.max || 20;
        return await runGog(`contacts list --max ${max}`);
      }
      default:
        return `Ferramenta Google desconhecida: ${name}`;
    }
  } catch (error: any) {
    return `Erro ao executar ${name}: ${error.message}`;
  }
}
