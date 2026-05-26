import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || "./memory.db";

// Garante que o diretório existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(DB_PATH);

// ──────────────────────────────────────────────────────
// TABELA: mensagens de conversa
// ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ──────────────────────────────────────────────────────
// TABELA: perfil persistente por usuário/número
// ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    name TEXT,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ──────────────────────────────────────────────────────
// TIPOS
// ──────────────────────────────────────────────────────
export interface Message {
  id: number;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface UserProfile {
  user_id: string;
  name: string | null;
  notes: string | null;
  updated_at: string;
}

// ──────────────────────────────────────────────────────
// QUERIES: mensagens
// ──────────────────────────────────────────────────────
export const insertMessage = db.prepare<[string, string, string]>(
  `INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)`
);

// Retorna apenas as últimas 50 mensagens por usuário (janela deslizante)
export const getMessagesByUser = db.prepare<[string]>(
  `SELECT * FROM (
     SELECT * FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT 50
   ) ORDER BY id ASC`
);

// Apaga mensagens mais antigas que 30 dias
export const deleteOldMessages = db.prepare(
  `DELETE FROM messages WHERE created_at < datetime('now', '-30 days')`
);

// ──────────────────────────────────────────────────────
// QUERIES: perfil de usuário
// ──────────────────────────────────────────────────────
export const getProfile = db.prepare<[string]>(
  `SELECT * FROM user_profiles WHERE user_id = ?`
);

export const upsertProfile = db.prepare<[string, string, string]>(
  `INSERT INTO user_profiles (user_id, name, notes, updated_at)
   VALUES (?, ?, ?, datetime('now'))
   ON CONFLICT(user_id) DO UPDATE SET
     name = excluded.name,
     notes = excluded.notes,
     updated_at = excluded.updated_at`
);

// ──────────────────────────────────────────────────────
// LIMPEZA AUTOMÁTICA (roda uma vez por dia)
// ──────────────────────────────────────────────────────
export function runDailyCleanup() {
  const result = deleteOldMessages.run();
  if (result.changes > 0) {
    console.log(`[DB] Limpeza automática: ${result.changes} mensagens antigas removidas.`);
  }
}

// Agenda limpeza a cada 24 horas
setInterval(runDailyCleanup, 24 * 60 * 60 * 1000);

// Roda uma vez ao iniciar
runDailyCleanup();
