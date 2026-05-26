import { Bot, Context, InputFile } from 'grammy';
import { ENV, ALLOWED_USERS } from './config.js';
import { processUserMessage } from './agent/loop.js';
import { transcribeAudio } from './llm/provider.js';
import { textToSpeech } from './tts/elevenlabs.js';
import fs from 'fs';
import path from 'path';
import os from 'node:os';

if (!ENV.TELEGRAM_BOT_TOKEN) {
  console.warn('[Bot] TELEGRAM_BOT_TOKEN is missing. Telegram bot is disabled.');
}

const bot = ENV.TELEGRAM_BOT_TOKEN ? new Bot(ENV.TELEGRAM_BOT_TOKEN) : ({
  use: () => {},
  command: () => {},
  on: () => {},
  start: async () => { console.log('[Bot] Bot is disabled (no token).'); }
} as unknown as Bot);


// Whitelist middleware
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !ALLOWED_USERS.includes(userId)) {
    console.log(`[Bot] Unauthorized access attempt from user: ${userId}`);
    return; // Ignore
  }
  await next();
});

bot.command('start', async (ctx) => {
  await ctx.reply('Olá! Eu sou o OpenGravity, seu agente pessoal de IA. Como posso ajudar?');
});

// Detect if user wants a voice reply
function wantsVoiceReply(text: string): boolean {
  const keywords = [
    'responda em áudio', 'responde em áudio', 'responder em áudio',
    'responda por voz', 'responde por voz', 'me responda em áudio',
    'resposta em áudio', 'resposta por voz', 'fala por áudio', 'fala em áudio',
  ];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

async function handleAgentResponse(ctx: Context, userId: string, text: string) {
  await ctx.replyWithChatAction('typing');

  try {
    const response = await processUserMessage(userId, text);

    if (wantsVoiceReply(text)) {
      // Generate and send audio
      const tempPath = path.join(os.tmpdir(), `tts_${userId}_${Date.now()}.mp3`);
      try {
        await ctx.replyWithChatAction('record_voice');
        await textToSpeech(response, tempPath);
        await ctx.replyWithVoice(new InputFile(tempPath));
      } catch (ttsErr: any) {
        console.error('[Bot] TTS error:', ttsErr);
        // Fallback to text if TTS fails
        await ctx.reply(response);
      } finally {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    } else {
      // Normal text reply with chunking
      const chunkSize = 4000;
      for (let i = 0; i < response.length; i += chunkSize) {
        await ctx.reply(response.substring(i, i + chunkSize));
      }
    }
  } catch (error: any) {
    console.error(`[Bot] Error processing message:`, error);
    await ctx.reply('Desculpe, encontrei um erro interno ao processar sua mensagem.');
  }
}

bot.on('message:text', async (ctx) => {
  const userId = ctx.from!.id.toString();
  const text = ctx.message.text;
  await handleAgentResponse(ctx, userId, text);
});

bot.on(['message:voice', 'message:audio'], async (ctx) => {
  const userId = ctx.from!.id.toString();
  const isVoice = !!ctx.message.voice;
  const file = ctx.message.voice || ctx.message.audio;
  
  if (!file) return;

  await ctx.replyWithChatAction('typing');
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'temp-audio-'));
  const extension = isVoice ? '.ogg' : '.mp3'; // Telegram voice = OGG/Opus, Groq aceita .ogg
  const filePath = path.join(tempDir, `audio_${file.file_id}${extension}`);

  try {
    // Obtain the download URL via Telegram API and download manually
    const telegramFile = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${ENV.TELEGRAM_BOT_TOKEN}/${telegramFile.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    
    console.log(`[Bot] Transcribing audio for user ${userId}...`);
    const transcribedText = await transcribeAudio(filePath);
    console.log(`[Bot] Transcription: "${transcribedText}"`);
    
    await handleAgentResponse(ctx, userId, transcribedText);
  } catch (error: any) {
    console.error(`[Bot] Transcription error:`, error);
    await ctx.reply('Não consegui processar seu áudio no momento.');
  } finally {
    // Cleanup
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  }
});

export async function startBot() {
  console.log('[Bot] Starting OpenGravity Telegram bot...');
  await bot.start({
    onStart: (botInfo) => {
      console.log(`[Bot] Started successfully as @${botInfo.username}`);
    }
  });
}
