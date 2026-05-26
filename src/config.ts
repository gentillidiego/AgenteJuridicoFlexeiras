import * as dotenv from "dotenv";

dotenv.config();

export const ENV = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_ALLOWED_USER_IDS: process.env.TELEGRAM_ALLOWED_USER_IDS || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "openrouter/free",
  DB_PATH: process.env.DB_PATH || "./memory.db",
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || "",
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || "cgSgspJ2msm6clMCkdW9",
  WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED === "true",
  WHATSAPP_ALLOWED_NUMBERS: process.env.WHATSAPP_ALLOWED_NUMBERS || "",
  GOG_ACCOUNT: process.env.GOG_ACCOUNT || "gentillidiego@gmail.com",
};

export const ALLOWED_USERS = ENV.TELEGRAM_ALLOWED_USER_IDS.split(",").map((s) => s.trim()).filter(Boolean);
export const ALLOWED_WA_NUMBERS = ENV.WHATSAPP_ALLOWED_NUMBERS.split(",").map((s) => s.replace(/\D/g, "")).filter(Boolean);
