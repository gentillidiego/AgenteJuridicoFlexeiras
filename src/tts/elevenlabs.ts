import { ENV } from '../config.js';
import fs from 'fs';

const ELEVENLABS_TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ENV.ELEVENLABS_VOICE_ID}`;

export async function textToSpeech(text: string, outputPath: string): Promise<void> {
  const response = await fetch(ELEVENLABS_TTS_URL, {
    method: 'POST',
    headers: {
      'xi-api-key': ENV.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[TTS] ElevenLabs error:', err);
    throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}
