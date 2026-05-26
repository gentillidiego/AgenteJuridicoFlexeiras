import { startBot } from './bot.js';
import { startWhatsApp } from './whatsapp/whatsapp.js';
import { startDashboard } from './dashboard/server.js';
import { registerStartFn } from './whatsapp/state.js';
import { ENV } from './config.js';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function main() {
  console.log('--- Initializing OpenGravity ---');

  // Registra a função de start do WhatsApp para o dashboard poder iniciar dinamicamente
  registerStartFn(startWhatsApp);

  // Dashboard de configuração (sempre ativo)
  startDashboard(3333);

  // Inicia o Telegram (não bloqueante)
  startBot();

  // Inicia WhatsApp automaticamente apenas se habilitado no .env
  if (ENV.WHATSAPP_ENABLED) {
    console.log('[WhatsApp] Canal WhatsApp habilitado. Iniciando...');
    startWhatsApp();
  } else {
    console.log('[WhatsApp] Desabilitado. Ative pelo dashboard em http://localhost:3333');
  }
}

main().catch((err) => {
  console.error('Failed to start OpenGravity:', err);
  process.exit(1);
});
