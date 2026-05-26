import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import os from 'node:os';
import { ALLOWED_WA_NUMBERS } from '../config.js';
import { processUserMessage } from '../agent/loop.js';
import { transcribeAudio } from '../llm/provider.js';
import { textToSpeech } from '../tts/elevenlabs.js';
import { setWaQr, setWaStatus, registerStartFn } from './state.js';

const SESSION_DIR = './whatsapp-session';

function isAllowed(jid: string): boolean {
  // O usuário solicitou liberar para todos os números (Modo Público)
  return true;
  
  /* Whitelist desabilitada a pedido
  const number = jid.split('@')[0];
  if (ALLOWED_WA_NUMBERS.length === 0) return true;
  return ALLOWED_WA_NUMBERS.includes(number);
  */
}

function wantsVoiceReply(text: string): boolean {
  const keywords = [
    'responda em áudio', 'responde em áudio', 'responder em áudio',
    'responda por voz', 'responde por voz', 'me responda em áudio',
    'resposta em áudio', 'resposta por voz', 'fala por áudio', 'fala em áudio',
  ];
  return keywords.some(k => text.toLowerCase().includes(k));
}

async function handleMessage(sock: ReturnType<typeof makeWASocket>, jid: string, userId: string, text: string) {
  console.log(`[WhatsApp] Mensagem de ${userId}: "${text.substring(0, 80)}"`);
  try {
    await sock.sendPresenceUpdate('composing', jid);
    const response = await processUserMessage(`wa_${userId}`, text);

    if (wantsVoiceReply(text)) {
      const tempPath = path.join(os.tmpdir(), `wa_tts_${userId}_${Date.now()}.mp3`);
      try {
        await textToSpeech(response, tempPath);
        const audioBuffer = fs.readFileSync(tempPath);
        await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: true });
      } catch (ttsErr: any) {
        console.error('[WhatsApp] TTS error:', ttsErr.message);
        await sock.sendMessage(jid, { text: response });
      } finally {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    } else {
      const chunkSize = 4000;
      for (let i = 0; i < response.length; i += chunkSize) {
        await sock.sendMessage(jid, { text: response.substring(i, i + chunkSize) });
      }
    }
  } catch (error: any) {
    console.error('[WhatsApp] Erro ao processar mensagem:', error.message);
    await sock.sendMessage(jid, { text: 'Desculpe, encontrei um erro interno.' });
  } finally {
    await sock.sendPresenceUpdate('paused', jid);
  }
}

export async function startWhatsApp(): Promise<void> {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

  // Registra para o dashboard poder iniciar o WA dinamicamente
  registerStartFn(startWhatsApp);
  setWaStatus('disconnected');

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  console.log('[WhatsApp] Iniciando com versão:', version.join('.'));

  // Logger silencioso compatível com o formato pino esperado pelo Baileys
  const silentLogger = {
    level: 'silent',
    trace: () => {}, debug: () => {}, info: () => {},
    warn: () => {}, error: () => {}, fatal: () => {},
    child: () => silentLogger,
  };

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: silentLogger as any,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n[WhatsApp] QR gerado — acesse http://localhost:3333 para escanear\n');
      qrcode.generate(qr, { small: true });
      setWaQr(qr); // compartilha com o dashboard
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      setWaStatus('disconnected');
      console.log(`[WhatsApp] Conexão encerrada. Código: ${statusCode}. Reconectando: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(() => startWhatsApp(), 5000);
      } else {
        console.log('[WhatsApp] Logout detectado. Apague ./whatsapp-session/ e reinicie.');
      }
    }

    if (connection === 'open') {
      const jid = sock.user?.id || '';
      const number = jid.split(':')[0].split('@')[0];
      setWaStatus('connected', number);
      console.log(`[WhatsApp] ✅ Conectado como +${number}`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      if (isJidGroup(msg.key.remoteJid || '')) continue;

      const jid = msg.key.remoteJid!;
      const userId = jid.split('@')[0];
      const domain = jid.split('@')[1];

      console.log(`[WhatsApp Debug] Permitidos na memória: ${JSON.stringify(ALLOWED_WA_NUMBERS)}`);
      if (!isAllowed(jid)) {
        console.log(`[WhatsApp] Bloqueado: ${userId} (Domínio: ${domain}, JID total: ${jid})`);
        continue;
      }
      
      console.log(`[WhatsApp] Recebido de ${userId}: processando...`);
      await sock.readMessages([msg.key]);
      const msgContent = msg.message;

      if (msgContent.conversation || msgContent.extendedTextMessage) {
        const text = msgContent.conversation || msgContent.extendedTextMessage?.text || '';
        if (text.trim()) await handleMessage(sock, jid, userId, text);
        continue;
      }

      if (msgContent.audioMessage) {
        const tempPath = path.join(os.tmpdir(), `wa_audio_${userId}_${Date.now()}.ogg`);
        try {
          console.log(`[WhatsApp] Transcrevendo áudio de ${userId}...`);
          const buffer = await downloadMediaMessage(msg, 'buffer', {}) as Buffer;
          fs.writeFileSync(tempPath, buffer);
          const transcribed = await transcribeAudio(tempPath);
          console.log(`[WhatsApp] Transcrição: "${transcribed}"`);
          await handleMessage(sock, jid, userId, transcribed);
        } catch (err: any) {
          console.error('[WhatsApp] Erro ao transcrever áudio:', err.message);
          await sock.sendMessage(jid, { text: 'Não consegui processar seu áudio no momento.' });
        } finally {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
      }
    }
  });

  console.log('[WhatsApp] Aguardando QR code...');
}
